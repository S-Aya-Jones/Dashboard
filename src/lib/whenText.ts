// A countdown ("93 days") makes you do arithmetic before you know what it
// means. A date doesn't. Everything in the app that used to render a number
// of days now renders the day itself, with a relative word only where it
// genuinely reads faster — today, tomorrow, and the weekday names inside the
// coming week.

const DAY = 86_400_000;

function toDate(v: Date | string): Date {
  return typeof v === "string" ? new Date(v) : v;
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today to `when` — negative if it already passed. */
export function dayGap(when: Date | string, from: Date = new Date()): number {
  return Math.round(
    (midnight(toDate(when)).getTime() - midnight(from).getTime()) / DAY
  );
}

/** "Aug 21" — or "Aug 21, 2027" when it falls in another year. */
export function dateLabel(when: Date | string, from: Date = new Date()): string {
  const d = toDate(when);
  const sameYear = d.getFullYear() === from.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Thursday" for a date inside the coming week. */
export function weekdayLabel(when: Date | string): string {
  return toDate(when).toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * The phrase to put in a sentence: "today", "tomorrow", "Thursday",
 * "Aug 21". Past dates read as "yesterday" or the plain date.
 */
export function whenText(when: Date | string, from: Date = new Date()): string {
  const gap = dayGap(when, from);
  if (gap === 0) return "today";
  if (gap === 1) return "tomorrow";
  if (gap === -1) return "yesterday";
  if (gap > 1 && gap <= 6) return weekdayLabel(when);
  return dateLabel(when, from);
}

/**
 * The same phrase, but always anchored to a real date — "Thursday, Aug 13"
 * inside the week, the bare date beyond it. Use where the row has space and
 * the exact day matters (bills, deadlines, appointments).
 */
export function whenTextLong(when: Date | string, from: Date = new Date()): string {
  const gap = dayGap(when, from);
  if (gap === 0) return `today, ${dateLabel(when, from)}`;
  if (gap === 1) return `tomorrow, ${dateLabel(when, from)}`;
  if (gap > 1 && gap <= 6) return `${weekdayLabel(when)}, ${dateLabel(when, from)}`;
  return dateLabel(when, from);
}

/** Title-case for the start of a sentence or a standalone chip. */
export function whenChip(when: Date | string, from: Date = new Date()): string {
  const s = whenText(when, from);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A date `days` from now, for turning a duration into a horizon. */
export function dateAfter(days: number, from: Date = new Date()): Date {
  const d = midnight(from);
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d;
}
