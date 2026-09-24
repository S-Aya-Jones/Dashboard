import { planForDay } from "@/lib/weekPlan";
import { applyChanges, rowsFromPlan, type SchedRow } from "@/lib/dayPlan";
import { tempChangesBetween, tempWeekFor } from "@/lib/tempWeek";
import { ASSESSMENTS, CALENDAR, type Assessment } from "@/lib/assessments";
import { weekFor } from "@/lib/semesterPlan";

// The day, in words, for anything that isn't a screen.
//
// Every page renders the schedule through weekPlan + tempWeek. The text
// messages and the morning briefing did not — they carried their own hardcoded
// copy of the week, which is how her phone ended up saying "gym in 30 minutes"
// at a quarter to five months after the gym moved to the afternoon, and how a
// briefing could miss an exam that had been moved two days.
//
// One source of truth, rendered two ways: rows for the screen, sentences for
// the phone.

const TZ = "America/Chicago";

/** YYYY-MM-DD for a Date, read in Chicago rather than UTC. */
export function chicagoDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function dow(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

/**
 * 24h "17:00" -> "5pm". Minutes dropped when zero — nobody says 5:00pm sharp.
 *
 * Midnight and noon get their names. An exam window written "12–10" is exactly
 * the kind of thing she'd have to stop and work out.
 */
export function say(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (m === 0 && h === 0) return "midnight";
  if (m === 0 && h === 12) return "noon";
  const hr = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? "am" : "pm";
  return m === 0 ? `${hr}${ap}` : `${hr}:${String(m).padStart(2, "0")}${ap}`;
}

/** Today's blocks, with the temporary week already folded in. */
export function planRows(dateStr: string): SchedRow[] {
  const when = new Date(`${dateStr}T12:00:00`);
  const base = rowsFromPlan(planForDay(dow(dateStr)), when);
  return applyChanges(base, tempChangesBetween(dateStr, dateStr), dateStr).rows;
}

/**
 * The whole day on one line, the way she'd say it herself.
 *
 * Replaces the hand-written day templates. Skips the small stuff — meals,
 * wind-down, the wake-up block — because a one-liner that lists everything
 * isn't a one-liner.
 */
const MINOR = /^(dinner|lunch|breakfast|wind[- ]down|lights out|up,|shower|get ready|meds|water|tidy|buffer|free|open)/i;

export function dayLine(dateStr: string): string {
  const rows = planRows(dateStr).filter(r => !MINOR.test(r.label));
  const day = new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
  if (!rows.length) return `${day}: open.`;
  const parts = rows.map(r => `${say(r.start)} ${r.label}`);
  return `${day}: ${parts.join(" → ")}.`;
}

/** Every block, one per line — for the briefing, where there's room. */
export function dayBlocks(dateStr: string): string {
  return planRows(dateStr)
    .map(r => `${say(r.start)}–${say(r.end)} ${r.label}${r.note ? ` (${r.note})` : ""}`)
    .join("\n");
}

/**
 * [time, label] pairs, for the 30-minutes-ahead nudges.
 *
 * Work isn't nudged. She's already there, and a buzz at 6:30 saying "work in
 * 30 minutes" is the kind of notification that teaches you to ignore all of
 * them. An exam sitting inside the work window still nudges, because that one
 * she'd want.
 */
const NOT_WORTH_A_BUZZ = /^(work|wfh)\b/i;

export function blockCues(dateStr: string): Array<[string, string]> {
  return planRows(dateStr)
    .filter(r => !MINOR.test(r.label) && !NOT_WORTH_A_BUZZ.test(r.label))
    .map(r => [r.start, r.label] as [string, string]);
}

/** Why today doesn't look like a normal week, if it doesn't. */
export function whyToday(dateStr: string): string | null {
  const w = tempWeekFor(dateStr);
  return w ? `${w.name} — ${w.why}` : null;
}

export interface DatedAssessment extends Assessment {
  daysOut: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
  );
}

/**
 * Upcoming assessments from the typed term calendar.
 *
 * Deliberately not from her inbox. Email extraction was the old source and it
 * only knows what a message happened to say — the 8/19 announcement moved two
 * Exam 1s and nothing in the inbox pipeline noticed.
 */
export function upcomingAssessments(dateStr: string, daysAhead = 21): DatedAssessment[] {
  return ASSESSMENTS
    .filter(a => a.date >= dateStr && daysBetween(dateStr, a.date) <= daysAhead)
    .map(a => ({ ...a, daysOut: daysBetween(dateStr, a.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function fmtAssessment(a: DatedAssessment): string {
  const kind = a.kind === "exam" ? "Exam" : "Quiz";
  const when =
    a.daysOut === 0 ? "TODAY" :
    a.daysOut === 1 ? "tomorrow" :
    a.daysOut <= 6 ? new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", timeZone: TZ })
      : new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  const window = a.window ? ` · window ${say(a.window.opens)}–${say(a.window.due)}` : ` · ${say(a.time)}`;
  return `${a.short} ${kind} ${a.number} — ${when}${window} · ${a.weightPct}% of the grade`;
}

/** Review sessions and no-class days inside the next fortnight. */
export function upcomingCalendar(dateStr: string, daysAhead = 14) {
  return CALENDAR.filter(c => c.date >= dateStr && daysBetween(dateStr, c.date) <= daysAhead);
}

/**
 * Everything a message-writing model needs to sound like it knows her week.
 *
 * One object, so a new cron route gets the current schedule by asking for it
 * rather than by someone remembering to paste the week into a prompt again.
 */
export function briefContext(dateStr: string = chicagoDay()) {
  const week = weekFor(dateStr);
  const soon = upcomingAssessments(dateStr);
  return {
    date: dateStr,
    dayLine: dayLine(dateStr),
    blocks: dayBlocks(dateStr),
    whyToday: whyToday(dateStr),
    semesterWeek: week ? { n: week.n, of: 14, focus: week.focus, getAhead: week.getAhead, pressurePoint: !!week.heavy } : null,
    assessments: soon.map(a => ({
      course: a.course, short: a.short, kind: a.kind, number: a.number,
      date: a.date, daysOut: a.daysOut, weightPct: a.weightPct,
      window: a.window ?? null, line: fmtAssessment(a),
    })),
    reviewSessionsAndFreeDays: upcomingCalendar(dateStr).map(c => ({
      date: c.date, time: c.time, kind: c.kind, title: c.title, note: c.note ?? null,
    })),
  };
}

/**
 * The standing facts about her week, for a system prompt.
 *
 * Generated, not typed — the times come out of weekPlan, so moving the gym
 * moves it here too.
 */
export function weekBackground(dateStr: string = chicagoDay()): string {
  const days = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const ref = new Date(`${dateStr}T12:00:00`);
    ref.setDate(ref.getDate() + ((d - ref.getDay() + 7) % 7));
    return dayLine(chicagoDay(ref));
  });
  return days.join("\n");
}
