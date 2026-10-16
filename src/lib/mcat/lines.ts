import { dayFor, PHASE_NAME, PLAN_START, PLAN_END } from "@/lib/mcat/calendar";
import { progressBetween, questions, masteryFrom, weakest, needsRetest } from "@/lib/mcat/store";

// The plan, by text.
//
// Two places. The day's work rides in the 2:05 message, which already exists
// and lands before she leaves work, so she knows what is waiting before she is
// in the car. Then one nudge at 3:00 when the two hours start.
//
// Only those two. The plan is two hours a day for six months and the quickest
// way to make her stop reading any of it is to text about it five times.
//
// No dashes.

function inPlan(dateStr: string): boolean {
  return dateStr >= PLAN_START && dateStr <= PLAN_END;
}

/** The line that joins the 2:05 text. */
export async function mcatAfternoonLine(dateStr: string): Promise<string | null> {
  if (!inPlan(dateStr)) return null;
  const d = dayFor(dateStr);
  if (!d) return null;
  return `MCAT ${d.hours} hrs at 3:00. ${d.focus}${d.code ? ` (${d.code})` : ""}. ${d.tasks}`;
}

/**
 * Three o'clock, when the block starts.
 *
 * Carries the one thing the dashboard would otherwise have to be opened for:
 * how many misses are waiting to be retested, and the weakest category. Both
 * only appear once there is something to say.
 */
export async function mcatStartLine(dateStr: string): Promise<string | null> {
  if (!inPlan(dateStr)) return null;
  const d = dayFor(dateStr);
  if (!d) return null;

  const parts = [`3:00. ${d.focus}. ${d.hours} hrs.`];

  const qs = await questions(1000).catch(() => []);
  const owed = qs.filter(needsRetest).length;
  if (owed) parts.push(`${owed} miss${owed === 1 ? "" : "es"} waiting for a retest.`);

  const weak = weakest(masteryFrom(qs), 1);
  if (weak.length) parts.push(`Weakest: ${weak[0].code}, ${weak[0].firstTryPct}% first try.`);

  return parts.join(" ");
}

/** A block for the Sunday summary, once the plan has started. */
export async function mcatSummaryBlock(dateStr: string): Promise<string | null> {
  if (!inPlan(dateStr)) return null;
  const d = dayFor(dateStr);
  if (!d) return null;

  const progress = await progressBetween(PLAN_START, dateStr).catch(() => []);
  const thisWeek = progress.filter(p => {
    const pd = dayFor(p.date);
    return pd?.week === d.week;
  });

  const done = thisWeek.filter(p => p.done).length;
  const qs = thisWeek.reduce((n, p) => n + (p.questions ?? 0), 0);
  const right = thisWeek.reduce((n, p) => n + (p.correct ?? 0), 0);
  const pct = qs ? Math.round((right / qs) * 100) : null;

  const all = await questions(1000).catch(() => []);
  const weak = weakest(masteryFrom(all), 3);

  const lines = [
    `MCAT week ${d.week} of 26, phase ${d.phase} (${PHASE_NAME[d.phase]}). ` +
    `${done} of 7 days. ${qs} questions${pct != null ? `, ${pct}% correct` : ""}.`,
  ];
  if (weak.length) {
    lines.push(`Weakest: ${weak.map(w => `${w.code} ${w.firstTryPct}%`).join(", ")}. These get next week's extra weight.`);
  }
  return lines.join("\n");
}
