import {
  todayA, todayB, todayC, todayDMon, todayDThu,
  isCDay, isDMonDay, isDThuDay, isADay, isTitansSunday, lightGoesEarly, dowOf,
} from "@/lib/exposure/engine";
import { allTracks, settings, isOff, logsBetween, takeLine } from "@/lib/exposure/store";
import { TITANS_LINE, TWO_ROUGH_LINE, DUSK_RUNG, DARK_RUNG, B_RUNGS, rungById, type TrackKey } from "@/lib/exposure/rungs";
import { daylight, clockOf } from "@/lib/daylight";
import { D_STARTS } from "@/lib/exposure/rungs";

// The lines that get added to texts she already gets.
//
// No new sends except Sunday dusk and dark. Everything else is one or two extra
// lines inside the seven twenty, the ten forty five, the seven o'clock and the
// Sunday nine o'clock.
//
// No dashes. Not one, anywhere, in anything this file returns.

const LOG_LINE =
  "Log today: drive 40 75 20 no, h 30 60 15 no (before, peak, after, did the scary thing happen).";

function withRough(base: string, rough: boolean): string {
  return rough ? `${base} ${TWO_ROUGH_LINE}` : base;
}

/**
 * The drive line in the morning text.
 *
 * Monday included: she drives the Capitol View route, logs it, and it never
 * advances the ladder.
 */
export async function morningDriveLine(dateStr: string): Promise<string | null> {
  if (!isADay(dateStr)) return null;
  if (await isOff(dateStr)) return null;

  const a = await todayA(dateStr);
  if (!a) return null;

  const link = a.link ? ` ${a.link}` : "";
  const base =
    `Drive home at 2:30: ${a.rung}. ${a.text}${link} ` +
    "In the car, before you pull out, text p and how sure you are the scary thing happens, 0 to 100.";
  const moved = await takeLine("A");
  return withRough(base, a.rough) + (moved ? ` ${moved}` : "");
}

/**
 * The height line, first in the ten forty five text.
 *
 * Three shapes: the short C rep, Monday's big one at Capitol View, and
 * Thursday's big one at Park Plaza.
 */
export async function midmorningHeightLine(dateStr: string): Promise<string | null> {
  if (await isOff(dateStr)) return null;

  if (isDMonDay(dateStr)) {
    const d = await todayDMon(dateStr);
    if (!d) return null;
    const moved = await takeLine("DMON");
    return `Big height rep, 10 min: ride to floor ${d.floor}, sit at a window. Text p first.` +
      (moved ? ` ${moved}` : "");
  }

  if (isDThuDay(dateStr)) {
    const t = await todayDThu(dateStr);
    if (!t) return null;
    const moved = await takeLine("DTHU");
    return withRough(`Big height rep, 15 min: ${t.text} Text p first.`, t.rough) +
      (moved ? ` ${moved}` : "");
  }

  if (isCDay(dateStr)) {
    const c = await todayC(dateStr);
    if (!c) return null;
    const moved = await takeLine("C");
    return withRough(
      `Height rep first, 3 min: ${c.text} Feet flat, say the scary thought out loud once.`,
      c.rough,
    ) + (moved ? ` ${moved}` : "");
  }

  return null;
}

/** Whether anything was asked of her today, which decides the evening line. */
export async function isRepDay(dateStr: string): Promise<boolean> {
  if (await isOff(dateStr)) return false;
  const d = dowOf(dateStr);
  if (d === "sun") return true;
  return isADay(dateStr) || isCDay(dateStr) || isDMonDay(dateStr) || isDThuDay(dateStr);
}

export async function eveningLines(dateStr: string): Promise<string[]> {
  const out: string[] = [];
  if (await isRepDay(dateStr)) out.push(LOG_LINE);

  // Sunday evening sets up Monday morning, from the week the big one starts.
  if (dowOf(dateStr) === "sun") {
    const tomorrow = new Date(`${dateStr}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monday = tomorrow.toISOString().slice(0, 10);
    if (monday >= D_STARTS) {
      const d = await todayDMon(monday);
      if (d) out.push(`Tomorrow at Capitol View: park on deck level ${d.deck}.`);
    }
  }
  return out;
}

/** The nine o'clock Sunday line. */
export async function sundayDriveLine(dateStr: string): Promise<string | null> {
  if (dowOf(dateStr) !== "sun") return null;
  if (await isOff(dateStr)) return null;

  const b = await todayB(dateStr);
  if (!b) return null;

  const parts: string[] = [];
  if (isTitansSunday(dateStr)) parts.push(TITANS_LINE);

  // Dusk and dark have their own sends later in the day. The morning text still
  // says what is coming so the day can be arranged around it.
  if (b.rung === DUSK_RUNG || b.rung === DARK_RUNG) {
    const at = b.rung === DUSK_RUNG ? "4:10pm" : "5:30pm";
    parts.push(`Big drive: ${b.rung}. ${b.text} Details at ${at}.`);
    return parts.join(" ");
  }

  const link = b.link ? ` ${b.link}` : "";
  parts.push(
    `Big drive: ${b.rung}. ${b.text}${link} Out the door by 9:30. Text p before you pull out.`,
  );
  const moved = await takeLine("B");
  return withRough(parts.join(" "), b.rough) + (moved ? ` ${moved}` : "");
}

/** The two new sends, and nothing else is new. */
export async function duskLine(dateStr: string): Promise<string | null> {
  if (dowOf(dateStr) !== "sun" || !lightGoesEarly(dateStr)) return null;
  if (await isOff(dateStr)) return null;

  const b = await todayB(dateStr);
  if (b?.rung !== DUSK_RUNG) return null;

  const l = daylight(dateStr);
  const sunset = l ? ` Sunset today is ${clockOf(l.sunset)}.` : "";
  const r = rungById(B_RUNGS, DUSK_RUNG);
  return `${r?.text ?? ""}${sunset}${r?.link ? ` ${r.link}` : ""} Text p before you pull out.`;
}

export async function darkLine(dateStr: string): Promise<string | null> {
  if (dowOf(dateStr) !== "sun" || !lightGoesEarly(dateStr)) return null;
  if (await isOff(dateStr)) return null;

  const b = await todayB(dateStr);
  if (b?.rung !== DARK_RUNG) return null;

  const r = rungById(B_RUNGS, DARK_RUNG);
  return `${r?.text ?? ""}${r?.link ? ` ${r.link}` : ""} Text p before you pull out.`;
}

// ── Where everything stands ──────────────────────────────────────────────────

const LABEL: Record<TrackKey, string> = {
  A: "Drive home", B: "Sunday", C: "Height rep", DMON: "Monday big", DTHU: "Thursday big",
};

export async function whereLine(): Promise<string> {
  const t = await allTracks();
  const s = await settings();
  const rows: string[] = [];

  for (const k of ["A", "B", "C", "DTHU"] as TrackKey[]) {
    rows.push(`${LABEL[k]}: ${t[k].rung}, ${t[k].cleanReps} clean`);
  }
  rows.push(
    `${LABEL.DMON}: deck ${s.monDeck ?? s.usualDeck + 1}, floor ${s.monFloor ?? s.comfortFloor + 2}`,
  );
  rows.push(`Comfort floor ${s.comfortFloor}, usual deck ${s.usualDeck}`);
  if (!s.therapistOk) rows.push("B9 and B10 locked until you text therapist ok");
  return rows.join("\n");
}

// ── The Sunday summary block ─────────────────────────────────────────────────

function avg(ns: Array<number | null>): string {
  const got = ns.filter((n): n is number => n != null);
  return got.length ? String(Math.round(got.reduce((a, b) => a + b, 0) / got.length)) : "na";
}

/**
 * One block per track for the half four summary.
 *
 * Counts the week she has just had rather than all time, because the question
 * the summary answers is how this week went.
 */
export async function summaryBlock(from: string, to: string): Promise<string> {
  const logs = await logsBetween(from, to);
  const t = await allTracks();
  const s = await settings();
  const out: string[] = [];

  for (const k of ["A", "B", "C", "DMON", "DTHU"] as TrackKey[]) {
    const mine = logs.filter(l => l.track === k && l.skipped == null);
    if (!mine.length && !t[k].lastRepOn) continue;

    const clean = mine.filter(l => l.happened === false).length;
    const answered = mine.filter(l => l.happened != null);
    const yes = answered.filter(l => l.happened === true).length;

    const rung =
      k === "DMON"
        ? `deck ${s.monDeck ?? s.usualDeck + 1}, floor ${s.monFloor ?? s.comfortFloor + 2}`
        : t[k].rung;

    out.push(
      `${LABEL[k]}: ${rung}. ${clean} clean this week. ` +
      `Before ${avg(mine.map(l => l.before))}, peak ${avg(mine.map(l => l.peak))}, after ${avg(mine.map(l => l.after))}. ` +
      `Scary thing happened: ${yes} of ${answered.length}.`,
    );
  }

  return out.join("\n");
}
