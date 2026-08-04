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
  // Calendar — the same stored token powers the schedule view + seeder
  "https://www.googleapis.com/auth/calendar",
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
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS user_email TEXT`;
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS user_name TEXT`;
  await sql`ALTER TABLE gmail_tokens ADD COLUMN IF NOT EXISTS updated_at TEXT`;
  // Migrate TIMESTAMPTZ → TEXT (TIMESTAMPTZ causes silent write failures in Neon HTTP driver)
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gmail_tokens' AND column_name = 'expires_at'
        AND data_type = 'timestamp with time zone'
      ) THEN
        ALTER TABLE gmail_tokens ALTER COLUMN expires_at TYPE TEXT USING expires_at::TEXT;
        ALTER TABLE gmail_tokens ALTER COLUMN updated_at TYPE TEXT USING updated_at::TEXT;
      END IF;
    END $$
  `;
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
      category         TEXT DEFAULT 'general',
      synced_at        TEXT
    )
  `;
  await sql`ALTER TABLE school_emails ADD COLUMN IF NOT EXISTS reminder_created BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE school_emails ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'`;
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
  let expiresAt = expiresAtRaw instanceof Date ? expiresAtRaw : new Date(String(expiresAtRaw));
  if (isNaN(expiresAt.getTime())) {
    // Non-standard format from TIMESTAMPTZ→TEXT migration — truncate to 3 decimal places
    const fixed = String(expiresAtRaw).replace(/(\.\d{3})\d+/, "$1").replace(" ", "T");
    expiresAt = new Date(fixed);
  }
  if (isNaN(expiresAt.getTime())) expiresAt = new Date(0); // treat as expired, triggers refresh
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

export async function fetchGmailMessages(accessToken: string, maxResults = 50): Promise<ParsedEmail[]> {
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

  const results: ParsedEmail[] = [];
  await Promise.all(
    ids.slice(0, 50).map(async id => {
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

export async function gmailTrash(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL}/users/me/messages/${messageId}/trash`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── Email categorization ─────────────────────────────────────────────────────

export type EmailCategory = "school" | "health" | "bills" | "action" | "spam" | "general";

const BB_SENDERS  = [/blackboard/i, /instructure/i, /canvas/i, /desire2learn/i, /brightspace/i, /mmc\.edu/i];
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

export function categorizeEmail(e: ParsedEmail): EmailCategory {
  // School is highest priority
  if (isSchoolEmail(e)) return "school";

  const subj   = e.subject.toLowerCase();
  const sender = (e.senderEmail + " " + e.senderName).toLowerCase();
  const body   = (e.bodyPreview + " " + e.bodyContent.slice(0, 600)).toLowerCase();

  // Health / appointments
  if (
    /therapy|therapist|counseling|mental.health|psychiatr|patient.portal|mychart|athenahealth|labcorp|quest.diagnostic/i.test(sender) ||
    /appointment|appt|therapy.*session|session.*reminder|lab.result|prescription|refill|your.*visit|visit.*confirm/i.test(subj)
  ) return "health";

  // Bills / financial
  if (
    /billing|invoice|payment|statement|utilities|electric|water.*company|gas.company|internet|xfinity|comcast|att|verizon|t-mobile|sprint|insurance|landlord|leasing/i.test(sender) ||
    /payment.due|bill.due|amount.due|statement.available|invoice|balance.due|past.due|autopay|rent.due|minimum.payment|your.bill/i.test(subj)
  ) return "bills";

  // Action required
  if (
    /action.required|response.required|respond.by|reply.by|urgent.*action|your.response|please.respond|rsvp|verification.required|verify.your|confirm.your|confirmation.needed|expires.soon|expiration.notice|renew.your|deadline.*today/i.test(subj)
  ) return "action";

  // Spam / promo — last resort, only if unsubscribe is present and not financial
  if (
    /\bsale\b|% off|\bdiscount\b|\bdeal\b|\bcoupon\b|\bpromo\b|limited.time|flash.sale|you.won|winner.*prize|claim.your.reward|exclusive.offer/i.test(subj) ||
    (/unsubscribe|manage.*preferences|opt.out/i.test(body) && !/bank|credit.union|chase|wells.fargo|capital.one|navy.federal|insurance|medical/i.test(sender))
  ) return "spam";

  return "general";
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
    const category = categorizeEmail(e);
    const school   = category === "school";
    const deadline = school ? extractDeadline(e) : null;
    await sql`
      INSERT INTO school_emails
        (id, thread_id, subject, sender_name, sender_email, received_at,
         body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at, category)
      VALUES (
        ${e.id}, ${e.threadId}, ${e.subject}, ${e.senderName}, ${e.senderEmail},
        ${e.receivedAt}, ${e.bodyPreview}, ${e.bodyContent}, ${e.isRead},
        ${school}, ${deadline?.title ?? null}, ${deadline?.deadlineAt ?? null},
        ${category}
      )
      ON CONFLICT (id) DO UPDATE
        SET is_read   = EXCLUDED.is_read,
            category  = EXCLUDED.category,
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
  category:      EmailCategory;
}

export async function getStoredEmails(limit = 50, offset = 0, category?: EmailCategory): Promise<StoredEmail[]> {
  await ensureGmailTables();
  const sql = db();
  const rows = category
    ? await sql`
        SELECT id, thread_id, subject, sender_name, sender_email, received_at,
               body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at, category
        FROM school_emails
        WHERE category = ${category}
        ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT id, thread_id, subject, sender_name, sender_email, received_at,
               body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at, category
        FROM school_emails
        WHERE category != 'spam'
        ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}
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
    category:      (r.category as EmailCategory) ?? "general",
  }));
}

export async function purgeSpamFromDb(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sql = db();
  // Delete specific spam IDs plus retroactively clean up any old promo emails not yet marked
  await sql`DELETE FROM school_emails WHERE id = ANY(${ids}::text[])`;
  // Retroactive cleanup: mark obvious spam that got stored before detection was added
  await sql`
    DELETE FROM school_emails
    WHERE category = 'general'
    AND (
      lower(subject) SIMILAR TO '%(flash sale|% off|limited time|tick-tock|sale ends|buy [0-9]+ get|promo code|exclusive deal|shop now|don''t miss|last chance)%'
      OR (lower(body_preview) LIKE '%unsubscribe%' AND lower(subject) SIMILAR TO '%(sale|off|deal|promo|offer|save|discount|coupon|free shipping|win|winner|prize|claim)%')
    )
  `;
}

export async function getStoredEmailCount(category?: EmailCategory): Promise<number> {
  await ensureGmailTables();
  const sql = db();
  const rows = category
    ? await sql`SELECT COUNT(*)::int as n FROM school_emails WHERE category = ${category}`
    : await sql`SELECT COUNT(*)::int as n FROM school_emails WHERE category != 'spam'`;
  return Number(rows[0]?.n ?? 0);
}

// ─── Event extraction & notification tables ───────────────────────────────────

export async function ensureEventTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS email_events (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email_id       TEXT NOT NULL,
      event_type     TEXT NOT NULL,
      title          TEXT NOT NULL,
      event_date     TEXT NOT NULL,
      is_past        BOOLEAN NOT NULL DEFAULT false,
      source_subject TEXT,
      source_sender  TEXT,
      source_preview TEXT,
      notified       BOOLEAN DEFAULT false,
      notified_1h    BOOLEAN DEFAULT false,
      created_at     TEXT DEFAULT NOW()::TEXT
    )
  `;
  await sql`ALTER TABLE email_events ADD COLUMN IF NOT EXISTS notified_1h BOOLEAN DEFAULT false`;
  await sql`
    CREATE TABLE IF NOT EXISTS notified_emails (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email_id          TEXT NOT NULL UNIQUE,
      notified_at       TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_email_events_date ON email_events(event_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_email_events_notified ON email_events(notified, is_past)`;
}

export interface EmailEvent {
  emailId:       string;
  eventType:     "appointment" | "deadline" | "payment" | "event";
  title:         string;
  eventDate:     string; // ISO
  isPast:        boolean;
  sourceSubject: string;
  sourceSender:  string;
  sourcePreview: string;
}

function tryParseDate(raw: string): Date | null {
  const cleaned = raw.trim().slice(0, 80);
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  // Try appending current year when missing
  d = new Date(`${cleaned} ${new Date().getFullYear()}`);
  if (!isNaN(d.getTime())) return d;
  return null;
}

export function extractEventsFromEmail(
  emailId: string,
  subject: string,
  senderName: string,
  senderEmail: string,
  bodyPreview: string,
  bodyContent: string,
): EmailEvent[] {
  const events: EmailEvent[] = [];
  const now = new Date();
  const sender = senderName || senderEmail || "";
  const text = `${subject} ${bodyPreview} ${bodyContent.slice(0, 4000)}`;

  function scan(
    patterns: RegExp[],
    type: EmailEvent["eventType"],
    defaultTitle: string,
  ) {
    for (const p of patterns) {
      const re = new RegExp(p.source, "gi");
      const m = re.exec(text);
      if (!m || !m[1]) continue;
      const parsed = tryParseDate(m[1]);
      if (!parsed) continue;
      // If no 4-digit year in match and date already passed, roll to next year
      if (!/\d{4}/.test(m[1]) && parsed < now) parsed.setFullYear(parsed.getFullYear() + 1);
      // Skip dates more than 1 year out (likely noise)
      if (parsed.getTime() - now.getTime() > 366 * 86400000) continue;
      events.push({
        emailId,
        eventType: type,
        title: (subject || defaultTitle).slice(0, 120),
        eventDate: parsed.toISOString(),
        isPast: parsed < now,
        sourceSubject: subject,
        sourceSender: sender,
        sourcePreview: bodyPreview.slice(0, 150),
      });
      return; // one event per type per email
    }
  }

  // Appointments
  scan([
    /(?:appointment|session|therapy|visit|consultation)\s+(?:is\s+)?(?:scheduled\s+)?(?:for|on)\s+([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
    /(?:see\s+you|we'll\s+see\s+you)\s+(?:on\s+)?([\w,.\s]+(?:\d{4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}))/i,
    /reminder[:\s]+(?:your\s+)?(?:appointment|session|visit)\s+(?:is\s+)?(?:on\s+)?([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
    /(?:scheduled\s+for|confirmed\s+for)\s+([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
  ], "appointment", `Appointment from ${sender}`);

  // Payments / bills
  scan([
    /(?:payment|bill|amount|balance|minimum)\s+(?:of\s+\$[\d,.]+\s+)?(?:is\s+)?due\s+(?:on\s+)?([\w,.\s\/:-]+?(?:\d{4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}))/i,
    /(?:pay(?:ment)?\s+by|due\s+by)\s+([\w,.\s\/:-]+?(?:\d{4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}))/i,
    /autopay\s+(?:on|scheduled\s+for)\s+([\w,.\s\/:-]+?(?:\d{4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}))/i,
  ], "payment", `Bill from ${sender}`);

  // Deadlines
  scan([
    /(?:assignment|homework|quiz|exam|project|submission|paper)\s+(?:is\s+)?due\s+(?:on\s+|by\s+)?([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
    /due\s+(?:date|by)[:\s]+([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
    /deadline[:\s]+([\w,.\s\/:-]+?(?:\d{4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}))/i,
    /submit\s+by\s+([\w,.\s\/:-]+?(?:am|pm|\d{4}|\d{1,2}\/\d{1,2}))/i,
  ], "deadline", `Deadline: ${subject}`);

  return events;
}

export async function upsertEmailEvents(events: EmailEvent[]): Promise<void> {
  if (!events.length) return;
  await ensureEventTables();
  const sql = db();
  for (const ev of events) {
    await sql`
      INSERT INTO email_events (email_id, event_type, title, event_date, is_past, source_subject, source_sender, source_preview)
      VALUES (${ev.emailId}, ${ev.eventType}, ${ev.title}, ${ev.eventDate}, ${ev.isPast}, ${ev.sourceSubject}, ${ev.sourceSender}, ${ev.sourcePreview})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function getUpcomingEvents(daysAhead = 14): Promise<(EmailEvent & { id: string; notified: boolean })[]> {
  await ensureEventTables();
  const sql = db();
  const cutoff = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const now = new Date().toISOString();
  const rows = await sql`
    SELECT * FROM email_events
    WHERE is_past = false AND event_date >= ${now} AND event_date <= ${cutoff}
    ORDER BY event_date ASC
    LIMIT 100
  `;
  const events = rows.map(r => ({
    id:            r.id as string,
    emailId:       r.email_id as string,
    eventType:     r.event_type as EmailEvent["eventType"],
    title:         r.title as string,
    eventDate:     String(r.event_date),
    isPast:        Boolean(r.is_past),
    sourceSubject: String(r.source_subject ?? ""),
    sourceSender:  String(r.source_sender ?? ""),
    sourcePreview: String(r.source_preview ?? ""),
    notified:      Boolean(r.notified),
  }));

  // Dedupe near-identical events parsed from separate emails about the same
  // thing (e.g. "Payment scheduled for Aug 7" arriving twice): same title +
  // same calendar day → keep the first
  const seen = new Set<string>();
  return events.filter(e => {
    const key = `${e.title.trim().toLowerCase()}|${e.eventDate.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getUnnotifiedUrgentEvents(): Promise<Array<EmailEvent & { id: string }>> {
  await ensureEventTables();
  const sql = db();
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 48 * 3600000).toISOString();
  const rows = await sql`
    SELECT * FROM email_events
    WHERE notified = false AND is_past = false
    AND event_date >= ${now} AND event_date <= ${horizon}
    ORDER BY event_date ASC
  `;
  return rows.map(r => ({
    id:            r.id as string,
    emailId:       r.email_id as string,
    eventType:     r.event_type as EmailEvent["eventType"],
    title:         r.title as string,
    eventDate:     String(r.event_date),
    isPast:        false,
    sourceSubject: String(r.source_subject ?? ""),
    sourceSender:  String(r.source_sender ?? ""),
    sourcePreview: String(r.source_preview ?? ""),
  }));
}

export async function markEventNotified(id: string): Promise<void> {
  const sql = db();
  await sql`UPDATE email_events SET notified = true WHERE id = ${id}`;
}

export async function getEventsComingIn1Hour(): Promise<Array<EmailEvent & { id: string }>> {
  await ensureEventTables();
  const sql = db();
  const soon    = new Date(Date.now() + 30  * 60000).toISOString(); // 30 min from now
  const horizon = new Date(Date.now() + 90  * 60000).toISOString(); // 90 min from now
  const rows = await sql`
    SELECT * FROM email_events
    WHERE notified_1h = false AND is_past = false
    AND event_date >= ${soon} AND event_date <= ${horizon}
    ORDER BY event_date ASC
  `;
  return rows.map(r => ({
    id:            r.id as string,
    emailId:       r.email_id as string,
    eventType:     r.event_type as EmailEvent["eventType"],
    title:         r.title as string,
    eventDate:     String(r.event_date),
    isPast:        false,
    sourceSubject: String(r.source_subject ?? ""),
    sourceSender:  String(r.source_sender ?? ""),
    sourcePreview: String(r.source_preview ?? ""),
  }));
}

export async function markEvent1hNotified(id: string): Promise<void> {
  const sql = db();
  await sql`UPDATE email_events SET notified_1h = true WHERE id = ${id}`;
}

export async function hasBeenUrgentNotified(emailId: string): Promise<boolean> {
  await ensureEventTables();
  const sql = db();
  const rows = await sql`SELECT 1 FROM notified_emails WHERE email_id = ${emailId}`;
  return rows.length > 0;
}

export async function markUrgentNotified(emailId: string): Promise<void> {
  await ensureEventTables();
  const sql = db();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO notified_emails (email_id, notified_at)
    VALUES (${emailId}, ${now})
    ON CONFLICT (email_id) DO NOTHING
  `;
}

// History scan: fetch one page of Gmail results (metadata only, fast)
export async function fetchGmailMetadataPage(
  accessToken: string,
  query: string,
  maxResults = 100,
  pageToken?: string,
): Promise<{ ids: string[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults), format: "metadata" });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`${GMAIL}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { ids: [] };
  const data = await res.json();
  return {
    ids: (data.messages ?? []).map((m: { id: string }) => m.id),
    nextPageToken: data.nextPageToken,
  };
}

// Fetch a single email with full body for event parsing
export async function fetchSingleEmail(accessToken: string, id: string): Promise<ParsedEmail | null> {
  try {
    const res = await fetch(`${GMAIL}/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const msg = await res.json();
    const headers: GmailHeader[] = msg.payload?.headers ?? [];
    const from = hdr(headers, "from");
    const nameMatch = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
    const senderName  = nameMatch?.[1]?.trim() ?? from;
    const senderEmail = nameMatch?.[2]?.trim() ?? from;
    const dateStr = hdr(headers, "date");
    const body = decodeBody(msg.payload ?? {});
    return {
      id,
      threadId:    msg.threadId as string,
      subject:     hdr(headers, "subject"),
      senderName,
      senderEmail,
      receivedAt:  dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      bodyPreview: msg.snippet as string ?? "",
      bodyContent: body.slice(0, 8000),
      isRead:      !(msg.labelIds ?? []).includes("UNREAD"),
    };
  } catch { return null; }
}

// For morning briefing intelligence
export async function getActionableEmails(): Promise<{ deadlines: StoredEmail[]; health: StoredEmail[]; bills: StoredEmail[]; action: StoredEmail[] }> {
  await ensureGmailTables();
  const sql = db();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = await sql`
    SELECT id, thread_id, subject, sender_name, sender_email, received_at,
           body_preview, body_content, is_read, is_blackboard, deadline_title, deadline_at, category
    FROM school_emails
    WHERE received_at > ${sevenDaysAgo}
    AND category IN ('school', 'health', 'bills', 'action')
    ORDER BY received_at DESC
    LIMIT 30
  `;
  const all = rows.map(r => ({
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
    deadlineAt:    r.deadline_at ? String(r.deadline_at) : null,
    category:      (r.category as EmailCategory) ?? "general",
  }));
  const soon = new Date(Date.now() + 14 * 86400000).toISOString();
  return {
    deadlines: all.filter(e => e.deadlineAt && e.deadlineAt < soon),
    health:    all.filter(e => e.category === "health"),
    bills:     all.filter(e => e.category === "bills"),
    action:    all.filter(e => e.category === "action"),
  };
}
