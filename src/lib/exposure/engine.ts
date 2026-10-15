import {
  A_RUNGS, A6_POOL, MONDAY_RUNG, B_RUNGS, C_RUNGS, C_POOL, C_WEDNESDAY,
  T_RUNGS, T_POOL, C_STARTS, D_STARTS, DECK_CAP, TITANS_SUNDAYS, DOWNTOWN_RUNGS,
  DUSK_RUNG, DARK_RUNG, SUNSET_BEFORE_MIN, THERAPIST_GATED, A4_NEEDS,
  rungById, type Rung, type TrackKey,
} from "@/lib/exposure/rungs";
import {
  allTracks, saveTrack, settings, setSetting, addLog, logsFor, everClean,
  takePrediction, type TrackState, type Settings,
} from "@/lib/exposure/store";
import { daylight } from "@/lib/daylight";

// Which rung today, and when it moves.
//
// All of the rules live here and nowhere else, so the texts can be read as
// text and the decisions can be read as decisions.
//
// Her rules, in her order:
//   clean  = finished and the scary thing did not happen. Peak is irrelevant.
//   A, C   advance after 3 clean reps. B and Thursday after 1.
//   Monday raises the deck and the floor on a clean Monday. Deck stops at 8.
//   A4 waits for T1. B7 and B8 wait for the light. B9 and B10 wait for her
//          therapist.
//   two "yes" in a row on a rung holds it and says so.
//   7+ days off a track means one rung lower as a warm up, then straight back.
//   nothing else ever moves her down.

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Dow = typeof DOW[number];

export function dowOf(dateStr: string): Dow {
  return DOW[new Date(`${dateStr}T12:00:00`).getDay()];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000,
  );
}

// ── Which days carry which track ─────────────────────────────────────────────

/** A counts on Tue, Thu and Fri. Monday is driven and logged but never counts. */
export function isADay(dateStr: string): boolean {
  return ["mon", "tue", "thu", "fri"].includes(dowOf(dateStr));
}
export function aCounts(dateStr: string): boolean {
  return ["tue", "thu", "fri"].includes(dowOf(dateStr));
}

export function isCDay(dateStr: string): boolean {
  if (dateStr < C_STARTS) return false;
  const d = dowOf(dateStr);
  // D takes Monday and Thursday from the second of November, and C keeps the
  // rest of the working week.
  return dateStr < D_STARTS
    ? ["mon", "tue", "wed", "thu", "fri"].includes(d)
    : ["tue", "wed", "fri"].includes(d);
}

export function isDMonDay(dateStr: string): boolean {
  return dateStr >= D_STARTS && dowOf(dateStr) === "mon";
}
export function isDThuDay(dateStr: string): boolean {
  return dateStr >= D_STARTS && dowOf(dateStr) === "thu";
}

export function isTitansSunday(dateStr: string): boolean {
  return TITANS_SUNDAYS.includes(dateStr);
}

/** Dusk and dark only once the light actually goes early enough. */
export function lightGoesEarly(dateStr: string): boolean {
  const l = daylight(dateStr);
  return !!l && l.sunset < SUNSET_BEFORE_MIN;
}

// ── Picking today's rung ─────────────────────────────────────────────────────

function indexIn(list: { id: string }[], id: string): number {
  return list.findIndex(r => r.id === id);
}

/** One rung lower, for a warm up after a week away. Never below the first. */
function lower(list: { id: string }[], id: string): string {
  const i = indexIn(list, id);
  return i > 0 ? list[i - 1].id : id;
}

/** Pick from a rotation, avoiding whatever was used last. */
function rotate(pool: string[], lastUsed: string | null): string {
  const i = lastUsed ? pool.indexOf(lastUsed) : -1;
  return pool[(i + 1) % pool.length];
}

export interface Today {
  /** The rung she is being asked for, after gating, warm ups and rotation. */
  rung: string;
  text: string;
  link: string | null;
  /** Set when the track is held because the last two reps went badly. */
  rough: boolean;
  /** Set when this one is a warm up rather than the real rung. */
  warmUp: boolean;
}

function warmUpOrReal(
  list: { id: string }[],
  st: TrackState,
  dateStr: string,
): { rung: string; warmUp: boolean } {
  if (!st.lastRepOn) return { rung: st.rung, warmUp: false };
  const gap = daysBetween(st.lastRepOn, dateStr);
  if (gap >= 7) return { rung: lower(list, st.rung), warmUp: true };
  return { rung: st.rung, warmUp: false };
}

async function roughPatch(track: TrackKey, rung: string): Promise<boolean> {
  const recent = (await logsFor(track, 4)).filter(l => l.rung === rung);
  return recent.length >= 2 && recent[0].happened === true && recent[1].happened === true;
}

/** Today's A drive. Monday has its own route and does not touch the ladder. */
export async function todayA(dateStr: string): Promise<Today | null> {
  if (!isADay(dateStr)) return null;
  if (dowOf(dateStr) === "mon") {
    return { rung: MONDAY_RUNG.id, text: MONDAY_RUNG.text, link: MONDAY_RUNG.link, rough: false, warmUp: false };
  }

  const st = (await allTracks()).A;
  let { rung, warmUp } = warmUpOrReal(A_RUNGS, st, dateStr);

  // A4 is held until the Thursday connector walk has gone clean once. Standing
  // on it first is the point: she sees the railing before she drives it.
  if (rung === "A4" && !(await everClean("DTHU", A4_NEEDS))) rung = "A3";

  if (rung === "A6") rung = rotate(A6_POOL, st.lastRotated);

  const r = rungById(A_RUNGS, rung);
  if (!r) return null;
  return { rung, text: r.text, link: r.link, rough: await roughPatch("A", rung), warmUp };
}

export async function todayB(dateStr: string): Promise<Today | null> {
  if (dowOf(dateStr) !== "sun") return null;

  const st = (await allTracks()).B;
  const s = await settings();
  let { rung, warmUp } = warmUpOrReal(B_RUNGS, st, dateStr);

  // Dusk and dark are not available in October. Hold at the rung before rather
  // than sending her out in daylight to do a dusk drive.
  if ((rung === DUSK_RUNG || rung === DARK_RUNG) && !lightGoesEarly(dateStr)) {
    rung = lower(B_RUNGS, rung);
  }
  if (THERAPIST_GATED.includes(rung) && !s.therapistOk) {
    rung = lower(B_RUNGS, rung);
  }
  // Game day downtown. Repeat the last clean rung and keep the new one for the
  // Sunday after, so a closed city does not cost her a rung.
  if (isTitansSunday(dateStr) && DOWNTOWN_RUNGS.includes(rung)) {
    const lastClean = (await logsFor("B", 20)).find(l => l.happened === false);
    rung = lastClean?.rung ?? lower(B_RUNGS, rung);
  }

  const r = rungById(B_RUNGS, rung);
  if (!r) return null;
  return { rung, text: r.text, link: r.link, rough: await roughPatch("B", rung), warmUp };
}

export async function todayC(dateStr: string): Promise<Today | null> {
  if (!isCDay(dateStr)) return null;

  // Wednesday she is at home, so Wednesday has its own and the ladder waits.
  if (dowOf(dateStr) === "wed") {
    return { rung: "CWED", text: C_WEDNESDAY, link: null, rough: false, warmUp: false };
  }

  const st = (await allTracks()).C;
  const s = await settings();
  const { rung: picked, warmUp } = warmUpOrReal(C_RUNGS, st, dateStr);
  const rung = picked === "C6" ? rotate(C_POOL, st.lastRotated) : picked;

  const r = C_RUNGS.find(x => x.id === rung);
  if (!r) return null;
  return { rung, text: r.text(s.comfortFloor), link: null, rough: await roughPatch("C", rung), warmUp };
}

/** Monday's big one is a deck number and a floor number rather than a rung. */
export async function todayDMon(dateStr: string): Promise<{ deck: number; floor: number } | null> {
  if (!isDMonDay(dateStr)) return null;
  const s = await settings();
  return {
    deck: Math.min(s.monDeck ?? s.usualDeck + 1, DECK_CAP),
    floor: s.monFloor ?? s.comfortFloor + 2,
  };
}

export async function todayDThu(dateStr: string): Promise<Today | null> {
  if (!isDThuDay(dateStr)) return null;

  const st = (await allTracks()).DTHU;
  const { rung: picked, warmUp } = warmUpOrReal(T_RUNGS, st, dateStr);
  const rung = picked === "T6" ? rotate(T_POOL, st.lastRotated) : picked;

  const r = rungById(T_RUNGS, rung);
  if (!r) return null;
  return { rung, text: r.text, link: r.link, rough: await roughPatch("DTHU", rung), warmUp };
}

// ── Moving up ────────────────────────────────────────────────────────────────

const NEEDED: Record<TrackKey, number> = { A: 3, B: 1, C: 3, DMON: 1, DTHU: 1 };

export interface Advance {
  moved: boolean;
  from: string;
  to: string;
  /** The sentence to append to that track's next text. */
  line: string | null;
}

function nextId(list: { id: string }[], id: string, terminal: string): string {
  const i = indexIn(list, id);
  if (i < 0 || i >= list.length - 1) return terminal;
  return list[i + 1].id;
}

/**
 * Record one rep and move the track if it earned it.
 *
 * `counted` is false for Monday drives: they are logged in full and never
 * advance A, which is exactly what she asked for.
 */
export async function recordRep(opts: {
  dateStr: string;
  track: TrackKey;
  rung: string;
  before: number | null;
  peak: number | null;
  after: number | null;
  happened: boolean;
  counted?: boolean;
}): Promise<Advance> {
  const counted = opts.counted !== false;
  await addLog({
    onDate: opts.dateStr,
    track: opts.track,
    rung: opts.rung,
    before: opts.before,
    peak: opts.peak,
    after: opts.after,
    happened: opts.happened,
    skipped: null,
    counted,
  });

  const st = (await allTracks())[opts.track];
  const clean = opts.happened === false;

  // A warm up puts her back where she was and never advances on its own.
  if (st.warmingUp) {
    await saveTrack({ track: opts.track, lastRepOn: opts.dateStr, warmingUp: false });
    return { moved: false, from: st.rung, to: st.rung, line: null };
  }

  if (!counted || !clean) {
    await saveTrack({
      track: opts.track,
      lastRepOn: opts.dateStr,
      lastRotated: opts.rung,
    });
    return { moved: false, from: st.rung, to: st.rung, line: null };
  }

  // Monday is its own thing: a clean Monday raises the deck and the floor.
  if (opts.track === "DMON") {
    const s = await settings();
    const deck = Math.min((s.monDeck ?? s.usualDeck + 1) + 1, DECK_CAP);
    const floor = (s.monFloor ?? s.comfortFloor + 2) + 1;
    await setSetting("monDeck", String(deck));
    await setSetting("monFloor", String(floor));
    await saveTrack({ track: "DMON", lastRepOn: opts.dateStr, cleanReps: st.cleanReps + 1 });
    return {
      moved: true,
      from: st.rung,
      to: `deck ${deck}, floor ${floor}`,
      line: `Clean Monday. Next Monday: deck ${deck}, floor ${floor}.`,
    };
  }

  const reps = st.cleanReps + 1;
  const need = NEEDED[opts.track];

  if (reps < need) {
    await saveTrack({ track: opts.track, cleanReps: reps, lastRepOn: opts.dateStr, lastRotated: opts.rung });
    return { moved: false, from: st.rung, to: st.rung, line: null };
  }

  const list =
    opts.track === "A" ? A_RUNGS :
    opts.track === "B" ? B_RUNGS :
    opts.track === "C" ? C_RUNGS : T_RUNGS;
  const terminal = opts.track === "A" ? "A6" : opts.track === "C" ? "C6" : opts.track === "DTHU" ? "T6" : "B10";
  const to = nextId(list, st.rung, terminal);

  // At the end of a ladder there is nowhere to go: A6 rotates A3, A4 and A5,
  // and B10 is the last one there is. Resetting the count is right, announcing
  // a move from A6 to A6 is not.
  if (to === st.rung) {
    await saveTrack({
      track: opts.track,
      cleanReps: 0,
      lastRepOn: opts.dateStr,
      lastRotated: opts.rung,
    });
    return { moved: false, from: st.rung, to, line: null };
  }

  await saveTrack({
    track: opts.track,
    rung: to,
    cleanReps: 0,
    lastRepOn: opts.dateStr,
    lastRotated: opts.rung,
  });

  const line =
    opts.track === "B"
      ? `Clean session. Next Sunday: ${to}.`
      : `${need} clean reps on ${st.rung}. Next: ${to}.`;
  return { moved: true, from: st.rung, to, line };
}

export async function recordSkip(dateStr: string, track: TrackKey, rung: string, reason: string) {
  await addLog({
    onDate: dateStr, track, rung,
    before: null, peak: null, after: null, happened: null,
    skipped: reason, counted: false,
  });
}

/** Manual control: next, back, hold. Hold is a no op that confirms. */
export async function nudge(track: TrackKey, dir: "next" | "back" | "hold"): Promise<string> {
  const st = (await allTracks())[track];
  if (dir === "hold") return `Holding ${track} at ${st.rung}.`;

  if (track === "DMON") {
    const s = await settings();
    const step = dir === "next" ? 1 : -1;
    const deck = Math.max(1, Math.min((s.monDeck ?? s.usualDeck + 1) + step, DECK_CAP));
    const floor = Math.max(1, (s.monFloor ?? s.comfortFloor + 2) + step);
    await setSetting("monDeck", String(deck));
    await setSetting("monFloor", String(floor));
    return `Monday is now deck ${deck}, floor ${floor}.`;
  }

  const list =
    track === "A" ? A_RUNGS : track === "B" ? B_RUNGS : track === "C" ? C_RUNGS : T_RUNGS;
  const terminal = track === "A" ? "A6" : track === "C" ? "C6" : track === "DTHU" ? "T6" : "B10";
  const to = dir === "next" ? nextId(list, st.rung, terminal) : lower(list, st.rung);
  await saveTrack({ track, rung: to, cleanReps: 0 });
  return `${track} moved to ${to}.`;
}

export async function consumePrediction(dateStr: string): Promise<number | null> {
  return takePrediction(dateStr);
}

export type { Settings, TrackState, Rung };
