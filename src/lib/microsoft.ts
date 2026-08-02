import { neon } from "@neondatabase/serverless";

const AUTH_URL   = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL  = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH      = "https://graph.microsoft.com/v1.0";
const SCOPES     = "Mail.Read Mail.Send User.Read offline_access";
const REDIRECT   = "https://dashboard-phi-six-70.vercel.app/api/auth/microsoft/callback";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export async function ensureMicrosoftTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS microsoft_tokens (
      id            TEXT PRIMARY KEY DEFAULT 'singleton',
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    TIMESTAMPTZ NOT NULL,
      user_email    TEXT,
      user_name     TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS school_emails (
      id                TEXT PRIMARY KEY,
      subject           TEXT,
      sender_name       TEXT,
      sender_email      TEXT,
      received_at       TIMESTAMPTZ,
      body_preview      TEXT,
      body_content      TEXT,
      is_read           BOOLEAN DEFAULT false,
      is_blackboard     BOOLEAN DEFAULT false,
      deadline_title    TEXT,
      deadline_at       TIMESTAMPTZ,
      reminder_created  BOOLEAN DEFAULT false,
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ─── Token storage ────────────────────────────────────────────────────────────

export interface TokenRow {
  accessToken:  string;
  refreshToken: string | null;
  expiresAt:    Date;
  userEmail:    string | null;
  userName:     string | null;
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string | null,
  expiresInSeconds: number,
  userEmail: string | null,
  userName:  string | null,
) {
  await ensureMicrosoftTables();
  const sql = db();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await sql`
    INSERT INTO microsoft_tokens (id, access_token, refresh_token, expires_at, user_email, user_name, updated_at)
    VALUES ('singleton', ${accessToken}, ${refreshToken}, ${expiresAt}, ${userEmail}, ${userName}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET access_token  = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, microsoft_tokens.refresh_token),
          expires_at    = EXCLUDED.expires_at,
          user_email    = COALESCE(EXCLUDED.user_email, microsoft_tokens.user_email),
          user_name     = COALESCE(EXCLUDED.user_name, microsoft_tokens.user_name),
          updated_at    = NOW()
  `;
}

export async function getStoredTokens(): Promise<TokenRow | null> {
  await ensureMicrosoftTables();
  const sql = db();
  const rows = await sql`SELECT * FROM microsoft_tokens WHERE id = 'singleton'`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    accessToken:  r.access_token as string,
    refreshToken: (r.refresh_token as string) ?? null,
    expiresAt:    r.expires_at instanceof Date ? r.expires_at : new Date(r.expires_at as string),
    userEmail:    (r.user_email as string) ?? null,
    userName:     (r.user_name  as string) ?? null,
  };
}

export async function clearTokens() {
  const sql = db();
  await sql`DELETE FROM microsoft_tokens WHERE id = 'singleton'`;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID not set");
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: "code",
    redirect_uri:  REDIRECT,
    scope:         SCOPES,
    response_mode: "query",
    prompt:        "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  error?:        string;
  error_description?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const clientId     = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  REDIRECT,
      grant_type:    "authorization_code",
    }),
  });
  return res.json();
}

export async function doRefreshToken(refreshTok: string): Promise<TokenResponse> {
  const clientId     = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshTok,
      grant_type:    "refresh_token",
      scope:         SCOPES,
    }),
  });
  return res.json();
}

// Returns a fresh access token, refreshing if needed
export async function getFreshAccessToken(): Promise<string | null> {
  const stored = await getStoredTokens();
  if (!stored) return null;

  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (stored.expiresAt > fiveMinFromNow) return stored.accessToken;

  if (!stored.refreshToken) return null;
  const refreshed = await doRefreshToken(stored.refreshToken);
  if (refreshed.error || !refreshed.access_token) return null;

  await saveTokens(
    refreshed.access_token,
    refreshed.refresh_token ?? stored.refreshToken,
    refreshed.expires_in,
    stored.userEmail,
    stored.userName,
  );
  return refreshed.access_token;
}

// ─── Graph API ────────────────────────────────────────────────────────────────

export interface GraphEmail {
  id:              string;
  subject:         string;
  from:            { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead:          boolean;
  bodyPreview:     string;
  body:            { content: string; contentType: string };
}

export async function fetchEmails(accessToken: string, top = 30): Promise<GraphEmail[]> {
  const res = await fetch(
    `${GRAPH}/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc` +
    `&$select=id,subject,from,receivedDateTime,isRead,bodyPreview,body`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
  );
  const data = await res.json();
  return (data.value as GraphEmail[]) ?? [];
}

export async function fetchUserProfile(accessToken: string): Promise<{ displayName: string; mail: string }> {
  const res = await fetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function sendReply(accessToken: string, messageId: string, bodyText: string): Promise<boolean> {
  const res = await fetch(`${GRAPH}/me/messages/${messageId}/reply`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { body: { contentType: "Text", content: bodyText } },
    }),
  });
  return res.status === 202;
}

export async function markRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH}/me/messages/${messageId}`, {
    method:  "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ isRead: true }),
  });
}

// ─── Blackboard detection ─────────────────────────────────────────────────────

const BB_SENDER_PATTERNS = [
  /blackboard/i,
  /learn\.edu/i,
  /noreply.*bb\b/i,
  /donotreply.*bb\b/i,
];

const BB_SUBJECT_PATTERNS = [
  /assignment.*due/i,
  /due.*assignment/i,
  /new assignment/i,
  /grade.*posted/i,
  /announcement/i,
  /course.*announcement/i,
  /quiz.*available/i,
  /test.*available/i,
  /submission.*received/i,
];

export function isBlackboardEmail(email: GraphEmail): boolean {
  const senderAddr = email.from?.emailAddress?.address ?? "";
  const senderName = email.from?.emailAddress?.name ?? "";
  const subject    = email.subject ?? "";
  return (
    BB_SENDER_PATTERNS.some(p => p.test(senderAddr) || p.test(senderName)) ||
    BB_SUBJECT_PATTERNS.some(p => p.test(subject))
  );
}

// Extract a deadline date from email body/subject text
export function extractDeadline(email: GraphEmail): { title: string; deadlineAt: Date } | null {
  const text = `${email.subject ?? ""} ${email.bodyPreview ?? ""}`;

  // Look for date patterns: "Dec 15", "December 15", "12/15", "12/15/2026", etc.
  const patterns: RegExp[] = [
    /due\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /due\s+(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /by\s+([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /deadline[:\s]+([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const parsed = new Date(m[1]);
      if (!isNaN(parsed.getTime())) {
        // If no year was parsed, assume current or next year
        if (parsed < new Date()) parsed.setFullYear(parsed.getFullYear() + 1);
        const title = (email.subject ?? "Assignment").replace(/\[.*?\]/g, "").trim().slice(0, 100);
        return { title, deadlineAt: parsed };
      }
    }
  }
  return null;
}

// ─── Email cache ──────────────────────────────────────────────────────────────

export async function upsertEmails(emails: GraphEmail[]): Promise<void> {
  if (!emails.length) return;
  await ensureMicrosoftTables();
  const sql = db();

  for (const e of emails) {
    const isBB      = isBlackboardEmail(e);
    const deadline  = isBB ? extractDeadline(e) : null;
    const receivedAt = e.receivedDateTime;

    await sql`
      INSERT INTO school_emails
        (id, subject, sender_name, sender_email, received_at, body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at)
      VALUES (
        ${e.id},
        ${e.subject ?? null},
        ${e.from?.emailAddress?.name ?? null},
        ${e.from?.emailAddress?.address ?? null},
        ${receivedAt},
        ${e.bodyPreview ?? null},
        ${e.body?.content ?? null},
        ${e.isRead},
        ${isBB},
        ${deadline?.title ?? null},
        ${deadline ? deadline.deadlineAt.toISOString() : null}
      )
      ON CONFLICT (id) DO UPDATE
        SET is_read     = EXCLUDED.is_read,
            synced_at   = NOW()
    `;
  }
}

export interface StoredEmail {
  id:            string;
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
  await ensureMicrosoftTables();
  const sql = db();
  const rows = await sql`
    SELECT id, subject, sender_name, sender_email, received_at, body_preview,
           body_content, is_read, is_blackboard, deadline_title, deadline_at
    FROM school_emails
    ORDER BY received_at DESC
    LIMIT 50
  `;
  return rows.map(r => ({
    id:            r.id as string,
    subject:       (r.subject as string) ?? null,
    senderName:    (r.sender_name as string) ?? null,
    senderEmail:   (r.sender_email as string) ?? null,
    receivedAt:    r.received_at instanceof Date ? r.received_at.toISOString() : String(r.received_at),
    bodyPreview:   (r.body_preview as string) ?? null,
    bodyContent:   (r.body_content as string) ?? null,
    isRead:        r.is_read as boolean,
    isBlackboard:  r.is_blackboard as boolean,
    deadlineTitle: (r.deadline_title as string) ?? null,
    deadlineAt:    r.deadline_at ? (r.deadline_at instanceof Date ? r.deadline_at.toISOString() : String(r.deadline_at)) : null,
  }));
}
