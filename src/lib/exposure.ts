import { neonClient } from "@/lib/neon";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export type Phobia = "driving" | "heights";

export async function ensureExposureTables() {
  const sql = db();
  // Fear ladder: the graded steps, per phobia
  await sql`
    CREATE TABLE IF NOT EXISTS ladder_steps (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      phobia     TEXT NOT NULL,
      title      TEXT NOT NULL,
      detail     TEXT,
      sud        INTEGER NOT NULL DEFAULT 50,
      position   INTEGER NOT NULL DEFAULT 0,
      reps       INTEGER NOT NULL DEFAULT 0,
      mastered   BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Saved routes she trusts, with the constraints that matter to her
  await sql`
    CREATE TABLE IF NOT EXISTS routes (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name        TEXT NOT NULL,
      origin      TEXT NOT NULL,
      destination TEXT NOT NULL,
      no_highway  BOOLEAN NOT NULL DEFAULT true,
      no_bridge   BOOLEAN NOT NULL DEFAULT true,
      minutes     INTEGER,
      notes       TEXT,
      times_driven INTEGER NOT NULL DEFAULT 0,
      last_driven TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Every practice session — the data behind the habituation curve
  await sql`
    CREATE TABLE IF NOT EXISTS exposure_sessions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      phobia     TEXT NOT NULL,
      step_id    TEXT,
      route_id   TEXT,
      label      TEXT NOT NULL,
      sud_before INTEGER,
      sud_peak   INTEGER,
      sud_after  INTEGER,
      minutes    INTEGER,
      panic      BOOLEAN NOT NULL DEFAULT false,
      avoided    BOOLEAN NOT NULL DEFAULT false,
      notes      TEXT,
      done_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Weekly reflection
  await sql`
    CREATE TABLE IF NOT EXISTS exposure_checkins (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      week_of     TEXT NOT NULL UNIQUE,
      wins        TEXT,
      hardest     TEXT,
      avoided     TEXT,
      next_target TEXT,
      confidence  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ─── Ladder ──────────────────────────────────────────────────────────────────

const SEED_DRIVING = [
  ["Sit in the parked car, engine off, 5 minutes", "Keys in hand. Just sit and breathe.", 15],
  ["Drive around the block, daylight, no passengers", "One loop. Home before you can talk yourself out.", 25],
  ["Drive to the gym at 5:15am", "Empty roads — the easiest real drive of your week.", 30],
  ["Drive a familiar 15-minute route, surface streets", "The extended way home on Mondays.", 40],
  ["Drive somewhere new using only surface streets", "Navigation on, no highway, no bridge.", 50],
  ["Drive in moderate traffic, surface streets", "Rush hour on roads you know.", 60],
  ["Drive at night on a familiar route", "Same route, less light.", 65],
  ["Drive over a short bridge with a passenger", "Someone in the passenger seat. One crossing.", 75],
  ["Drive over the same bridge alone", "The step that makes the map open back up.", 85],
  ["Short interstate stretch, one exit, off-peak", "On and immediately off. Sunday morning.", 90],
  ["Interstate for several exits", "Merge, stay right, exit. Build from there.", 95],
];

const SEED_HEIGHTS = [
  ["Look out a 2nd-floor window", "Stand at the glass for 2 minutes.", 20],
  ["Stand on a stairwell landing, look down the shaft", "At work, on your 10am break.", 30],
  ["Take the stairs to an upper floor and look down", "5 minutes at the rail.", 40],
  ["Stand at a 4th-floor window, feet touching the wall", "Hands off the sill if you can.", 50],
  ["Upper level of a parking garage, walk the edge", "Walk the perimeter once.", 60],
  ["Look over a balcony railing", "Both hands on the rail, look straight down.", 70],
  ["Glass elevator or open stairwell, ride up and look", "Ride it twice.", 80],
  ["Rooftop or observation deck, approach the edge", "Get as close as the rail allows.", 90],
];

export async function seedLadderIfEmpty(): Promise<number> {
  await ensureExposureTables();
  const sql = db();
  const c = await sql`SELECT COUNT(*) AS n FROM ladder_steps`;
  if (Number(c[0]?.n ?? 0) > 0) return 0;
  let n = 0;
  for (const [phobia, rows] of [["driving", SEED_DRIVING], ["heights", SEED_HEIGHTS]] as const) {
    for (let i = 0; i < rows.length; i++) {
      const [title, detail, sud] = rows[i] as [string, string, number];
      await sql`
        INSERT INTO ladder_steps (phobia, title, detail, sud, position)
        VALUES (${phobia}, ${title}, ${detail}, ${sud}, ${i})
      `;
      n++;
    }
  }
  return n;
}

export async function getLadder(phobia?: string) {
  await ensureExposureTables();
  const sql = db();
  const rows = phobia
    ? await sql`SELECT * FROM ladder_steps WHERE phobia = ${phobia} ORDER BY position ASC`
    : await sql`SELECT * FROM ladder_steps ORDER BY phobia ASC, position ASC`;
  return rows.map(r => ({
    id: r.id as string, phobia: r.phobia as string, title: r.title as string,
    detail: (r.detail as string) ?? "", sud: Number(r.sud),
    position: Number(r.position), reps: Number(r.reps), mastered: Boolean(r.mastered),
  }));
}

export async function updateStep(id: string, fields: { reps?: number; mastered?: boolean; sud?: number }) {
  const sql = db();
  if (fields.reps !== undefined) await sql`UPDATE ladder_steps SET reps = ${fields.reps} WHERE id = ${id}`;
  if (fields.mastered !== undefined) await sql`UPDATE ladder_steps SET mastered = ${fields.mastered} WHERE id = ${id}`;
  if (fields.sud !== undefined) await sql`UPDATE ladder_steps SET sud = ${fields.sud} WHERE id = ${id}`;
}

export async function addStep(phobia: string, title: string, detail: string, sud: number) {
  await ensureExposureTables();
  const sql = db();
  const p = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ladder_steps WHERE phobia = ${phobia}`;
  await sql`
    INSERT INTO ladder_steps (phobia, title, detail, sud, position)
    VALUES (${phobia}, ${title}, ${detail}, ${sud}, ${Number(p[0]?.p ?? 0)})
  `;
}

export async function deleteStep(id: string) {
  const sql = db();
  await sql`DELETE FROM ladder_steps WHERE id = ${id}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function getRoutes() {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`SELECT * FROM routes ORDER BY times_driven DESC, created_at DESC`;
  return rows.map(r => ({
    id: r.id as string, name: r.name as string,
    origin: r.origin as string, destination: r.destination as string,
    noHighway: Boolean(r.no_highway), noBridge: Boolean(r.no_bridge),
    minutes: r.minutes === null ? null : Number(r.minutes),
    notes: (r.notes as string) ?? "",
    timesDriven: Number(r.times_driven), lastDriven: (r.last_driven as string) ?? null,
  }));
}

export async function addRoute(r: {
  name: string; origin: string; destination: string;
  noHighway?: boolean; noBridge?: boolean; minutes?: number | null; notes?: string;
}) {
  await ensureExposureTables();
  const sql = db();
  await sql`
    INSERT INTO routes (name, origin, destination, no_highway, no_bridge, minutes, notes)
    VALUES (${r.name}, ${r.origin}, ${r.destination}, ${r.noHighway ?? true},
            ${r.noBridge ?? true}, ${r.minutes ?? null}, ${r.notes ?? ""})
  `;
}

export async function deleteRoute(id: string) {
  const sql = db();
  await sql`DELETE FROM routes WHERE id = ${id}`;
}

export async function markRouteDriven(id: string, date: string) {
  const sql = db();
  await sql`UPDATE routes SET times_driven = times_driven + 1, last_driven = ${date} WHERE id = ${id}`;
}

/** Google Maps directions URL. avoid=highways covers interstates; Google has
 *  no avoid-bridges parameter, so bridge-free routes are ones she saves and
 *  verifies herself — the flag records that knowledge. */
export function mapsUrl(origin: string, destination: string, noHighway: boolean): string {
  const p = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (noHighway) p.set("avoid", "highways|ferries|tolls");
  return `https://www.google.com/maps/dir/?${p}`;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function logSession(s: {
  phobia: string; stepId?: string | null; routeId?: string | null; label: string;
  sudBefore?: number; sudPeak?: number; sudAfter?: number; minutes?: number;
  panic?: boolean; avoided?: boolean; notes?: string;
}) {
  await ensureExposureTables();
  const sql = db();
  await sql`
    INSERT INTO exposure_sessions
      (phobia, step_id, route_id, label, sud_before, sud_peak, sud_after, minutes, panic, avoided, notes)
    VALUES (${s.phobia}, ${s.stepId ?? null}, ${s.routeId ?? null}, ${s.label},
            ${s.sudBefore ?? null}, ${s.sudPeak ?? null}, ${s.sudAfter ?? null},
            ${s.minutes ?? null}, ${s.panic ?? false}, ${s.avoided ?? false}, ${s.notes ?? ""})
  `;
  if (s.stepId) await sql`UPDATE ladder_steps SET reps = reps + 1 WHERE id = ${s.stepId}`;
}

export async function getSessions(limit = 120) {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM exposure_sessions ORDER BY done_at DESC LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id as string, phobia: r.phobia as string, label: r.label as string,
    stepId: (r.step_id as string) ?? null, routeId: (r.route_id as string) ?? null,
    sudBefore: r.sud_before === null ? null : Number(r.sud_before),
    sudPeak: r.sud_peak === null ? null : Number(r.sud_peak),
    sudAfter: r.sud_after === null ? null : Number(r.sud_after),
    minutes: r.minutes === null ? null : Number(r.minutes),
    panic: Boolean(r.panic), avoided: Boolean(r.avoided),
    notes: (r.notes as string) ?? "", doneAt: String(r.done_at),
  }));
}

// ─── Weekly check-in ─────────────────────────────────────────────────────────

export async function saveCheckin(c: {
  weekOf: string; wins?: string; hardest?: string; avoided?: string;
  nextTarget?: string; confidence?: number;
}) {
  await ensureExposureTables();
  const sql = db();
  await sql`
    INSERT INTO exposure_checkins (week_of, wins, hardest, avoided, next_target, confidence)
    VALUES (${c.weekOf}, ${c.wins ?? ""}, ${c.hardest ?? ""}, ${c.avoided ?? ""},
            ${c.nextTarget ?? ""}, ${c.confidence ?? null})
    ON CONFLICT (week_of) DO UPDATE SET
      wins = EXCLUDED.wins, hardest = EXCLUDED.hardest, avoided = EXCLUDED.avoided,
      next_target = EXCLUDED.next_target, confidence = EXCLUDED.confidence
  `;
}

export async function getCheckins(limit = 12) {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`SELECT * FROM exposure_checkins ORDER BY week_of DESC LIMIT ${limit}`;
  return rows.map(r => ({
    weekOf: r.week_of as string, wins: (r.wins as string) ?? "",
    hardest: (r.hardest as string) ?? "", avoided: (r.avoided as string) ?? "",
    nextTarget: (r.next_target as string) ?? "", confidence: r.confidence === null ? null : Number(r.confidence),
  }));
}

// ─── Stats for the dashboard + notifications ─────────────────────────────────

export async function exposureStats() {
  await ensureExposureTables();
  const sql = db();
  const week = await sql`
    SELECT COUNT(*) AS n FROM exposure_sessions WHERE done_at > NOW() - INTERVAL '7 days'
  `;
  const total = await sql`SELECT COUNT(*) AS n FROM exposure_sessions`;
  const mastered = await sql`SELECT COUNT(*) AS n FROM ladder_steps WHERE mastered = true`;
  const steps = await sql`SELECT COUNT(*) AS n FROM ladder_steps`;
  const drop = await sql`
    SELECT AVG(sud_peak - sud_after) AS d FROM exposure_sessions
    WHERE sud_peak IS NOT NULL AND sud_after IS NOT NULL
  `;
  // Consecutive days with at least one session
  const days = await sql`
    SELECT DISTINCT to_char(done_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') AS d
    FROM exposure_sessions ORDER BY d DESC LIMIT 60
  `;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < days.length; i++) {
    const expect = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (days[i]?.d === expect) streak++;
    else break;
  }
  return {
    thisWeek: Number(week[0]?.n ?? 0),
    total: Number(total[0]?.n ?? 0),
    mastered: Number(mastered[0]?.n ?? 0),
    steps: Number(steps[0]?.n ?? 0),
    avgDrop: drop[0]?.d === null ? null : Math.round(Number(drop[0]?.d ?? 0)),
    streak,
  };
}
