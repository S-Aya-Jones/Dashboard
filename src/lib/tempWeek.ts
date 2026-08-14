import type { Cat } from "@/lib/weekPlan";

// Temporary schedules.
//
// weekPlan.ts is the recurring week. This is what sits on top of it for a
// handful of named dates and then gets out of the way — a catch-up weekend, an
// exam week, the week she's away. Every change carries a date, so a temporary
// week expires by itself rather than quietly becoming the new normal.
//
// Two things feed the same shape: the weeks written here, and the one-off
// changes she saves by voice on /schedule (table `schedule_overrides`). Both
// render identically wherever a schedule is shown.

export interface DatedChange {
  /** Stable enough for a React key; not a database id. */
  id: string;
  /** The single day this applies to, YYYY-MM-DD. */
  date: string;
  /** A move is a cancel plus an add — two entries, not a third verb. */
  kind: "add" | "cancel";
  /** For add: what to call it. For cancel: which block to strike. */
  label: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  cat?: Cat;
}

export interface TempWeek {
  id: string;
  name: string;
  /** One line, shown at the top of the day. Why today doesn't look normal. */
  why: string;
  from: string;
  to: string;
  changes: DatedChange[];
}

function add(
  date: string, start: string, end: string, label: string, cat: Cat, note?: string,
): DatedChange {
  return { id: `${date}-${start}-add`, date, kind: "add", label, startTime: start, endTime: end, note: note ?? null, cat };
}

function cut(date: string, label: string, note?: string): DatedChange {
  return { id: `${date}-${label}-cut`, date, kind: "cancel", label, startTime: null, endTime: null, note: note ?? null };
}

// ── The catch-up week ──────────────────────────────────────────────────────
//
// Second week of the MHS program, started late, roughly sixteen lectures
// behind, with tests in Microbiology and Cell & Molecular Bio on the Monday and
// the Wednesday. Written from her own plan.
//
// The sequencing rule underneath it: new concepts in the first two blocks of a
// day, retrieval and drilling in the last. Hour nine is fine for testing
// yourself and bad for meeting RyR1 for the first time.
//
// Which of Micro and CMB tests Monday isn't settled yet, so the blocks say
// "the Monday test" rather than guessing a course name.

const CATCH_UP: DatedChange[] = [
  // ── Friday Aug 14 — three hours, plus cooking and laundry ──
  cut("2026-08-14", "Gym"),
  cut("2026-08-14", "Flex —"),
  cut("2026-08-14", "Deandra time", "Your own plan runs to 8 tonight — move her to Sunday evening."),
  add("2026-08-14", "16:00", "16:30", "Inventory — every lecture you're behind on", "study",
    "Four columns, sixteen lines. Mark which lectures each test covers. This is the whole weekend's map."),
  add("2026-08-14", "16:30", "17:00", "Gather materials into one folder", "study",
    "Slides, study guides, practice tests, the group-chat Quizlet. Once, so you never hunt again this weekend."),
  add("2026-08-14", "17:00", "18:30", "Monday-test class — lecture 1, full loop", "study",
    "Read for shape, close it, rebuild out loud, then test cold."),
  add("2026-08-14", "18:30", "19:00", "Dinner — and start a load of laundry", "life"),
  add("2026-08-14", "19:00", "20:00", "Monday-test class — lecture 2, first pass only", "study",
    "Shape and main chain. No drilling yet."),
  add("2026-08-14", "20:00", "21:15", "Cook the weekend's meals + fold laundry", "life",
    "Lecture recordings playing. Cooking now is what buys Saturday and Sunday back."),
  add("2026-08-14", "21:15", "21:45", "Skincare, bed", "rest", "Seven hours minimum. Saturday is nine hours long."),

  // ── Saturday Aug 15 — nine hours ──
  cut("2026-08-15", "Hospital shadowing", "Shadowing pauses first in a catch-up week."),
  cut("2026-08-15", "Major driving exposure", "Never the weekend before an assessment."),
  cut("2026-08-15", "Legal — storage unit"),
  cut("2026-08-15", "Cleaning reset"),
  cut("2026-08-15", "Gym"),
  cut("2026-08-15", "Open —"),
  cut("2026-08-15", "Up + breakfast"),
  cut("2026-08-15", "Lunch"),
  cut("2026-08-15", "Skincare, bed"),
  add("2026-08-15", "07:30", "08:30", "Up, breakfast, at the desk by 8:30", "rest"),
  add("2026-08-15", "08:30", "11:00", "Monday-test class — finish lecture 2, then lecture 3", "study", "New material, highest load. Freshest hours of the weekend."),
  add("2026-08-15", "11:00", "11:45", "Break — food, off screens", "rest"),
  add("2026-08-15", "11:45", "13:45", "Monday-test class — lecture 4", "study", "New material, high load."),
  add("2026-08-15", "13:45", "14:30", "Break — walk if you can", "rest"),
  add("2026-08-15", "14:30", "16:30", "Wednesday-test class — lecture 1", "study", "New material, high load."),
  add("2026-08-15", "16:30", "17:15", "Break", "rest"),
  add("2026-08-15", "17:15", "18:30", "Cold retrieval — all four Monday-class lectures", "study",
    "No notes. This is the block that turns today into a grade."),
  add("2026-08-15", "18:30", "19:15", "Dinner", "life"),
  add("2026-08-15", "19:15", "21:00", "Physiology — troponin, tropomyosin, M line, the NMJ", "study",
    "The full sequence from motor-neuron AP to muscle AP. Review-shaped, so it's fine this late."),

  // ── Sunday Aug 16 — eight hours ──
  cut("2026-08-16", "Long study"),
  cut("2026-08-16", "Groceries"),
  cut("2026-08-16", "Cook Mon–Wed meals", "You cooked Friday night."),
  cut("2026-08-16", "Study — error log review"),
  cut("2026-08-16", "Week planning"),
  cut("2026-08-16", "Dinner"),
  cut("2026-08-16", "Skincare hour"),
  cut("2026-08-16", "Therapy", "Sunday therapy starts Aug 30 — the 22nd is the last Saturday session."),
  add("2026-08-16", "08:30", "09:30", "Cold retrieval — Monday class. Produces the fix list.", "study",
    "Church is 9–12. If you go, this and the patch below move to 12:30 and 1:30, and lunch moves to 4."),
  add("2026-08-16", "09:30", "10:30", "Patch only the misses", "study", "Ignore what already works. The fix list is the whole agenda."),
  add("2026-08-16", "10:30", "11:00", "Break", "rest"),
  add("2026-08-16", "11:00", "13:00", "Wednesday-test class — lectures 2 and 3", "study", "New material, high load."),
  add("2026-08-16", "13:00", "14:00", "Lunch and a real break", "life"),
  add("2026-08-16", "14:00", "16:00", "Wednesday-test class — lecture 4", "study", "New material, high load."),
  add("2026-08-16", "16:00", "16:45", "Break", "rest"),
  add("2026-08-16", "16:45", "18:30", "Physiology — excitation-contraction coupling", "study",
    "T-tubules, DHPR, the triad, RyR1 releases and SERCA stores, calcium binds troponin C, the cross-bridge cycle, relaxation, malignant hyperthermia."),
  add("2026-08-16", "18:30", "19:15", "Dinner", "life"),
  add("2026-08-16", "19:15", "20:15", "Second cold retrieval — Monday class", "study",
    "The highest-value hour of the weekend. Spaced retrieval fifteen hours before a test beats new coverage almost every time."),
  add("2026-08-16", "20:15", "21:00", "Skincare, bed", "rest", "Tonight's sleep is part of tomorrow's test."),

  // ── The week that follows — new lectures land regardless ──
  cut("2026-08-17", "Block 1 — Biochemistry"),
  cut("2026-08-17", "Block 2 — Physiology"),
  add("2026-08-17", "17:00", "18:30", "Wednesday-test class — cold retrieval, then patch", "study",
    "Test 1 is behind you. Ninety minutes on the class that tests Wednesday."),
  add("2026-08-17", "19:00", "20:00", "Free — you sat a test today", "rest", "Deliberately empty. Take it."),

  cut("2026-08-18", "Block 1 — Microbiology"),
  cut("2026-08-18", "Block 2 — Cell & Molecular Bio"),
  add("2026-08-18", "17:00", "18:30", "Wednesday-test class — second retrieval and patch", "study",
    "Second pass on the fix list. Tomorrow is the test."),
  add("2026-08-18", "19:00", "20:00", "Same-day pass on today's new lectures", "study",
    "Not optional — this is the block that stops the backlog regenerating."),

  cut("2026-08-19", "Light review"),
  add("2026-08-19", "17:00", "18:30", "Light — test 2 is done. Flashcards only.", "study", "Nothing new tonight."),

  cut("2026-08-20", "Block 1 — Microbiology"),
  cut("2026-08-20", "Block 2 — Cell & Molecular Bio"),
  add("2026-08-20", "17:00", "18:30", "Biochem lecture 2, finished", "study",
    "Amino-acid ionization, zwitterions, pI calculation, titration curves, electrophoresis direction. Runs on the pH-vs-pKa rule you already have solid, so it should move fast — if it doesn't, take the 7 o'clock hour too."),
  add("2026-08-20", "19:00", "20:00", "Same-day pass on today's new lectures", "study"),

  cut("2026-08-21", "Flex —"),
  cut("2026-08-21", "Gym"),
  add("2026-08-21", "16:00", "18:00", "Physiology — cardiac and blood, the whole section", "study",
    "Hemostasis, vWF and GPIb vs GPIIb/IIIa, the coagulation cascade (10 → 2 → 1 → 13), albumin and oncotic pressure, left vs right heart failure. Classmates flagged coagulation as the hardest piece — start there."),
];

export const TEMP_WEEKS: TempWeek[] = [
  {
    id: "catch-up-aug-2026",
    name: "Catch-up week",
    why: "Sixteen lectures behind, tests Monday and Wednesday. Everything cuttable is cut.",
    from: "2026-08-14",
    to: "2026-08-21",
    changes: CATCH_UP,
  },
];

/** The temporary week covering a date, if there is one. */
export function tempWeekFor(date: string): TempWeek | null {
  return TEMP_WEEKS.find(w => date >= w.from && date <= w.to) ?? null;
}

/** Every built-in change landing between two dates, inclusive. */
export function tempChangesBetween(from: string, to: string): DatedChange[] {
  return TEMP_WEEKS.flatMap(w => w.changes).filter(c => c.date >= from && c.date <= to);
}

// Saved overrides carry no category — they arrive as a label and a time. This
// picks a colour from the words so a voice-added block doesn't render grey
// next to everything else.
const CAT_WORDS: Array<[RegExp, Cat]> = [
  [/gym|workout|lift|run|walk/i, "gym"],
  [/study|lecture|review|quiz|exam|test|retriev|flashcard|mcat|biochem|physio|micro|cmb|molecular/i, "study"],
  [/work|class|shift|office/i, "work"],
  [/therapy|therapist|counsel/i, "therapy"],
  [/drive|driving|exposure|heights/i, "exposure"],
  [/lawyer|legal|cook|laundry|clean|grocer|budget|bill|errand|dinner|lunch|breakfast/i, "life"],
  [/church|family|friend|deandra|call|visit|birthday|shadow/i, "people"],
  [/skincare|bed|sleep|rest|break|wind|buffer/i, "rest"],
];

export function catFor(label: string, fallback: Cat = "life"): Cat {
  for (const [re, cat] of CAT_WORDS) if (re.test(label)) return cat;
  return fallback;
}
