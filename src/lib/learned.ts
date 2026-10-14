import { neonClient } from "@/lib/neon";

// The ones she finds herself.
//
// The ladders in driving.ts are generic by necessity — the code does not know
// her campus and must not invent one. So they say "an overpass", "an upper
// floor", and leave her to find the instance.
//
// But she finds very good ones. There is a route to building four that goes up
// to the third level, across the top of a parking structure and over, rather
// than along the street or on the shuttle. That is a real graded exposure:
// height, an open edge, a walk she has a reason to make anyway, repeatable
// twice a day without costing her a minute. No list I write will ever contain
// it, because it exists on one campus in Nashville.
//
// So when she reports doing something like that, it is kept. The app learns the
// instance from her and can name it back, which is the difference between a
// ladder she is given and one she is building.

export type Track = "heights" | "bridges" | "driving";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureLearnedTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS learned_exposures (
      id       SERIAL PRIMARY KEY,
      label    TEXT NOT NULL UNIQUE,
      detail   TEXT NOT NULL,
      track    TEXT NOT NULL DEFAULT 'heights',
      reps     INT  NOT NULL DEFAULT 0,
      target   INT  NOT NULL DEFAULT 5,
      last_at  TIMESTAMPTZ
    )
  `;
}

export interface Learned {
  id: number;
  label: string;
  detail: string;
  track: Track;
  reps: number;
  target: number;
  lastAt: string | null;
}

function row(r: unknown): Learned {
  const x = r as Record<string, unknown>;
  return {
    id: Number(x.id),
    label: String(x.label),
    detail: String(x.detail),
    track: String(x.track) as Track,
    reps: Number(x.reps),
    target: Number(x.target),
    lastAt: x.last_at ? String(x.last_at) : null,
  };
}

export async function learnedList(): Promise<Learned[]> {
  await ensureLearnedTable();
  const sql = db();
  return (await sql`SELECT * FROM learned_exposures ORDER BY id`).map(row);
}

/**
 * Keep one, and count the times she has already done it.
 *
 * Reporting it is itself evidence it happened, so the reps go up on the same
 * call. A list that records the discovery and not the doing would have her
 * logging the same thing twice.
 */
export async function learn(
  label: string,
  detail: string,
  track: Track,
  times = 1,
): Promise<Learned> {
  await ensureLearnedTable();
  const sql = db();
  const rows = await sql`
    INSERT INTO learned_exposures (label, detail, track, reps, last_at)
    VALUES (${label}, ${detail}, ${track}, ${times}, NOW())
    ON CONFLICT (label) DO UPDATE SET
      reps = learned_exposures.reps + ${times},
      detail = COALESCE(NULLIF(EXCLUDED.detail, ''), learned_exposures.detail),
      last_at = NOW()
    RETURNING *
  `;
  return row(rows[0]);
}

/** Drop one, for when it was misread or she is done with it. */
export async function forget(label: string): Promise<boolean> {
  await ensureLearnedTable();
  const sql = db();
  const needle = `%${label.trim().toLowerCase()}%`;
  const rows = await sql`
    DELETE FROM learned_exposures WHERE lower(label) LIKE ${needle} RETURNING id
  `;
  return rows.length > 0;
}

/**
 * The one to put in front of her today.
 *
 * Least recently done first, among those not yet at target. Something she did
 * this morning is not the thing to suggest this afternoon, and the one she has
 * been quietly avoiding for three weeks is.
 */
export async function nextLearned(): Promise<Learned | null> {
  await ensureLearnedTable();
  const sql = db();
  const rows = await sql`
    SELECT * FROM learned_exposures
    WHERE reps < target
    ORDER BY last_at ASC NULLS FIRST, id ASC
    LIMIT 1
  `;
  return rows.length ? row(rows[0]) : null;
}
