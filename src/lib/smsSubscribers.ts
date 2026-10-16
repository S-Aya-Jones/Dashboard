import { neonClient } from "@/lib/neon";

// SMS subscribers, and the consent behind each one.
//
// The opt-in page existed for months as a screenshot: it showed a checkbox, a
// confirmation panel, and stored nothing. That is the single reason the A2P
// campaign had no consent record to point at — and why a reviewer testing the
// form would have found it registered nobody.
//
// What a carrier wants to see for each number is narrow and specific: when
// consent was given, from where, and that withdrawing it works immediately and
// independently of everyone else. So that is what this table holds.
//
// `role` exists because the messages are not interchangeable. Aya's own
// notifications name her therapy hour, her money and her appointments. An
// accountability partner must never receive those; they get a different,
// deliberately thin message. One table, two audiences, no accidental leak.

export type Role = "self" | "partner";

export interface Subscriber {
  id: number;
  phone: string;           // 10 digits, no punctuation
  name: string | null;
  role: Role;
  active: boolean;
  consentAt: string;
  consentIp: string | null;
  /** The exact checkbox wording they agreed to, kept verbatim. */
  consentText: string | null;
  optedOutAt: string | null;
}

/** The wording on /sms-opt-in. Stored per subscriber so it survives a redesign. */
export const CONSENT_TEXT =
  "Yes, I consent to receive automated text messages from Aya's Dashboard.";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

/** 10 digits, or null when it isn't a US mobile number we can send to. */
export function normalisePhone(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "").replace(/^1/, "");
  return d.length === 10 ? d : null;
}

export async function ensureSubscriberTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS sms_subscribers (
      id           SERIAL PRIMARY KEY,
      phone        TEXT NOT NULL UNIQUE,
      name         TEXT,
      role         TEXT NOT NULL DEFAULT 'partner',
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      consent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      consent_ip   TEXT,
      consent_text TEXT,
      opted_out_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sms_subscribers_active_idx ON sms_subscribers (active)`;
}

function rowToSub(r: Record<string, unknown>): Subscriber {
  return {
    id: Number(r.id),
    phone: String(r.phone),
    name: (r.name as string) ?? null,
    role: ((r.role as string) === "self" ? "self" : "partner") as Role,
    active: Boolean(r.active),
    consentAt: new Date(r.consent_at as string).toISOString(),
    consentIp: (r.consent_ip as string) ?? null,
    consentText: (r.consent_text as string) ?? null,
    optedOutAt: r.opted_out_at ? new Date(r.opted_out_at as string).toISOString() : null,
  };
}

/**
 * Record a consent and switch the number on.
 *
 * Re-subscribing a number that previously opted out is allowed and is what the
 * START keyword does — but it writes a fresh consent timestamp rather than
 * reviving the old one, because the old consent was withdrawn and no longer
 * says anything true.
 */
export async function subscribe(opts: {
  phone: string;
  name?: string | null;
  role?: Role;
  ip?: string | null;
}): Promise<Subscriber | null> {
  const phone = normalisePhone(opts.phone);
  if (!phone) return null;

  await ensureSubscriberTables();
  const sql = db();
  const rows = await sql`
    INSERT INTO sms_subscribers (phone, name, role, active, consent_at, consent_ip, consent_text, opted_out_at)
    VALUES (${phone}, ${opts.name ?? null}, ${opts.role ?? "partner"}, TRUE, NOW(), ${opts.ip ?? null}, ${CONSENT_TEXT}, NULL)
    ON CONFLICT (phone) DO UPDATE SET
      name         = COALESCE(EXCLUDED.name, sms_subscribers.name),
      role         = EXCLUDED.role,
      active       = TRUE,
      consent_at   = NOW(),
      consent_ip   = EXCLUDED.consent_ip,
      consent_text = EXCLUDED.consent_text,
      opted_out_at = NULL
    RETURNING *
  `;
  return rows[0] ? rowToSub(rows[0] as Record<string, unknown>) : null;
}

/**
 * Withdraw consent for one number.
 *
 * Deliberately not a delete: the row stays so the opt-out timestamp is
 * evidence, and so a number that opted out is never silently re-added by a
 * bulk import.
 */
export async function optOut(phone: string): Promise<boolean> {
  const p = normalisePhone(phone);
  if (!p) return false;
  await ensureSubscriberTables();
  const sql = db();
  const rows = await sql`
    UPDATE sms_subscribers SET active = FALSE, opted_out_at = NOW()
    WHERE phone = ${p} AND active = TRUE
    RETURNING id
  `;
  return rows.length > 0;
}

export async function findByPhone(phone: string): Promise<Subscriber | null> {
  const p = normalisePhone(phone);
  if (!p) return null;
  await ensureSubscriberTables();
  const sql = db();
  const rows = await sql`SELECT * FROM sms_subscribers WHERE phone = ${p} LIMIT 1`;
  return rows[0] ? rowToSub(rows[0] as Record<string, unknown>) : null;
}

/** Everyone currently consenting, optionally narrowed to one audience. */
export async function activeSubscribers(role?: Role): Promise<Subscriber[]> {
  await ensureSubscriberTables();
  const sql = db();
  const rows = role
    ? await sql`SELECT * FROM sms_subscribers WHERE active = TRUE AND role = ${role} ORDER BY id`
    : await sql`SELECT * FROM sms_subscribers WHERE active = TRUE ORDER BY id`;
  return rows.map(r => rowToSub(r as Record<string, unknown>));
}

export async function subscriberCounts() {
  await ensureSubscriberTables();
  const sql = db();
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE active)                       AS active,
      COUNT(*) FILTER (WHERE NOT active)                   AS opted_out,
      COUNT(*) FILTER (WHERE active AND role = 'self')     AS self,
      COUNT(*) FILTER (WHERE active AND role = 'partner')  AS partner
    FROM sms_subscribers
  `;
  const r = rows[0] as Record<string, unknown>;
  return {
    active: Number(r.active), optedOut: Number(r.opted_out),
    self: Number(r.self), partner: Number(r.partner),
  };
}

// ── The required messages ────────────────────────────────────────────────────
//
// CTIA wants the business name, the frequency, a rates notice and both keywords
// in the confirmation. Written once here so the campaign registration and the
// thing actually sent can never drift apart.

export const CONFIRM_MSG =
  "Aya's Dashboard: You're subscribed to automated wellness and schedule " +
  "notifications. Up to 2 msgs/day. Msg&data rates may apply. " +
  "Reply HELP for help, STOP to cancel.";

export const STOP_MSG =
  "You have successfully been unsubscribed. You will not receive any more " +
  "messages from this number. Reply START to resubscribe.";

export const HELP_MSG =
  "Aya's Dashboard: Automated wellness and schedule notifications. Up to 2 " +
  "msgs/day. Msg&data rates may apply. Reply STOP to cancel. " +
  "Support: shaniquaayajones@gmail.com";

export const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "revoke"];
export const START_WORDS = ["start", "unstop", "yes"];
export const HELP_WORDS = ["help", "info"];

export type Keyword = "stop" | "start" | "help" | null;

/** Which keyword an inbound message is, if any. Punctuation and case ignored. */
export function keywordOf(body: string): Keyword {
  const w = String(body ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (STOP_WORDS.includes(w)) return "stop";
  if (START_WORDS.includes(w)) return "start";
  if (HELP_WORDS.includes(w)) return "help";
  return null;
}
