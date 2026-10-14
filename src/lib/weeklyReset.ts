import Anthropic from "@anthropic-ai/sdk";
import { neonClient } from "@/lib/neon";
import { firstText } from "@/lib/aiError";
import { chicagoDay } from "@/lib/planBrief";

// The Sunday reset.
//
// The four questions go out, she answers in one message however it comes out,
// and two things happen to that message: it is kept whole as a journal entry,
// and the numbers in it are pulled onto the dashboard.
//
// Both, not either. The prose is the point of journalling and the numbers are
// the point of tracking, and a form that asks for them separately is a form she
// fills in once. So she writes one paragraph and the parsing is this file's
// problem rather than hers.
//
// It is deliberately stateful for a few hours. "Four. Two drives, no workouts,
// savings is at 800" is only a reset answer if a reset was just asked for;
// said on a Tuesday it is a sentence for the assistant. So sending the
// questions opens a window, and the next free-text message inside it is read as
// the answer.

const WINDOW_HOURS = 8;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureResetTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_review (
      week_end     TEXT PRIMARY KEY,
      savings      NUMERIC,
      drives       INT,
      workouts     INT,
      applications INT,
      avoided      TEXT,
      faced        TEXT,
      for_someone  TEXT,
      proud_of     TEXT,
      raw          TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reset_pending (
      id       INT PRIMARY KEY DEFAULT 1,
      asked_at TIMESTAMPTZ NOT NULL
    )
  `;
}

export async function openResetWindow(): Promise<void> {
  await ensureResetTables();
  const sql = db();
  await sql`
    INSERT INTO reset_pending (id, asked_at) VALUES (1, NOW())
    ON CONFLICT (id) DO UPDATE SET asked_at = NOW()
  `;
}

export async function resetWindowOpen(): Promise<boolean> {
  await ensureResetTables();
  const sql = db();
  const rows = await sql`
    SELECT asked_at FROM reset_pending
    WHERE id = 1 AND asked_at > NOW() - (${WINDOW_HOURS} * INTERVAL '1 hour')
  `;
  return rows.length > 0;
}

export async function closeResetWindow(): Promise<void> {
  await ensureResetTables();
  const sql = db();
  await sql`DELETE FROM reset_pending WHERE id = 1`;
}

export interface Review {
  savings: number | null;
  drives: number | null;
  workouts: number | null;
  applications: number | null;
  avoided: string | null;
  faced: string | null;
  forSomeone: string | null;
  proudOf: string | null;
}

const SYSTEM = `Pull the facts out of a weekly review written as free text.

Return only JSON, no prose, with these keys:
savings (number or null) — a savings balance in dollars, not an amount saved this week unless that is all she gives
drives (integer or null) — how many drives she did
workouts (integer or null) — how many workouts
applications (integer or null) — how many job applications sent
avoided (string or null) — what she says she avoided
faced (string or null) — what she says she faced
forSomeone (string or null) — the thing she did for someone else
proudOf (string or null) — the thing she is proud of that nobody saw

Rules:
- Use null for anything she did not say. Never guess a number from context, never infer zero from silence — zero and unsaid are different facts and only she can tell them apart.
- "none", "zero", "didn't do any" means 0. Not saying anything means null.
- Quote her own words for the text fields, trimmed, not summarised.`;

/**
 * Read a free-text weekly review.
 *
 * Returns nulls on any failure rather than throwing: the raw text is already
 * saved by the caller, so a parsing failure costs the numbers and never the
 * words.
 */
export async function parseReview(text: string): Promise<Review> {
  const empty: Review = {
    savings: null, drives: null, workouts: null, applications: null,
    avoided: null, faced: null, forSomeone: null, proudOf: null,
  };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return empty;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const raw = firstText(msg)?.trim() ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Partial<Review>;

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    return {
      savings: num(parsed.savings),
      drives: num(parsed.drives),
      workouts: num(parsed.workouts),
      applications: num(parsed.applications),
      avoided: str(parsed.avoided),
      faced: str(parsed.faced),
      forSomeone: str(parsed.forSomeone),
      proudOf: str(parsed.proudOf),
    };
  } catch {
    return empty;
  }
}

export async function saveReview(weekEnd: string, r: Review, raw: string): Promise<void> {
  await ensureResetTables();
  const sql = db();
  await sql`
    INSERT INTO weekly_review
      (week_end, savings, drives, workouts, applications, avoided, faced, for_someone, proud_of, raw)
    VALUES
      (${weekEnd}, ${r.savings}, ${r.drives}, ${r.workouts}, ${r.applications},
       ${r.avoided}, ${r.faced}, ${r.forSomeone}, ${r.proudOf}, ${raw})
    ON CONFLICT (week_end) DO UPDATE SET
      savings = EXCLUDED.savings, drives = EXCLUDED.drives,
      workouts = EXCLUDED.workouts, applications = EXCLUDED.applications,
      avoided = EXCLUDED.avoided, faced = EXCLUDED.faced,
      for_someone = EXCLUDED.for_someone, proud_of = EXCLUDED.proud_of,
      raw = EXCLUDED.raw
  `;
}

export async function recentReviews(limit = 8) {
  await ensureResetTables();
  const sql = db();
  const rows = await sql`SELECT * FROM weekly_review ORDER BY week_end DESC LIMIT ${limit}`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      weekEnd: String(x.week_end),
      savings: x.savings == null ? null : Number(x.savings),
      drives: x.drives == null ? null : Number(x.drives),
      workouts: x.workouts == null ? null : Number(x.workouts),
      applications: x.applications == null ? null : Number(x.applications),
      avoided: (x.avoided as string) ?? null,
      faced: (x.faced as string) ?? null,
      forSomeone: (x.for_someone as string) ?? null,
      proudOf: (x.proud_of as string) ?? null,
      raw: String(x.raw),
    };
  });
}

/** What to text back once a review has been read. */
export function reviewAck(r: Review): string {
  const got: string[] = [];
  if (r.savings != null) got.push(`savings $${r.savings.toLocaleString("en-US")}`);
  if (r.drives != null) got.push(`${r.drives} drive${r.drives === 1 ? "" : "s"}`);
  if (r.workouts != null) got.push(`${r.workouts} workout${r.workouts === 1 ? "" : "s"}`);
  if (r.applications != null) got.push(`${r.applications} application${r.applications === 1 ? "" : "s"}`);

  const missing: string[] = [];
  if (r.savings == null) missing.push("savings");
  if (r.drives == null) missing.push("drives");
  if (r.workouts == null) missing.push("workouts");
  if (r.applications == null) missing.push("applications");

  const head = got.length ? `Logged: ${got.join(", ")}.` : "Saved to your journal.";
  // Asking for what is missing, rather than recording a zero she never said.
  const tail = missing.length && got.length
    ? ` Didn't catch ${missing.join(", ")} — text them if you want them in.`
    : "";
  return head + tail;
}

export function weekEndFor(dateStr = chicagoDay()): string {
  return dateStr;
}
