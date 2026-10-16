import { neonClient } from "@/lib/neon";
import { nextLearned } from "@/lib/learned";

// Going up, one floor at a time.
//
// Her correction, and it was the right one: heights are available almost
// everywhere. Apartments have upper floors, workplaces have upper floors, car
// parks have levels. The thing that is not available everywhere is the work car
// park and the drive home — not height itself.
//
// So this is not a list of places. It is a number that climbs. Ride up to the
// floor you are on in the ladder, stay there, look down; do that a couple of
// times and the number goes up by one. Whichever building you happen to be in
// that day is a detail.
//
// What this deliberately is not: watching footage of heights, or looking at a
// tall building from the ground. Her words — "I don't want BS like, oh, look at
// a high building, we need to make actual progress." She is right, and the
// standard is the same one the ladders already use: you have to actually be up
// there, and you have to do it more than once.

const PER_FLOOR = 2;   // "a couple times" — her words, and enough to stop it being an attempt

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureHeightTables() {
  const sql = db();
  // One row, because there is one number. A floor is not a place.
  await sql`
    CREATE TABLE IF NOT EXISTS height_progress (
      id       INT PRIMARY KEY DEFAULT 1,
      floor    INT NOT NULL DEFAULT 2,
      reps     INT NOT NULL DEFAULT 0,
      last_at  TIMESTAMPTZ
    )
  `;
  // Buildings she can actually get into, and how high they go. Saved rather
  // than coded: the app cannot know her campus, and a building named in the
  // source is a building named in a public repository.
  await sql`
    CREATE TABLE IF NOT EXISTS height_spots (
      id        SERIAL PRIMARY KEY,
      label     TEXT NOT NULL,
      top_floor INT NOT NULL,
      note      TEXT
    )
  `;
}

export interface Spot { id: number; label: string; topFloor: number; note: string | null }

export async function spots(): Promise<Spot[]> {
  await ensureHeightTables();
  const sql = db();
  const rows = await sql`SELECT * FROM height_spots ORDER BY top_floor ASC, id ASC`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      id: Number(x.id),
      label: String(x.label),
      topFloor: Number(x.top_floor),
      note: (x.note as string) ?? null,
    };
  });
}

export async function addSpot(label: string, topFloor: number): Promise<void> {
  await ensureHeightTables();
  const sql = db();
  await sql`INSERT INTO height_spots (label, top_floor) VALUES (${label}, ${topFloor})`;
}

export interface HeightState {
  floor: number;
  reps: number;
  perFloor: number;
  lastAt: string | null;
}

export async function state(): Promise<HeightState> {
  await ensureHeightTables();
  const sql = db();
  const rows = await sql`
    INSERT INTO height_progress (id) VALUES (1)
    ON CONFLICT (id) DO UPDATE SET id = 1
    RETURNING floor, reps, last_at
  `;
  const x = (rows[0] ?? {}) as Record<string, unknown>;
  return {
    floor: Number(x.floor ?? 2),
    reps: Number(x.reps ?? 0),
    perFloor: PER_FLOOR,
    lastAt: x.last_at ? String(x.last_at) : null,
  };
}

/**
 * Log one trip up.
 *
 * Returns what to say back, including whether the floor just went up — which
 * is the only moment in this ladder that is worth marking.
 */
export async function logTrip(): Promise<{ floor: number; reps: number; advanced: boolean }> {
  const before = await state();
  const sql = db();

  const reps = before.reps + 1;
  if (reps >= PER_FLOOR) {
    await sql`UPDATE height_progress SET floor = ${before.floor + 1}, reps = 0, last_at = NOW() WHERE id = 1`;
    return { floor: before.floor + 1, reps: 0, advanced: true };
  }
  await sql`UPDATE height_progress SET reps = ${reps}, last_at = NOW() WHERE id = 1`;
  return { floor: before.floor, reps, advanced: false };
}

/** Put the ladder back a floor, for when one was logged that shouldn't have been. */
export async function setFloor(floor: number): Promise<void> {
  await ensureHeightTables();
  const sql = db();
  await sql`UPDATE height_progress SET floor = ${Math.max(1, floor)}, reps = 0 WHERE id = 1`;
}

/**
 * Today's step, as a sentence.
 *
 * Names a building when she has saved one that goes high enough, and stays
 * general when she has not — "whatever building you are in" is true everywhere
 * and is the point of doing it by floor number rather than by place.
 */
export function stepText(s: HeightState, available: Spot[]): string {
  const tall = available.filter(p => p.topFloor >= s.floor);
  const left = s.perFloor - s.reps;
  const more = `${left} more at this floor and you go up one.`;

  // She has saved buildings but none of them reach this floor. Saying so is the
  // useful thing: the ladder has outgrown the places it knows about, and the
  // answer is a taller building rather than a harder try.
  if (available.length && !tall.length) {
    const best = available[available.length - 1];
    return (
      `Heights: floor ${s.floor} today, but the tallest you've saved is ` +
      `${best.label} at ${best.topFloor}. Somewhere taller, or text: add building <name>, <floors>`
    );
  }

  const where = tall.length ? ` ${tall[0].label} goes to ${tall[0].topFloor}.` : "";
  return (
    `Heights: floor ${s.floor} today. Lift up, walk the floor, ` +
    `two minutes at a window looking down rather than out.` +
    where +
    ` ${more}`
  );
}

/** Where she is on the climb, for the dashboard. */
export async function heightSummary(): Promise<string> {
  const s = await state();
  return `Floor ${s.floor}, ${s.reps} of ${s.perFloor}`;
}

/**
 * The heights line for today.
 *
 * Prefers one she found herself. A generic "ride up to floor 3 and look out of
 * a window" is a description of an exposure; "the building four crossing" is an
 * exposure — it has a door, a route and a reason to be walking it, and she has
 * already proved she will do it.
 *
 * Falls back to the floor count when she has not reported anything yet, or when
 * everything she has reported is at its target.
 */
export async function dailyHeightLine(): Promise<string | null> {
  const found = await nextLearned().catch(() => null);
  if (found) {
    return `Heights: ${found.label}. ${found.detail} (${found.reps}/${found.target})`;
  }
  const [s, p] = await Promise.all([
    state().catch(() => null),
    spots().catch(() => []),
  ]);
  return s ? stepText(s, p) : null;
}
