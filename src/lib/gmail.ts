import { neon } from "@neondatabase/serverless";

const AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL     = "https://gmail.googleapis.com/gmail/v1";
const REDIRECT  = process.env.GOOGLE_REDIRECT_URI ?? "https://dashboard-phi-six-70.vercel.app/api/auth/google/callback";
const SCOPES    = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export async function ensureGmailTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS gmail_tokens (
      id            TEXT PRIMARY KEY DEFAULT 'singleton',
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    TEXT NOT NULL,
      user_email    TEXT,
      user_name     TEXT,
      updated_at    TEXT
    )
  `;
  // Forward-compatible migrations: add columns that may be missing from older schema
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS user_email TEXT`;
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS user_name TEXT`;
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS updated_at TEXT`;
  // If expires_at was TIMESTAMPTZ it can still store text — no migration needed for reads
  await sql`
    CREATE TABLE IF NOT EXISTS school_emails (
      id               TEXT PRIMARY KEY,
      thread_id        TEXT,
      subject          TEXT,
      sender_name      TEXT,
      sender_email     TEXT,
      received_at      TEXT,
      body_preview     TEXT,
      body_content     TEXT,
      is_read          BOOLEAN DEFAULT false,
      is_blackboard    BOOLEAN DEFAULT false,
      deadline_title   TEXT,
      deadline_at      TEXT,
      reminder_created BOOLEAN DEFAULT false,
      synced_at        TEXT
    )
  `;
  await sql`ALTER TABLE school_emails ADD COLUMN IF NOT EXISTS reminder_created BOOLEAN DEFAULT false`;
}

// ─── Token storage ────────────────────────────────────────────────────────────

export interface TokenRow {
  accessToken:  string;
  refreshToken: string | null;
  expiresAt:    Date;
  userEmail:    string | null;
  userName:     string | null;
}

export async function saveGmailTokens(
  accessToken:  string,
  refreshToken: string | null,
  expiresIn:    number,
  userEmail:    string | null,
  userName:     string | null,
) {
  await ensureGmailTables();
  const sql = db();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await sql`
    INSERT INTO gmail_tokens (id, access_token, refresh_token, expires_at, user_email, user_name, updated_at)
    VALUES ('singleton', ${accessToken}, ${refreshToken}, ${expiresAt}, ${userEmail}, ${userName}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET access_token  = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_tokens.refresh_token),
          expires_at    = EXCLUDED.expires_at,
          user_email    = COALESCE(EXCLUDED.user_email, gmail_tokens.user_email),
          user_name     = COALESCE(EXCLUDED.user_name, gmail_tokens.user_name),
          updated_at    = NOW()
  `;
}

export async function getGmailTokens(): Promise<TokenRow | null> {
  await ensureGmailTables();
  const sql = db();
  const rows = await sql`SELECT * FROM gmail_tokens WHERE id = 'singleton'`;
  if (!rows.length) return null;
  const r = rows[0];
  const expiresAtRaw = r.expires_at;
  const expiresAt = expiresAtRaw instanceof Date ? expiresAtRaw : new Date(String(expiresAtRaw));
  if (isNaN(expiresAt.getTime())) return null;
  return {
    accessToken:  r.access_token as string,
    refreshToken: (r.refresh_token as string) ?? null,
    expiresAt,
    userEmail:    (r.user_email as string) ?? null,
    userName:     (r.user_name  as string) ?? null,
  };
}

export async function clearGmailTokens() {
  const sql = db();
  await sql`DELETE FROM gmail_tokens WHERE id = 'singleton'`;
}

export async function getFreshGmailToken(): Promise<string | null> {
  const stored = await getGmailTokens();
  if (!stored) return null;

  const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
  if (stored.expiresAt > fiveMin) return stored.accessToken;
  if (!stored.refreshToken) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: stored.refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;

  await saveGmailTokens(
    data.access_token,
    stored.refreshToken,
    data.expires_in ?? 3600,
    stored.userEmail,
    stored.userName,
  );
  return data.access_token;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");
  return `${AUTH_URL}?${new URLSearchParams({
    client_id:    clientId,
    redirect_uri: REDIRECT,
    response_type:"code",
    scope:        SCOPES,
    access_type:  "offline",
    prompt:       "consent",
  })}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri:  REDIRECT,
      grant_type:    "authorization_code",
    }),
  });
  return res.json();
}

// ─── Gmail API ────────────────────────────────────────────────────────────────

interface GmailHeader { name: string; value: string }

function hdr(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(part: Record<string, unknown>): string {
  if (part?.body && (part.body as Record<string, unknown>).data) {
    const data = (part.body as Record<string, unknown>).data as string;
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  }
  const parts = (part?.parts as Record<string, unknown>[]) ?? [];
  for (const p of parts) {
    const text = decodeBody(p);
    if (text) return text;
  }
  return "";
}

export interface ParsedEmail {
  id:          string;
  threadId:    string;
  subject:     string;
  senderName:  string;
  senderEmail: string;
  receivedAt:  string;
  bodyPreview: string;
  bodyContent: string;
  isRead:      boolean;
}

export async function fetchGmailMessages(accessToken: string, maxResults = 30): Promise<ParsedEmail[]> {
  // 1. List message IDs
  const listRes = await fetch(
    `${GMAIL}/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(`Gmail list failed ${listRes.status}: ${JSON.stringify(err)}`);
  }
  const listData = await listRes.json();
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
  if (!ids.length) return [];

  // 2. Batch fetch each message
  const results: ParsedEmail[] = [];
  await Promise.all(
    ids.slice(0, 20).map(async id => {
      try {
        const msgRes = await fetch(
          `${GMAIL}/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const msg = await msgRes.json();
        const headers: GmailHeader[] = msg.payload?.headers ?? [];
        const from    = hdr(headers, "from");
        const nameMatch = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
        const senderName  = nameMatch?.[1]?.trim() ?? from;
        const senderEmail = nameMatch?.[2]?.trim() ?? from;
        const dateStr = hdr(headers, "date");
        const isRead  = !(msg.labelIds ?? []).includes("UNREAD");
        const body    = decodeBody(msg.payload ?? {});

        results.push({
          id,
          threadId:    msg.threadId as string,
          subject:     hdr(headers, "subject"),
          senderName,
          senderEmail,
          receivedAt:  dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          bodyPreview: msg.snippet as string ?? "",
          bodyContent: body.slice(0, 8000),
          isRead,
        });
      } catch { /* skip bad message */ }
    }),
  );

  return results.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

export async function gmailReply(accessToken: string, threadId: string, to: string, subject: string, body: string): Promise<boolean> {
  const profile = await fetch(`${GMAIL}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(r => r.json());
  const from = profile.emailAddress as string;

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: Re: ${subject.replace(/^Re:\s*/i, "")}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
  ].join("\r\n");

  const encoded = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch(`${GMAIL}/users/me/messages/send`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded, threadId }),
  });

  return res.ok;
}

export async function gmailMarkRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL}/users/me/messages/${messageId}/modify`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

// ─── Blackboard detection ─────────────────────────────────────────────────────

const BB_SENDERS = [/blackboard/i, /instructure/i, /canvas/i, /desire2learn/i, /brightspace/i, /mmc\.edu/i];
const BB_SUBJECTS = [
  /assignment.*due/i, /due.*date/i, /new assignment/i, /grade.*posted/i,
  /announcement/i, /quiz.*available/i, /test.*available/i, /course.*update/i,
  /assignment.*posted/i, /submission/i,
];

export function isSchoolEmail(e: ParsedEmail): boolean {
  return (
    BB_SENDERS.some(p => p.test(e.senderEmail) || p.test(e.senderName)) ||
    BB_SUBJECTS.some(p => p.test(e.subject))
  );
}

export function extractDeadline(e: ParsedEmail): { title: string; deadlineAt: string } | null {
  const text = `${e.subject} ${e.bodyPreview} ${e.bodyContent.slice(0, 500)}`;
  const patterns = [
    /due\s+(?:on\s+)?([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/i,
    /due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /by\s+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /deadline[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) {
        if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
        return {
          title:      e.subject.replace(/\[.*?\]/g, "").trim().slice(0, 100),
          deadlineAt: d.toISOString(),
        };
      }
    }
  }
  return null;
}

// ─── Email cache ──────────────────────────────────────────────────────────────

export async function upsertGmailEmails(emails: ParsedEmail[]): Promise<void> {
  if (!emails.length) return;
  await ensureGmailTables();
  const sql = db();
  for (const e of emails) {
    const school   = isSchoolEmail(e);
    const deadline = school ? extractDeadline(e) : null;
    await sql`
      INSERT INTO school_emails
        (id, thread_id, subject, sender_name, sender_email, received_at,
         body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at)
      VALUES (
        ${e.id}, ${e.threadId}, ${e.subject}, ${e.senderName}, ${e.senderEmail},
        ${e.receivedAt}, ${e.bodyPreview}, ${e.bodyContent}, ${e.isRead},
        ${school}, ${deadline?.title ?? null}, ${deadline?.deadlineAt ?? null}
      )
      ON CONFLICT (id) DO UPDATE
        SET is_read   = EXCLUDED.is_read,
            synced_at = NOW()
    `;
  }
}

export interface StoredEmail {
  id:            string;
  threadId:      string | null;
  subject:       string | null;
  senderName:    string | null;
  senderEmail:   string | null;
  receivedAt:    string;
  bodyPreview:   string | null;
  bodyContent:   string | null;
  isRead:        boolean;
  isBlackboard:  boolean;
  deadlineTitle: string | null;
  deadlineAt:    string | null;
}

export async function getStoredEmails(limit = 50): Promise<StoredEmail[]> {
  await ensureGmailTables();
  const sql = db();
  const rows = await sql`
    SELECT id, thread_id, subject, sender_name, sender_email, received_at,
           body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at
    FROM school_emails ORDER BY received_at DESC LIMIT 50
  `;
  return rows.map(r => ({
    id:            r.id as string,
    threadId:      (r.thread_id as string) ?? null,
    subject:       (r.subject as string) ?? null,
    senderName:    (r.sender_name as string) ?? null,
    senderEmail:   (r.sender_email as string) ?? null,
    receivedAt:    r.received_at instanceof Date ? r.received_at.toISOString() : String(r.received_at),
    bodyPreview:   (r.body_preview as string) ?? null,
    bodyContent:   (r.body_content as string) ?? null,
    isRead:        Boolean(r.is_read),
    isBlackboard:  Boolean(r.is_blackboard),
    deadlineTitle: (r.deadline_title as string) ?? null,
    deadlineAt:    r.deadline_at ? (r.deadline_at instanceof Date ? r.deadline_at.toISOString() : String(r.deadline_at)) : null,
  }));
}
