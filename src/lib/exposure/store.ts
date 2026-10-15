import { neonClient } from "@/lib/neon";
import type { TrackKey } from "@/lib/exposure/rungs";

// Where each track stands, and every rep she has logged.
//
// Three things per track, exactly as she asked: which rung, how many clean reps
// on it, and when the last rep was. Everything the engine decides is derived
// from those three plus the logs, so there is no second copy of the truth to
// drift.
//
// Clean means finished and the scary thing did not happen. Peak is not part of
// it. A rep she got through at ninety out of a hundred still counts, and that
// is the whole point of scoring it this way.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureExposureTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS exp_track (
      track       TEXT PRIMARY KEY,
      rung        TEXT NOT NULL,
      clean_reps  INT  NOT NULL DEFAULT 0,
      last_rep_on DATE,
      last_rotated TEXT,
      warming_up  BOOLEAN NOT NULL DEFAULT false
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS exp_log (
      id        SERIAL PRIMARY KEY,
      on_date   DATE NOT NULL,
      track     TEXT NOT NULL,
      rung      TEXT NOT NULL,
      before_n  INT,
      peak_n    INT,
      after_n   INT,
      happened  BOOLEAN,
      skipped   TEXT,
      counted   BOOLEAN NOT NULL DEFAULT true,
      logged_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS exp_prediction (
      id        SERIAL PRIMARY KEY,
      on_date   DATE NOT NULL,
      value     INT NOT NULL,
      used      BOOLEAN NOT NULL DEFAULT false,
      logged_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS exp_setting (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS exp_off_day (
      on_date DATE PRIMARY KEY
    )
  `;
}

// ── Settings ─────────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = {
  comfortFloor: "3",
  usualDeck: "1",
  monDeck: "",       // blank until the first Monday sets it from usualDeck + 1
  monFloor: "",      // blank until the first Monday sets it from comfortFloor + 2
  therapistOk: "0",
};

export async function getSetting(key: string): Promise<string> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`SELECT value FROM exp_setting WHERE key = ${key}`;
  return rows.length ? String((rows[0] as Record<string, unknown>).value) : (DEFAULTS[key] ?? "");
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureExposureTables();
  const sql = db();
  await sql`
    INSERT INTO exp_setting (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export interface Settings {
  comfortFloor: number;
  usualDeck: number;
  monDeck: number | null;
  monFloor: number | null;
  therapistOk: boolean;
}

export async function settings(): Promise<Settings> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`SELECT key, value FROM exp_setting`;
  const got = new Map(rows.map(r => {
    const x = r as Record<string, unknown>;
    return [String(x.key), String(x.value)];
  }));
  const read = (k: string) => got.get(k) ?? DEFAULTS[k] ?? "";
  const n = (k: string) => {
    const v = read(k);
    return v === "" ? null : Number(v);
  };
  return {
    comfortFloor: n("comfortFloor") ?? 3,
    usualDeck: n("usualDeck") ?? 1,
    monDeck: n("monDeck"),
    monFloor: n("monFloor"),
    therapistOk: read("therapistOk") === "1",
  };
}

// ── Track state ──────────────────────────────────────────────────────────────

export interface TrackState {
  track: TrackKey;
  rung: string;
  cleanReps: number;
  lastRepOn: string | null;
  lastRotated: string | null;
  warmingUp: boolean;
}

const FIRST_RUNG: Record<TrackKey, string> = {
  A: "A1", B: "B1", C: "C1", DMON: "MON1", DTHU: "T1",
};

function stateRow(r: unknown): TrackState {
  const x = r as Record<string, unknown>;
  return {
    track: String(x.track) as TrackKey,
    rung: String(x.rung),
    cleanReps: Number(x.clean_reps ?? 0),
    lastRepOn: x.last_rep_on ? String(x.last_rep_on).slice(0, 10) : null,
    lastRotated: (x.last_rotated as string) ?? null,
    warmingUp: Boolean(x.warming_up),
  };
}

export async function trackState(track: TrackKey): Promise<TrackState> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    INSERT INTO exp_track (track, rung) VALUES (${track}, ${FIRST_RUNG[track]})
    ON CONFLICT (track) DO UPDATE SET track = EXCLUDED.track
    RETURNING *
  `;
  return stateRow(rows[0]);
}

export async function allTracks(): Promise<Record<TrackKey, TrackState>> {
  const keys: TrackKey[] = ["A", "B", "C", "DMON", "DTHU"];
  const out = {} as Record<TrackKey, TrackState>;
  for (const k of keys) out[k] = await trackState(k);
  return out;
}

export async function saveTrack(s: Partial<TrackState> & { track: TrackKey }): Promise<void> {
  await ensureExposureTables();
  const sql = db();
  const cur = await trackState(s.track);
  const next = { ...cur, ...s };
  await sql`
    UPDATE exp_track SET
      rung = ${next.rung},
      clean_reps = ${next.cleanReps},
      last_rep_on = ${next.lastRepOn},
      last_rotated = ${next.lastRotated},
      warming_up = ${next.warmingUp}
    WHERE track = ${s.track}
  `;
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export interface RepLog {
  onDate: string;
  track: TrackKey;
  rung: string;
  before: number | null;
  peak: number | null;
  after: number | null;
  happened: boolean | null;
  skipped: string | null;
  /** Monday drives are logged and never counted, so they never advance A. */
  counted: boolean;
}

function logRow(r: unknown): RepLog {
  const x = r as Record<string, unknown>;
  return {
    onDate: String(x.on_date).slice(0, 10),
    track: String(x.track) as TrackKey,
    rung: String(x.rung),
    before: x.before_n == null ? null : Number(x.before_n),
    peak: x.peak_n == null ? null : Number(x.peak_n),
    after: x.after_n == null ? null : Number(x.after_n),
    happened: x.happened == null ? null : Boolean(x.happened),
    skipped: (x.skipped as string) ?? null,
    counted: Boolean(x.counted),
  };
}

export async function addLog(l: RepLog): Promise<void> {
  await ensureExposureTables();
  const sql = db();
  await sql`
    INSERT INTO exp_log (on_date, track, rung, before_n, peak_n, after_n, happened, skipped, counted)
    VALUES (${l.onDate}, ${l.track}, ${l.rung}, ${l.before}, ${l.peak}, ${l.after},
            ${l.happened}, ${l.skipped}, ${l.counted})
  `;
}

/** Every rep on one track, newest first. */
export async function logsFor(track: TrackKey, limit = 40): Promise<RepLog[]> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM exp_log WHERE track = ${track} AND skipped IS NULL
    ORDER BY on_date DESC, id DESC LIMIT ${limit}
  `;
  return rows.map(logRow);
}

export async function logsBetween(from: string, to: string): Promise<RepLog[]> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM exp_log WHERE on_date >= ${from} AND on_date <= ${to}
    ORDER BY on_date ASC, id ASC
  `;
  return rows.map(logRow);
}

/** Has this rung ever been done clean? Used to gate A4 behind T1. */
export async function everClean(track: TrackKey, rung: string): Promise<boolean> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    SELECT 1 FROM exp_log
    WHERE track = ${track} AND rung = ${rung} AND happened = false AND skipped IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

// ── Predictions ──────────────────────────────────────────────────────────────

export async function addPrediction(onDate: string, value: number): Promise<void> {
  await ensureExposureTables();
  const sql = db();
  await sql`INSERT INTO exp_prediction (on_date, value) VALUES (${onDate}, ${value})`;
}

/**
 * The prediction waiting to be attached to a rep.
 *
 * Oldest unused one from today, because she texts p before each rep and may do
 * two in a day. Marking it used as it is consumed keeps the second rep from
 * borrowing the first one's number.
 */
export async function takePrediction(onDate: string): Promise<number | null> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`
    UPDATE exp_prediction SET used = true
    WHERE id = (
      SELECT id FROM exp_prediction
      WHERE on_date = ${onDate} AND used = false
      ORDER BY id ASC LIMIT 1
    )
    RETURNING value
  `;
  return rows.length ? Number((rows[0] as Record<string, unknown>).value) : null;
}

// ── Off days ─────────────────────────────────────────────────────────────────

export async function markOff(onDate: string): Promise<void> {
  await ensureExposureTables();
  const sql = db();
  await sql`INSERT INTO exp_off_day (on_date) VALUES (${onDate}) ON CONFLICT DO NOTHING`;
}

export async function isOff(onDate: string): Promise<boolean> {
  await ensureExposureTables();
  const sql = db();
  const rows = await sql`SELECT 1 FROM exp_off_day WHERE on_date = ${onDate}`;
  return rows.length > 0;
}

// ── The line that waits for the next text ────────────────────────────────────
//
// "Moving up, add to that track's next text." So the sentence is written down
// when the rung changes and read back the next time that track speaks, rather
// than being sent on its own or lost. Read once, then gone.

export async function queueLine(track: TrackKey, line: string): Promise<void> {
  await setSetting(`pendingLine:${track}`, line);
}

export async function takeLine(track: TrackKey): Promise<string | null> {
  const line = await getSetting(`pendingLine:${track}`);
  if (!line) return null;
  await setSetting(`pendingLine:${track}`, "");
  return line;
}
