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
      kind       TEXT NOT NULL DEFAULT 'anchor',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Added after the fact; an existing table from the first version has no kind.
  await sql`ALTER TABLE driving_places ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'anchor'`;
  // Her actual bridges, by name, in her order of difficulty.
  //
  // In the database rather than in this file for the same reason her address
  // is: "the bridge that gets me home" is a road name plus a fact about where
  // she lives, and this repository is public.
  await sql`
    CREATE TABLE IF NOT EXISTS driving_bridges (
      id          SERIAL PRIMARY KEY,
      label       TEXT NOT NULL,
      note        TEXT,
      rank        INT NOT NULL DEFAULT 0,
      done_before BOOLEAN NOT NULL DEFAULT FALSE,
      reps        INT NOT NULL DEFAULT 0,
      target      INT NOT NULL DEFAULT 3,
      last_at     TIMESTAMPTZ
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

/**
 * A place, either an anchor or somewhere worth driving to.
 *
 * Anchors are home and work — the two fixed points every route is measured
 * from. Destinations are the rest: the mall, the cinema, a coffee place across
 * town. They exist because "a weekend drive somewhere you actually want to go"
 * is not a rung anyone can act on until there is a list of somewheres.
 */
export interface Place { key: string; label: string; address: string; kind: "anchor" | "destination" }

export async function places(): Promise<Place[]> {
  await ensureDrivingTables();
  const sql = db();
  const rows = await sql`SELECT key, label, address, kind FROM driving_places ORDER BY kind, label`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      key: String(x.key), label: String(x.label), address: String(x.address),
      kind: (x.kind as string) === "destination" ? "destination" : "anchor",
    };
  });
}

export async function setPlace(
  key: string, label: string, address: string, kind: "anchor" | "destination" = "anchor",
): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`
    INSERT INTO driving_places (key, label, address, kind, updated_at)
    VALUES (${key}, ${label}, ${address}, ${kind}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      label = EXCLUDED.label, address = EXCLUDED.address,
      kind = EXCLUDED.kind, updated_at = NOW()
  `;
}

export async function removePlace(key: string): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`DELETE FROM driving_places WHERE key = ${key}`;
}

/**
 * Both routes to a destination: the one that avoids highways and the one that
 * doesn't.
 *
 * Shown side by side on purpose. The difference between them is the ladder —
 * same place, same car, and the only thing that changed is how close the road
 * gets to an interstate.
 */
export function routePair(from: string, to: string): { easy: string; harder: string } {
  return {
    easy: routeLink(from, to),
    harder: routeLink(from, to, { avoidHighways: false }),
  };
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
 * Driving, graded by how close the route gets to a highway.
 *
 * The first version of this ladder started at "sit in the car, engine running"
 * and "drive around the block". She drives to work every day and to Target at
 * the weekend; those rungs were built for someone who does not drive, and
 * handing them to someone who does is both useless and a bit insulting.
 *
 * The real variable is hers: same destination, different route, graded by
 * proximity to an interstate. Not on it, near it — being alongside a highway is
 * its own fear and is usually left out of a ladder entirely. So the order runs
 * surface streets, then parallel, then over, then under, then the ramp without
 * taking it, and only then one exit.
 *
 * Destinations are deliberately things she would want to reach anyway. A drive
 * that ends at a cinema is a drive she will take twice.
 */
export const DRIVING: Rung[] = [
  { id: "d-fun-surface", track: "driving", target: 3,
    title: "A weekend drive somewhere you actually want to go — mall, cinema, coffee — surface streets only",
    why: "You drive every day. What you don't do is drive somewhere for the pleasure of it. Pick one place and go three times; the third trip is a different experience from the first." },
  { id: "d-fun-second", track: "driving", target: 2,
    title: "The same place, a different surface route",
    why: "Known destination, unknown roads. Only one variable changes, which is the whole trick." },
  { id: "d-further", track: "driving", target: 3,
    title: "Somewhere further out, still no interstate",
    why: "Longer time in the car on roads of the same kind. Distance, with nothing else new." },
  { id: "d-parallel", track: "driving", target: 3,
    title: "A route that runs alongside a highway for a stretch",
    why: "Being next to one is its own thing, separate from being on it. This is the rung that is usually skipped, and it is the one you named." },
  { id: "d-overpass", track: "driving", target: 3,
    title: "A route that crosses over a highway on an overpass",
    why: "Above the traffic, briefly, with a rail either side. Bridge, height and highway in about eight seconds — and you can pick one on a road you already know." },
  { id: "d-under", track: "driving", target: 2,
    title: "A route that passes underneath a highway",
    why: "Same proximity, no height. Worth doing if the overpass is the part that bites." },
  { id: "d-ramp-look", track: "driving", target: 2,
    title: "Drive to an interstate on-ramp, then turn away from it",
    why: "All the approach, none of the merge. The point is to be at the thing and choose, rather than avoiding the whole area." },
  { id: "d-one-exit", track: "driving", target: 3,
    title: "One interstate exit, off-peak — on and straight back off",
    why: "The shortest possible version. Sunday morning, light traffic, stay in the right lane the entire time." },
  { id: "d-few-exits", track: "driving", target: 3,
    title: "Two or three exits, off-peak",
    why: "Merge, stay right, exit. Everything after this is just more of the same." },
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


// ── The small ones, on days she is already having ────────────────────────────
//
// Her words: "these are things that go missing or I forget to do." That is not
// a motivation problem, it is a delivery problem. A ladder on a page she has to
// open is a ladder she opens on the days she was going to do the work anyway.
//
// So these ride along in the weekday morning text instead. Every one of them
// attaches to something already happening — arriving at work, parking, going
// up to her floor, driving home — and none takes more than a couple of minutes.
// The lift is hers, not a substitution: she named it, so it stays, rather than
// being swapped for the stairs because a ladder somewhere says stairs are
// harder.
//
// They rotate by date so the same one does not arrive five days running and
// stop being read.

export const MICRO_EXPOSURES: string[] = [
  "Park one level higher than you need to.",
  "Take the lift to the highest floor you can reach, then come back down.",
  "Stand at an upper-floor window and look down, not out. Thirty seconds.",
  "Park high, then walk to the outside wall of that level before you go in.",
  "Take the lift rather than the stairs, and ride one floor past yours.",
  "On the way home, take the route that crosses over the highway rather than under.",
  "Stand at the garage rail on your way to the car. Count to thirty before you get in.",
];

/**
 * Today's small one.
 *
 * Keyed off the date rather than chosen at random, so opening the text twice
 * shows the same thing and a week does not repeat one three times.
 */
export function microExposureFor(dateStr: string): string {
  const seed = dateStr.split("-").reduce((n, p) => n * 31 + Number(p), 11);
  return MICRO_EXPOSURES[seed % MICRO_EXPOSURES.length];
}


// ── Her bridges ──────────────────────────────────────────────────────────────
//
// The generic bridge rungs are a method: walk one, ride one as a passenger,
// drive the easiest, drive a harder one. They cannot name a bridge, because the
// code does not know her city and must not guess at it.
//
// These rows are the bridges themselves, in the order she puts them. They carry
// one flag the generic rungs do not: whether she has driven it before.
//
// That distinction does more work than it looks like. She has driven the
// Charlotte overpass alone and has crossed the Clarksville Pike bridge in the
// past; both lapsed when she moved and her daily route stopped including them.
// Regaining a crossing is not the same task as attempting one for the first
// time — the evidence that she can already do it exists, and a ladder that
// treats it as new throws that away.

export interface Bridge {
  id: number;
  label: string;
  note: string | null;
  rank: number;
  doneBefore: boolean;
  reps: number;
  target: number;
  lastAt: string | null;
}

export async function bridges(): Promise<Bridge[]> {
  await ensureDrivingTables();
  const sql = db();
  const rows = await sql`SELECT * FROM driving_bridges ORDER BY rank, id`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      id: Number(x.id),
      label: String(x.label),
      note: (x.note as string) ?? null,
      rank: Number(x.rank),
      doneBefore: Boolean(x.done_before),
      reps: Number(x.reps),
      target: Number(x.target),
      lastAt: x.last_at ? new Date(x.last_at as string).toISOString() : null,
    };
  });
}

export async function addBridge(b: {
  label: string; note?: string | null; rank?: number; doneBefore?: boolean; target?: number;
}): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`
    INSERT INTO driving_bridges (label, note, rank, done_before, target)
    VALUES (${b.label}, ${b.note ?? null}, ${b.rank ?? 0}, ${b.doneBefore ?? false}, ${b.target ?? 3})
  `;
}

export async function logBridge(id: number): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`UPDATE driving_bridges SET reps = reps + 1, last_at = NOW() WHERE id = ${id}`;
}

export async function removeBridge(id: number): Promise<void> {
  await ensureDrivingTables();
  const sql = db();
  await sql`DELETE FROM driving_bridges WHERE id = ${id}`;
}

/** The one to drive next: lowest-ranked that still has reps owing. */
export function nextBridge(list: Bridge[]): Bridge | null {
  return list.find(b => b.reps < b.target) ?? null;
}

/**
 * How to introduce a crossing in a text.
 *
 * A bridge she has driven before gets said so. It is the difference between
 * being asked to do something and being asked to do something again.
 */
export function bridgeLine(b: Bridge): string {
  const left = b.target - b.reps;
  const past = b.doneBefore ? "You have driven this one before. " : "";
  return `${past}${b.label}${b.note ? ` — ${b.note}` : ""}. ${left} more to make it ordinary again.`;
}
