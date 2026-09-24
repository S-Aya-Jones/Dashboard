import { neonClient } from "@/lib/neon";
import crypto from "crypto";

// Study partners.
//
// The privacy model is the important part. A partner never gets a filtered
// version of Aya's dashboard — they get a different route backed by a
// different query that can only ever return study material. Hiding things in
// a shared view is one mistake away from leaking her finances or her therapy
// schedule; a separate door cannot leak what it was never able to load.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export type PartnerRole = "quizmaster" | "accountability";

export interface Partner {
  id: string;
  name: string;
  role: PartnerRole;
  mediaId: string | null;
  /** Only ever sent to the owner, never to the partner side. */
  token: string;
  passcode: string | null;
  seeScores: boolean;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

let ready = false;
async function ensure() {
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS study_partners (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'quizmaster',
      media_id     TEXT,
      token        TEXT NOT NULL UNIQUE,
      passcode     TEXT,
      see_scores   BOOLEAN NOT NULL DEFAULT false,
      active       BOOLEAN NOT NULL DEFAULT true,
      last_seen_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  ready = true;
}

function row(r: Record<string, unknown>): Partner {
  return {
    id: String(r.id),
    name: String(r.name),
    role: (r.role as PartnerRole) ?? "quizmaster",
    mediaId: r.media_id ? String(r.media_id) : null,
    token: String(r.token),
    passcode: r.passcode ? String(r.passcode) : null,
    seeScores: Boolean(r.see_scores),
    active: Boolean(r.active),
    lastSeenAt: r.last_seen_at ? String(r.last_seen_at) : null,
    createdAt: String(r.created_at),
  };
}

export async function listPartners(): Promise<Partner[]> {
  await ensure();
  const sql = db();
  const rows = await sql`SELECT * FROM study_partners ORDER BY created_at ASC`;
  return rows.map(row);
}

export async function createPartner(input: {
  name: string; role: PartnerRole; mediaId?: string | null;
  passcode?: string | null; seeScores?: boolean;
}): Promise<Partner> {
  await ensure();
  const sql = db();
  // 32 hex chars — long enough that the link itself is the secret.
  const token = crypto.randomBytes(16).toString("hex");
  const rows = await sql`
    INSERT INTO study_partners (name, role, media_id, token, passcode, see_scores)
    VALUES (${input.name}, ${input.role}, ${input.mediaId ?? null}, ${token},
            ${input.passcode ?? null}, ${input.seeScores ?? false})
    RETURNING *
  `;
  return row(rows[0]);
}

export async function updatePartner(
  id: string,
  fields: Partial<{ name: string; role: PartnerRole; mediaId: string | null; passcode: string | null; seeScores: boolean; active: boolean }>,
): Promise<void> {
  await ensure();
  const sql = db();
  if (fields.name !== undefined)      await sql`UPDATE study_partners SET name = ${fields.name} WHERE id = ${id}`;
  if (fields.role !== undefined)      await sql`UPDATE study_partners SET role = ${fields.role} WHERE id = ${id}`;
  if (fields.mediaId !== undefined)   await sql`UPDATE study_partners SET media_id = ${fields.mediaId} WHERE id = ${id}`;
  if (fields.passcode !== undefined)  await sql`UPDATE study_partners SET passcode = ${fields.passcode} WHERE id = ${id}`;
  if (fields.seeScores !== undefined) await sql`UPDATE study_partners SET see_scores = ${fields.seeScores} WHERE id = ${id}`;
  if (fields.active !== undefined)    await sql`UPDATE study_partners SET active = ${fields.active} WHERE id = ${id}`;
}

export async function deletePartner(id: string): Promise<void> {
  await ensure();
  const sql = db();
  await sql`DELETE FROM study_partners WHERE id = ${id}`;
}

/** Rotate the link, so a forwarded one stops working. */
export async function rotateToken(id: string): Promise<string | null> {
  await ensure();
  const sql = db();
  const token = crypto.randomBytes(16).toString("hex");
  const rows = await sql`UPDATE study_partners SET token = ${token} WHERE id = ${id} RETURNING token`;
  return rows.length ? String(rows[0].token) : null;
}

/** Resolve a link. Returns null for unknown or revoked tokens. */
export async function partnerByToken(token: string): Promise<Partner | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  await ensure();
  const sql = db();
  const rows = await sql`SELECT * FROM study_partners WHERE token = ${token} AND active`;
  if (!rows.length) return null;
  await sql`UPDATE study_partners SET last_seen_at = NOW() WHERE token = ${token}`;
  return row(rows[0]);
}

/** Constant-time passcode check. */
export function passcodeMatches(partner: Partner, supplied: string): boolean {
  if (!partner.passcode) return true;
  const a = Buffer.from(partner.passcode);
  const b = Buffer.from(String(supplied ?? ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
