import { neonClient } from "@/lib/neon";

// Driving and heights, built around where she actually is.
//
// The old ladder was generic — "drive around the block", "drive a familiar
// 15-minute route". Fine as a template, useless as a plan, because it knows
// nothing about her two fixed points or the two things she is actually afraid
// of. She has said it plainly: bridges and heights, no interstates, and
// unfamiliar roads are their own problem.
//
// Three things follow from that, and they shape everything here.
//
// First, the addresses live in the database and never in this file. The
// repository is public.
//
// Second, every route link carries avoid=highways. She does not take
// interstates, and a plan that hands her a route which merges onto one is a
// plan she will quietly stop opening. Google works out the roads; this file
// never guesses at local geography it cannot verify.
//
// Third, unfamiliar roads are not a rung to climb past — they are a property
// that goes away with repetition. So a new route is driven three times before
// it counts, rather than being swapped for a different new route each week.
// Three drives on one road makes it familiar. One drive each on three roads
// makes three roads she is still afraid of.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureDrivingTables() {
  const sql = db();
  // Addresses are settings, not content. They sit here rather than in code
  // because this repository is public and a home address does not belong in it.
  await sql`
    CREATE TABLE IF NOT EXISTS driving_places (
      key        TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      address    TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS driving_progress (
      rung       TEXT PRIMARY KEY,
      reps       INT NOT NULL DEFAULT 0,
      last_at    TIMESTAMPTZ,
      best_peak  INT
    )
  `;
}

export interface Place { key: string; label: string; address: string }

export async function places(): Promise<Place[]> {
  await ensureDrivingTables();
  const sql = db();
  const rows = await sql`SELECT key, label, address FROM driving_places ORDER BY key`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return { key: String(x.key), label: String(x.label), address: String(x.address) };
  });
}

export async function setPlace(key: string, label: string, address: string): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`
    INSERT INTO driving_places (key, label, address, updated_at)
    VALUES (${key}, ${label}, ${address}, NOW())
    ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, address = EXCLUDED.address, updated_at = NOW()
  `;
}

/**
 * A Google Maps directions link that never routes her onto an interstate.
 *
 * Uses the documented Maps URL scheme rather than an API, so there is no key,
 * no quota, and nothing of hers is sent anywhere by this application — the link
 * only does something when she taps it.
 */
export function routeLink(from: string, to: string, opts?: { avoidHighways?: boolean }): string {
  const p = new URLSearchParams({
    api: "1",
    origin: from,
    destination: to,
    travelmode: "driving",
  });
  if (opts?.avoidHighways !== false) p.set("avoid", "highways|tolls");
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

/** A link that just shows a place, for the ones she is working up to looking at. */
export function placeLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// ── The ladders ──────────────────────────────────────────────────────────────

export type Track = "driving" | "bridges" | "heights";

export interface Rung {
  id: string;
  track: Track;
  title: string;
  /** Why this one comes here, and what makes it different from the last. */
  why: string;
  /** How many times it must be done before it counts as done. */
  target: number;
  /** Fill from her saved places at render time; never hardcoded. */
  route?: { from: string; to: string };
}

/**
 * Driving, on surface streets only.
 *
 * The rungs are about who is in the car, how well she knows the road, how much
 * traffic, and how much light — not about distance. Distance is the thing a
 * phobia ladder gets wrong most often: a long drive on a road she knows is
 * easier than a short one she doesn't.
 */
export const DRIVING: Rung[] = [
  { id: "d-sit", track: "driving", target: 1,
    title: "Sit in the car on the drive, engine running, five minutes",
    why: "No destination, no decision. Just the inside of the car being an ordinary place again." },
  { id: "d-block", track: "driving", target: 3,
    title: "Around the block and home",
    why: "Short enough that stopping isn't a failure. Three times, not once — the point is that it stops being an event." },
  { id: "d-work-known", track: "driving", target: 3, route: { from: "home", to: "work" },
    title: "Home to work, surface streets, the way you always go",
    why: "The road you know best in the city. This is the baseline everything else is measured against." },
  { id: "d-work-return", track: "driving", target: 3, route: { from: "work", to: "home" },
    title: "Work to home, same roads, after a shift",
    why: "Tired is a different driver. Same road, harder conditions." },
  { id: "d-errand", track: "driving", target: 3,
    title: "One errand you'd normally put off — groceries, the pharmacy",
    why: "A real reason to be in the car. Exposure that buys you something." },
  { id: "d-newroad", track: "driving", target: 3,
    title: "One new surface-street route — the same one, three times",
    why: "Unfamiliar is not a rung to climb past. It wears off with repetition. Three drives on one road beats one drive on three." },
  { id: "d-traffic", track: "driving", target: 2,
    title: "A road you know, at a busy hour",
    why: "Traffic, with everything else held constant." },
  { id: "d-dark", track: "driving", target: 2,
    title: "A road you know, after dark",
    why: "Less light, nothing else new." },
  { id: "d-far", track: "driving", target: 2,
    title: "Thirty minutes out and back, surface streets",
    why: "Distance, last — and still no interstate." },
];

/**
 * Bridges, as their own track.
 *
 * She says she can "kind of do some", which means this is not a fear to be
 * started from zero. It is a fear with a working edge, and the useful question
 * is what makes one bridge harder than another: height over the water, length,
 * how much of the rail she can see, whether she can stop.
 *
 * The first rung is deliberately not driving. Nashville has a pedestrian bridge
 * over the Cumberland, and walking it is bridge exposure and height exposure at
 * the same time, with no steering, no traffic, and the ability to stop in the
 * middle — which is exactly the thing a car takes away.
 */
export const BRIDGES: Rung[] = [
  { id: "b-walk", track: "bridges", target: 3,
    title: "Walk a pedestrian bridge over the river, all the way across",
    why: "Bridge and height at once, with no car. You can stop in the middle, which is the one thing driving never lets you do. Nashville's pedestrian bridge over the Cumberland is the obvious one — check it on the map first." },
  { id: "b-walk-look", track: "bridges", target: 3,
    title: "Same walk, stop in the middle and look down for a slow count of thirty",
    why: "The looking is the exposure. Crossing while not looking teaches you that you got away with it." },
  { id: "b-passenger", track: "bridges", target: 2,
    title: "Cross a short bridge as a passenger",
    why: "The route and the height without the steering. Ask whoever's driving to take the same one twice." },
  { id: "b-known-quiet", track: "bridges", target: 3,
    title: "Drive the shortest bridge you already know, off-peak, daylight",
    why: "Your easiest bridge, at its easiest hour. Three times, so it becomes a road rather than an attempt." },
  { id: "b-known-busy", track: "bridges", target: 2,
    title: "Same bridge, ordinary traffic",
    why: "Traffic means you can't choose your speed. Same crossing otherwise." },
  { id: "b-longer", track: "bridges", target: 3,
    title: "A longer bridge you've crossed before as a passenger",
    why: "Longer means more time up there with nowhere to pull over. Pick one you've already seen from the passenger seat." },
  { id: "b-new", track: "bridges", target: 3,
    title: "A bridge you haven't driven, scouted on the map first",
    why: "Look at it on street view before you go. Knowing the shape of it removes the part of the fear that's just not knowing." },
];

/**
 * Heights, folded into days she is already having.
 *
 * She asked for this specifically — ways to work on heights without carving out
 * a separate activity. All of these are things that happen anyway: parking,
 * going to work, crossing the river. The only change is doing them one floor
 * higher, or looking out instead of away.
 */
export const HEIGHTS: Rung[] = [
  { id: "h-garage-2", track: "heights", target: 3,
    title: "Park one level higher than you need to",
    why: "You are already parking. The only change is the level. Add one more when it stops registering." },
  { id: "h-garage-edge", track: "heights", target: 3,
    title: "On that level, walk to the outside wall and look out for thirty seconds",
    why: "Parking high and walking straight to the lift is avoidance wearing a costume." },
  { id: "h-stairs", track: "heights", target: 5,
    title: "Take the stairs at work instead of the lift, at least two flights",
    why: "Open stairwells, the gap down the middle, a railing you can see through. Free, daily, nobody notices." },
  { id: "h-window", track: "heights", target: 5,
    title: "Stand at an upper-floor window and look down, not out",
    why: "Thirty seconds. Looking out at the skyline is not the same exposure as looking straight down." },
  { id: "h-window-high", track: "heights", target: 3,
    title: "The same, from the highest floor you can get to",
    why: "Same action, more height. The action being identical is what makes the height the variable." },
  { id: "h-bridge-rail", track: "heights", target: 3,
    title: "On the pedestrian bridge, stand at the rail rather than the middle",
    why: "Shares a rung with the bridge track on purpose. Two fears, one walk." },
  { id: "h-overlook", track: "heights", target: 2,
    title: "Drive to an overlook on surface streets and stand at the edge",
    why: "Driving and height in one trip, no interstate. The drive is the warm-up, the standing is the work." },
];

export const ALL_RUNGS: Rung[] = [...DRIVING, ...BRIDGES, ...HEIGHTS];

export interface RungState { rung: string; reps: number; lastAt: string | null; bestPeak: number | null }

export async function progressRows(): Promise<RungState[]> {
  await ensureDrivingTables();
  const sql = db();
  const rows = await sql`SELECT rung, reps, last_at, best_peak FROM driving_progress`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      rung: String(x.rung),
      reps: Number(x.reps),
      lastAt: x.last_at ? new Date(x.last_at as string).toISOString() : null,
      bestPeak: x.best_peak == null ? null : Number(x.best_peak),
    };
  });
}

/** Record one rep of a rung, keeping the lowest peak anxiety seen on it. */
export async function logRep(rung: string, peak?: number | null): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`
    INSERT INTO driving_progress (rung, reps, last_at, best_peak)
    VALUES (${rung}, 1, NOW(), ${peak ?? null})
    ON CONFLICT (rung) DO UPDATE SET
      reps = driving_progress.reps + 1,
      last_at = NOW(),
      best_peak = LEAST(COALESCE(driving_progress.best_peak, 100), COALESCE(${peak ?? null}, 100))
  `;
}

export type LiveRung = Rung & {
  /** Reps completed so far, against Rung.target. */
  done: number;
  complete: boolean;
  current: boolean;
  link: string | null;
};

export interface TrackView {
  track: Track;
  rungs: LiveRung[];
  doneCount: number;
  current: LiveRung | null;
}

/**
 * The three tracks, with the current rung on each.
 *
 * They advance independently. Bridges and heights are not harder versions of
 * driving — they are different fears that happen to overlap, and holding one
 * back until the other finishes would stall both.
 */
export function buildTracks(state: RungState[], placeList: Place[]): TrackView[] {
  const byRung = new Map(state.map(s => [s.rung, s]));
  const byKey = new Map(placeList.map(p => [p.key, p]));

  return (["driving", "bridges", "heights"] as Track[]).map(track => {
    const rungs = ALL_RUNGS.filter(r => r.track === track);
    let currentFound = false;

    const out = rungs.map(r => {
      const done = byRung.get(r.id)?.reps ?? 0;
      const complete = done >= r.target;
      const current = !complete && !currentFound;
      if (current) currentFound = true;

      let link: string | null = null;
      if (r.route) {
        const from = byKey.get(r.route.from);
        const to = byKey.get(r.route.to);
        if (from && to) link = routeLink(from.address, to.address);
      }
      return { ...r, done, complete, current, link };
    });

    return {
      track,
      rungs: out,
      doneCount: out.filter(r => r.complete).length,
      current: out.find(r => r.current) ?? null,
    };
  });
}

export const TRACK_LABEL: Record<Track, string> = {
  driving: "Driving",
  bridges: "Bridges",
  heights: "Heights",
};
