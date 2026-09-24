import { ScheduleBlock } from "@/types/dashboard";

// The one weekly schedule.
//
// Everything reads from this file — the Today page, the Week grid, the text
// messages, the morning briefing, the Google Calendar seeder.
//
// Rewritten September 2026 from the break plan. The fourteen-week term machine
// is gone: no classes, no Block 1 and Block 2, no error log, no Micro deck, no
// Saturday big block, no MCAT until June 2027.
//
// This is the Oct 7 onward week — the plan's own numbers: foundations an hour a
// day on weekdays, driving exposures three times, Ladder four times, job search
// three times, journalling daily, shadowing back from November, and a Sunday
// review. It comes to about three hours on a full day, and the plan is explicit
// that the other hours stay empty on purpose.
//
// Until Oct 6 none of this applies — see RECOVERY in tempWeek.ts. The job there
// is rest.
//
// The old term plan is not deleted, only unused. If school comes back it comes
// back through git, not by retyping it.

export type Cat =
  | "gym" | "study" | "work" | "exposure" | "therapy" | "life" | "people" | "rest";

export interface PlanBlock {
  start: string;
  end: string;
  label: string;
  cat: Cat;
  note?: string;
  /**
   * A block whose subject advances each week. The label carries "{rotation}"
   * and one entry is chosen per ISO week, so office hours cycle through her
   * four courses instead of always defaulting to whichever felt worst.
   */
  rotation?: string[];
}

// Warm palette only — these sit next to clay, gold and sage.
export const CAT_COLORS: Record<Cat, string> = {
  gym:      "#3F6F5E",
  study:    "#B4552F",
  work:     "#8A7A66",
  exposure: "#E0A44A",
  therapy:  "#71816D",
  life:     "#C9A227",
  people:   "#C9748A",
  rest:     "#A8967E",
};

export const CAT_LABELS: Record<Cat, string> = {
  gym: "Gym", study: "Study", work: "Work", exposure: "Exposure",
  therapy: "Therapy", life: "Home & errands", people: "People", rest: "Rest & wind-down",
};

// The ScheduleBlock type predates these categories; this is the mapping used
// wherever a block has to be expressed in the older vocabulary.
const CAT_TO_TYPE: Record<Cat, ScheduleBlock["type"]> = {
  gym: "walk", study: "mcat", work: "work", exposure: "exposure",
  therapy: "personal", life: "meal", people: "personal", rest: "other",
};

export const WEEK: Record<number, { name: string; sub?: string; blocks: PlanBlock[] }> = {
  1: { name: "Monday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work", cat: "work" },
    { start: "15:00", end: "15:40", label: "Ladder workout (gym at work)", cat: "gym", note: "1 of 4 this week. Eight in October or it gets cancelled — that's the deal." },
    { start: "16:00", end: "17:00", label: "Bio and gen chem foundations", cat: "study", note: "Khan Academy, free. One hour. Foundations only until June 2027." },
    { start: "17:00", end: "18:00", label: "Job search — applications", cat: "life", note: "1 of 3. Resume first, then three real applications a week." },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:15", label: "Journal", cat: "rest", note: "Talk it out. Fifteen minutes." },
    { start: "20:00", end: "21:00", label: "Skincare hour + call him", cat: "rest" },
  ]},
  2: { name: "Tuesday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work", cat: "work" },
    { start: "14:30", end: "15:10", label: "Driving exposure", cat: "exposure", note: "1 of 3. Log it: how long, peak fear 0–10, what your body did." },
    { start: "15:30", end: "16:10", label: "Ladder workout (gym at work)", cat: "gym", note: "2 of 4" },
    { start: "16:30", end: "17:30", label: "Bio and gen chem foundations", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:15", label: "Journal", cat: "rest" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  3: { name: "Wednesday", sub: "Work from home", blocks: [
    { start: "06:15", end: "07:00", label: "Up, breakfast, at your desk", cat: "rest" },
    { start: "07:00", end: "11:00", label: "Work — from home", cat: "work" },
    { start: "11:00", end: "12:00", label: "Therapy", cat: "therapy" },
    { start: "12:00", end: "14:30", label: "Work — from home", cat: "work" },
    { start: "15:00", end: "16:00", label: "Bio and gen chem foundations", cat: "study" },
    { start: "16:00", end: "17:00", label: "Job search — applications", cat: "life", note: "2 of 3" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:20", label: "Journal", cat: "rest", note: "Therapy day. This is the one worth writing down." },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  4: { name: "Thursday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work", cat: "work" },
    { start: "14:30", end: "15:10", label: "Driving exposure", cat: "exposure", note: "2 of 3" },
    { start: "15:30", end: "16:10", label: "Ladder workout (gym at work)", cat: "gym", note: "3 of 4" },
    { start: "16:30", end: "17:30", label: "Bio and gen chem foundations", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:15", label: "Journal", cat: "rest" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  5: { name: "Friday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work", cat: "work" },
    { start: "15:00", end: "15:40", label: "Ladder workout (gym at work)", cat: "gym", note: "4 of 4 — the week's target met" },
    { start: "16:00", end: "17:00", label: "Bio and gen chem foundations", cat: "study" },
    { start: "17:00", end: "18:00", label: "Job search — applications", cat: "life", note: "3 of 3. Three real ones this week." },
    { start: "18:00", end: "21:00", label: "Deandra time — Friday is off", cat: "people", note: "Non-negotiable." },
  ]},
  6: { name: "Saturday", blocks: [
    { start: "07:30", end: "08:15", label: "Up + breakfast", cat: "rest", note: "No alarm if you don't want one" },
    { start: "09:00", end: "13:00", label: "Shadowing — dermatology if possible", cat: "people", note: "From November. Half a day, once a week." },
    { start: "13:30", end: "14:15", label: "Driving exposure — the long one", cat: "exposure", note: "3 of 3. The unhurried session." },
    { start: "15:00", end: "16:00", label: "Cleaning reset", cat: "life" },
    { start: "18:00", end: "22:00", label: "Open — social, nothing, whatever it is", cat: "people", note: "Real flex, not failure" },
    { start: "22:00", end: "22:30", label: "Skincare, bed", cat: "rest" },
  ]},
  0: { name: "Sunday", blocks: [
    { start: "07:00", end: "07:30", label: "Up + breakfast", cat: "rest" },
    { start: "09:00", end: "12:00", label: "Church", cat: "people" },
    { start: "10:00", end: "11:00", label: "Therapy (Therapist B)", cat: "therapy", note: "CLASHES with church 9–12 — one of them has to give. Still unresolved." },
    { start: "12:30", end: "14:00", label: "Family time + lunch", cat: "people" },
    { start: "14:00", end: "15:00", label: "Groceries", cat: "life" },
    { start: "15:00", end: "17:00", label: "Cook the week's meals", cat: "life" },
    { start: "19:00", end: "19:30", label: "Dinner", cat: "life" },
    { start: "19:30", end: "19:50", label: "Weekly review — journal it", cat: "rest", note: "What you avoided, what you faced, one thing for someone else, one thing nobody saw. Then the four numbers: savings, exposures, workouts, applications." },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
};

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun",
};

/**
 * ISO week number. Used so a rotating block advances once a week and lands on
 * the same subject for every day of that week — a rotation keyed on the date
 * would change mid-week and a rotation keyed on a stored counter would drift
 * whenever a week got skipped.
 */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday determines the year a week belongs to.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** The label for a block on a given date, with any rotation resolved. */
export function resolveLabel(
  block: { label: string; rotation?: string[] },
  when: Date = new Date(),
): string {
  if (!block.rotation?.length) return block.label;
  const pick = block.rotation[isoWeek(when) % block.rotation.length];
  return block.label.replace("{rotation}", pick);
}

export function planMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** The plan for one weekday, in order. */
export function planForDay(dow: number): PlanBlock[] {
  return WEEK[dow]?.blocks ?? [];
}

/**
 * The whole week flattened into ScheduleBlock form, so the Today page and the
 * week editor read the same schedule the Week Plan shows. Identical blocks
 * appearing on several days are merged into one entry with a `days` array.
 */
export function planAsScheduleBlocks(): ScheduleBlock[] {
  const merged = new Map<string, ScheduleBlock>();

  for (const dow of DAY_ORDER) {
    for (const b of planForDay(dow)) {
      const key = `${b.start}|${b.end}|${b.label}|${b.cat}`;
      const existing = merged.get(key);
      if (existing) {
        existing.days.push(dow);
        continue;
      }
      merged.set(key, {
        id: `plan-${key.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
        label: b.label,
        startTime: b.start,
        endTime: b.end,
        days: [dow],
        type: CAT_TO_TYPE[b.cat],
        color: CAT_COLORS[b.cat],
        ...(b.note ? { notes: b.note } : {}),
        ...(b.rotation ? { rotation: b.rotation } : {}),
      });
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => planMinutes(a.startTime) - planMinutes(b.startTime)
  );
}
