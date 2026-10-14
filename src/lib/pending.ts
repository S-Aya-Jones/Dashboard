import { neonClient } from "@/lib/neon";

// "Can you log my journal entry if I tell you what's going on?"
//
// She asked that and was told no. The journal command existed the whole time;
// what did not exist was any way for a sentence to turn into one. She had to
// know to type the word "journal" first, which is exactly the kind of thing a
// person stops doing.
//
// So: saying you want to journal opens a window, and the next message goes in.
// It is the same mechanism the Sunday reset uses — a short-lived note of what
// the next message is for, so that a paragraph about her week is filed instead
// of being answered.
//
// One row per kind. Opening the same kind twice just pushes the clock forward,
// which is what should happen when she starts over.

export type Capture = "review" | "journal" | "prayer";

/** How long each window stays open. */
const WINDOW_MIN: Record<Capture, number> = {
  // The Sunday reset goes out at five and she may answer it after dinner.
  review: 8 * 60,
  // These follow a sentence she just sent. If she hasn't written it within the
  // hour she is doing something else, and the next message is not the entry.
  journal: 60,
  prayer: 60,
};

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensurePendingTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS pending_capture (
      kind     TEXT PRIMARY KEY,
      asked_at TIMESTAMPTZ NOT NULL
    )
  `;
}

export async function openCapture(kind: Capture): Promise<void> {
  await ensurePendingTable();
  const sql = db();
  await sql`
    INSERT INTO pending_capture (kind, asked_at) VALUES (${kind}, NOW())
    ON CONFLICT (kind) DO UPDATE SET asked_at = NOW()
  `;
}

export async function captureOpen(kind: Capture): Promise<boolean> {
  await ensurePendingTable();
  const sql = db();
  const rows = await sql`
    SELECT 1 FROM pending_capture
    WHERE kind = ${kind} AND asked_at > NOW() - (${WINDOW_MIN[kind]} * INTERVAL '1 minute')
  `;
  return rows.length > 0;
}

export async function closeCapture(kind: Capture): Promise<void> {
  await ensurePendingTable();
  const sql = db();
  await sql`DELETE FROM pending_capture WHERE kind = ${kind}`;
}

/**
 * Which window is waiting, if any.
 *
 * One query, not three. Every inbound text that isn't a command asks this, and
 * each round trip is Neon compute time she is billed for by the hour.
 *
 * Journal before review: a journal window was opened by something she said in
 * the last hour, a review window by a text sent hours ago, so the recent one
 * is the one she is answering.
 */
export async function openCaptureKind(): Promise<Capture | null> {
  await ensurePendingTable();
  const sql = db();
  const rows = await sql`SELECT kind, asked_at FROM pending_capture`;

  const live = new Set(
    rows
      .filter(r => {
        const kind = String((r as Record<string, unknown>).kind) as Capture;
        const mins = WINDOW_MIN[kind];
        if (!mins) return false;
        const at = new Date(String((r as Record<string, unknown>).asked_at)).getTime();
        return Date.now() - at < mins * 60_000;
      })
      .map(r => String((r as Record<string, unknown>).kind)),
  );

  return (["journal", "prayer", "review"] as Capture[]).find(k => live.has(k)) ?? null;
}
