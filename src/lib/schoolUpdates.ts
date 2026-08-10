import { neonClient } from "@/lib/neon";

// Things her course email tells her that are not deadlines.
//
// "Zoom links have moved to Blackboard", "the presentations stop being emailed
// at week 3", "you cannot sit a quiz unless you are registered" — none of these
// have a due date, so the obligation extractor discards every one of them. They
// are also the emails that change how her week actually works, which is what
// she meant by wanting to be told what is going on.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export type UpdateKind = "change" | "action" | "opportunity" | "warning";

export interface SchoolUpdate {
  id: string;
  emailId: string;
  kind: UpdateKind;
  headline: string;
  detail: string;
  course: string | null;
  createdAt: string;
  notifiedAt: string | null;
}

let ready = false;
async function ensure() {
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS school_updates (
      id          TEXT PRIMARY KEY,
      email_id    TEXT NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'change',
      headline    TEXT NOT NULL,
      detail      TEXT NOT NULL DEFAULT '',
      course      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      notified_at TIMESTAMPTZ
    )
  `;
  ready = true;
}

function row(r: Record<string, unknown>): SchoolUpdate {
  return {
    id: String(r.id),
    emailId: String(r.email_id),
    kind: (r.kind as UpdateKind) ?? "change",
    headline: String(r.headline),
    detail: String(r.detail ?? ""),
    course: r.course ? String(r.course) : null,
    createdAt: String(r.created_at),
    notifiedAt: r.notified_at ? String(r.notified_at) : null,
  };
}

/**
 * Store an update. The id is derived from the headline rather than random, so
 * re-scanning the same inbox doesn't announce the same news twice.
 */
export async function recordUpdate(u: {
  emailId: string; kind: UpdateKind; headline: string; detail?: string; course?: string | null;
}): Promise<void> {
  await ensure();
  const sql = db();
  const key = `${u.emailId}:${u.headline.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60)}`;
  await sql`
    INSERT INTO school_updates (id, email_id, kind, headline, detail, course)
    VALUES (${key}, ${u.emailId}, ${u.kind}, ${u.headline}, ${u.detail ?? ""}, ${u.course ?? null})
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Updates she has not been told about yet. */
export async function unnotifiedUpdates(limit = 8): Promise<SchoolUpdate[]> {
  await ensure();
  const sql = db();
  const rows = await sql`
    SELECT * FROM school_updates
    WHERE notified_at IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows.map(row);
}

export async function markUpdatesNotified(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await ensure();
  const sql = db();
  for (const i of ids) {
    await sql`UPDATE school_updates SET notified_at = NOW() WHERE id = ${i}`;
  }
}

export async function recentUpdates(limit = 25): Promise<SchoolUpdate[]> {
  await ensure();
  const sql = db();
  const rows = await sql`SELECT * FROM school_updates ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(row);
}

const PREFIX: Record<UpdateKind, string> = {
  warning: "Heads up",
  action: "Needs doing",
  opportunity: "Worth a look",
  change: "Changed",
};

/** The digest she gets on Telegram. */
export function updateDigest(updates: SchoolUpdate[]): string {
  const lines = updates.map(u => {
    const course = u.course ? `${u.course} — ` : "";
    return `${PREFIX[u.kind]}: ${course}${u.headline}${u.detail ? `\n   ${u.detail}` : ""}`;
  });
  const head = updates.length === 1
    ? "One thing came in from school:"
    : `${updates.length} things came in from school:`;
  return `${head}\n\n${lines.join("\n\n")}`;
}
