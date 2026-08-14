import { ScheduleBlock } from "@/types/dashboard";

// The one weekly schedule.
//
// This used to exist twice — once here as the Week Plan template and once in
// lib/schedule.ts as an older set of default blocks that Today rendered. They
// had drifted badly apart (the Today copy had no classes, no gym, and therapy
// on the wrong day). Everything now reads from this file.

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
  gym: "Gym", study: "Study", work: "Work + classes", exposure: "Exposure",
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
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest", note: "Clothes staged the night before" },
    { start: "07:00", end: "12:00", label: "Work · Biochem 8–10 · Physio 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Independent Study block · at work", cat: "work", note: "School's own 12–3 study time · heights dose 1:30" },
    { start: "14:30", end: "15:10", label: "Extended-route drive home", cat: "exposure", note: "Driving exposure #1 — no time pressure" },
    { start: "15:10", end: "16:10", label: "Gym (1 of 5)", cat: "gym", note: "45 minutes moving, 15 to shower — that's the whole hour. You're already out and dressed for it." },
    { start: "16:10", end: "17:00", label: "Legal — storage unit", cat: "life", note: "Finding and briefing a lawyer · firms answer in the afternoon" },
    { start: "17:00", end: "18:30", label: "Block 1 — Biochemistry", cat: "study", note: "Same-day review · questions first · deadline overrides in exam weeks" },
    { start: "18:30", end: "19:00", label: "Dinner (Sunday-cooked)", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Physiology", cat: "study", note: "Log every miss in the error log" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call him", cat: "rest", note: "Gym bag staged · lights out at 9" },
  ]},
  2: { name: "Tuesday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · Micro 8–10 · CMB 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Independent Study block · at work", cat: "work", note: "School's own 12–3 study time · heights dose 1:30" },
    { start: "14:30", end: "15:00", label: "Drive home — direct", cat: "work" },
    { start: "15:00", end: "16:00", label: "Gym (2 of 5)", cat: "gym", note: "45 minutes moving, 15 to shower" },
    { start: "16:00", end: "17:00", label: "Legal — storage unit", cat: "life", note: "Calls, quotes, paperwork" },
    { start: "17:00", end: "18:30", label: "Block 1 — Microbiology", cat: "study", note: "Same-day review · questions first" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Cell & Molecular Bio", cat: "study", note: "Log every miss" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  3: { name: "Wednesday", sub: "Work from home", blocks: [
    { start: "06:15", end: "07:00", label: "Up, breakfast, at your desk", cat: "rest", note: "No commute today — the one morning you get back" },
    { start: "07:00", end: "11:00", label: "WFH · Biochem 8–10 · Physio from 10", cat: "work", note: "Capture mode from your desk" },
    { start: "11:00", end: "12:00", label: "Therapy", cat: "therapy", note: "Overlaps Physiology 10–12 — catch the recording after" },
    { start: "12:00", end: "13:00", label: "Work · Physio recording", cat: "work", note: "Re-watch the hour you missed" },
    { start: "13:00", end: "13:30", label: "Office hours — {rotation}", cat: "people",
      rotation: ["Biochemistry", "Physiology", "Microbiology", "Cell & Molecular Bio"],
      note: "One professor a week, so all four know your face by December. Check the syllabus for their posted time and move this to match." },
    { start: "13:30", end: "15:00", label: "Work · Physio recording", cat: "work" },
    { start: "15:00", end: "17:00", label: "Cook Thu/Fri meals", cat: "life", note: "Lecture recordings playing" },
    { start: "17:00", end: "18:30", label: "Light review — flashcards, or whatever the week overflowed", cat: "study", note: "Doubles as the week's buffer · no new material after therapy" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "MCAT — content review only", cat: "study", note: "Moved off 5:15am, where it was not happening. 60 min/week until Sep 1, then it scales up." },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  4: { name: "Thursday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · Micro 8–10 · CMB 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Independent Study block · at work", cat: "work", note: "School's own 12–3 study time · heights dose 1:30" },
    { start: "14:30", end: "15:00", label: "Short exposure drive", cat: "exposure", note: "Driving exposure #2 — 20-min loop on the way home" },
    { start: "15:00", end: "16:00", label: "Gym (3 of 5)", cat: "gym", note: "45 minutes moving, 15 to shower" },
    { start: "16:00", end: "17:00", label: "Legal — storage unit", cat: "life", note: "The longer weekday block — documents and anything needing focus" },
    { start: "17:00", end: "18:30", label: "Block 1 — Microbiology", cat: "study", note: "Flipped so Micro isn't always the tired block" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Cell & Molecular Bio", cat: "study" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  5: { name: "Friday", blocks: [
    { start: "06:00", end: "07:00", label: "Up, shower, breakfast, out", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · Friday assessment slot 8–10", cat: "work", note: "Most quizzes, exams and review sessions land here" },
    { start: "12:00", end: "14:30", label: "Independent Study block · at work", cat: "work", note: "Heights dose 1:30 · the week's weakest subject goes here" },
    { start: "15:00", end: "16:00", label: "Rap Session", cat: "study", note: "Every Friday of the term — the one class that isn't a lecture" },
    { start: "16:00", end: "17:00", label: "Gym (4 of 5)", cat: "gym", note: "45 minutes moving, 15 to shower — straight into the evening" },
    { start: "17:00", end: "17:45", label: "Flex — flashcards, admin, breathe", cat: "rest", note: "Budget check lands here on paydays · bills tab is already sorted" },
    { start: "18:00", end: "21:00", label: "Deandra time", cat: "people", note: "The week's one late night — bed by 10:30" },
  ]},
  6: { name: "Saturday", blocks: [
    { start: "06:30", end: "07:15", label: "Up + breakfast", cat: "rest" },
    { start: "07:30", end: "11:30", label: "Hospital shadowing", cat: "people", note: "Pauses first during exam weeks" },
    { start: "12:00", end: "12:30", label: "Lunch", cat: "life" },
    { start: "12:30", end: "14:00", label: "Major driving exposure", cat: "exposure", note: "The big weekly session — never before an assessment" },
    { start: "14:00", end: "15:30", label: "Legal — storage unit", cat: "life", note: "Freed when therapy moved to Sundays · the week's longest legal block" },
    { start: "15:30", end: "16:30", label: "Cleaning reset", cat: "life" },
    { start: "16:30", end: "17:30", label: "Gym (5 of 5)", cat: "gym", note: "The one that makes four achievable when a weekday gets eaten" },
    { start: "17:30", end: "22:00", label: "Open — social, boyfriend visits, nothing", cat: "people", note: "Real flex, not failure" },
    { start: "22:00", end: "22:30", label: "Skincare, bed", cat: "rest" },
  ]},
  0: { name: "Sunday", blocks: [
    { start: "06:30", end: "07:00", label: "Up + breakfast", cat: "rest" },
    { start: "07:00", end: "08:30", label: "Long study — fresh brain before church", cat: "study" },
    { start: "09:00", end: "12:00", label: "Church", cat: "people" },
    { start: "10:00", end: "11:00", label: "Therapy (Therapist B)", cat: "therapy", note: "CLASHES with church 9–12 — one of them has to give. From Aug 30; last Saturday session is Aug 22 at 10." },
    { start: "12:30", end: "14:00", label: "Family time + lunch", cat: "people" },
    { start: "14:00", end: "15:00", label: "Groceries", cat: "life" },
    { start: "15:00", end: "17:00", label: "Cook Mon–Wed meals", cat: "life", note: "Lecture recordings playing" },
    { start: "17:00", end: "18:30", label: "Study — error log review", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:30", label: "Week planning — Deadlines tab, assign every block", cat: "study", note: "Check if exam-week mode activates" },
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
