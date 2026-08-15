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
// behind. Built from her own plan, then corrected against the four syllabi —
// which named the courses she had left blank and, more importantly, showed two
// assessments her plan didn't know about:
//
//   Mon Aug 17  1pm   CMB Quiz 1              5%
//   Wed Aug 19  1pm   Micro Quiz 1            5%
//   Mon Aug 24  8am   Biochemistry Exam 1    15%   <- not in her plan
//   Tue Aug 25  8am   CMB Exam 1             15%   <- not in her plan
//   Mon Aug 31  8am   Physiology Exam 1      15%
//   Tue Sep  1  8am   Microbiology Exam 1    15%
//
// Her plan ended on the 21st with the two quizzes handled. That would have run
// straight into a 15% Biochem exam with three of its four lectures unstudied,
// so the week now runs through the 25th and starts Biochem on the Monday night.
//
// The sequencing rule underneath it: new concepts in the first two blocks of a
// day, retrieval and drilling in the last. Hour nine is fine for testing
// yourself and bad for meeting RyR1 for the first time.

const CATCH_UP: DatedChange[] = [
  // ── Friday Aug 14 — three hours, plus cooking and laundry ──
  cut("2026-08-14", "Gym"),
  cut("2026-08-14", "Flex —"),
  cut("2026-08-14", "Deandra time", "Your own plan runs to 8 tonight — move her to Sunday evening."),
  add("2026-08-14", "16:00", "16:30", "Inventory — every lecture you're behind on", "study",
    "Four columns, sixteen lines. Mark which lectures each quiz and exam covers. This is the whole weekend's map."),
  add("2026-08-14", "16:30", "17:00", "Gather materials into one folder", "study",
    "Slides, study guides, practice tests, the group-chat Quizlet. Once, so you never hunt again this weekend."),
  add("2026-08-14", "17:00", "18:30", "CMB — lecture 1, full loop", "study",
    "Eukaryotic cell structure. Read for shape, close it, rebuild out loud, then test cold."),
  add("2026-08-14", "18:30", "19:00", "Dinner — and start a load of laundry", "life"),
  add("2026-08-14", "19:00", "20:00", "CMB — lecture 2, first pass only", "study",
    "Cell culture, cell lines and stem cells. Shape and main chain, no drilling yet."),
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
  add("2026-08-15", "08:30", "11:00", "CMB — finish lecture 2, then lecture 3", "study",
    "Cell communication I. New material, highest load, freshest hours."),
  add("2026-08-15", "11:00", "11:45", "Break — food, off screens", "rest"),
  add("2026-08-15", "11:45", "13:45", "CMB — lecture 4", "study", "Cell communication II. New material, high load."),
  add("2026-08-15", "13:45", "14:30", "Break — walk if you can", "rest"),
  add("2026-08-15", "14:30", "16:30", "Micro — lecture 1", "study", "Bacterial cytology I. New material, high load."),
  add("2026-08-15", "16:30", "17:15", "Break", "rest"),
  add("2026-08-15", "17:15", "18:30", "Cold retrieval — all four CMB lectures", "study",
    "No notes. Monday's quiz is exactly these four."),
  add("2026-08-15", "18:30", "19:15", "Dinner", "life"),
  add("2026-08-15", "19:15", "21:00", "Physiology — troponin, tropomyosin, M line, the NMJ", "study",
    "Physio Exam 1 is Aug 31 and covers all of this. Review-shaped, so it's fine this late."),

  // ── Sunday Aug 16 — eight hours ──
  cut("2026-08-16", "Long study"),
  cut("2026-08-16", "Groceries"),
  cut("2026-08-16", "Cook Mon–Wed meals", "You cooked Friday night."),
  cut("2026-08-16", "Study — error log review"),
  cut("2026-08-16", "Week planning"),
  cut("2026-08-16", "Dinner"),
  cut("2026-08-16", "Skincare hour"),
  cut("2026-08-16", "Therapy", "Sunday therapy starts Aug 30 — the 22nd is the last Saturday session."),
  add("2026-08-16", "08:30", "09:30", "Cold retrieval — CMB. Produces the fix list.", "study",
    "Church is 9–12. If you go, this and the patch below move to 12:30 and 1:30, and lunch moves to 4."),
  add("2026-08-16", "09:30", "10:30", "Patch only the CMB misses", "study", "Ignore what already works. The fix list is the whole agenda."),
  add("2026-08-16", "10:30", "11:00", "Break", "rest"),
  add("2026-08-16", "11:00", "13:00", "Micro — lectures 2 and 3", "study", "Bacterial cytology II, bacterial physiology I."),
  add("2026-08-16", "13:00", "14:00", "Lunch and a real break", "life"),
  add("2026-08-16", "14:00", "16:00", "Micro — lectures 4 and 5", "study", "Bacterial physiology II, antimicrobial agents. That closes Wednesday's quiz."),
  add("2026-08-16", "16:00", "16:45", "Break", "rest"),
  add("2026-08-16", "16:45", "18:30", "Physiology — excitation-contraction coupling", "study",
    "T-tubules, DHPR, the triad, RyR1 releases and SERCA stores, calcium binds troponin C, the cross-bridge cycle, relaxation, malignant hyperthermia."),
  add("2026-08-16", "18:30", "19:15", "Dinner", "life"),
  add("2026-08-16", "19:15", "20:15", "Second cold retrieval — CMB", "study",
    "The highest-value hour of the weekend. Spaced retrieval sixteen hours before the quiz beats new coverage almost every time."),
  add("2026-08-16", "20:15", "21:00", "Skincare, bed", "rest", "Tonight's sleep is part of tomorrow's quiz."),

  // ── Mon Aug 17 — CMB Quiz 1, 1pm ──
  add("2026-08-17", "13:00", "13:45", "CMB Quiz 1", "study", "5% of the grade. Four lectures: cell structure, cell culture, cell communication I and II."),
  cut("2026-08-17", "Block 1 — Biochemistry"),
  cut("2026-08-17", "Block 2 — Physiology"),
  add("2026-08-17", "17:00", "18:30", "Micro — cold retrieval, then patch", "study",
    "Quiz behind you. Wednesday's Micro quiz is the next thing standing."),
  add("2026-08-17", "19:00", "20:00", "Biochem — lecture 2, amino acid ionization", "study",
    "Biochem Exam 1 is one week today and worth 15%. Starting it tonight is what stops next weekend being this weekend again."),

  // ── Tue Aug 18 ──
  cut("2026-08-18", "Block 1 — Microbiology"),
  cut("2026-08-18", "Block 2 — Cell & Molecular Bio"),
  add("2026-08-18", "17:00", "18:30", "Micro — second retrieval and patch", "study", "Second pass on the fix list. Tomorrow is the quiz."),
  add("2026-08-18", "19:00", "20:00", "Biochem — lecture 3, protein structure", "study",
    "Peptide bonds, phi and psi, the four levels, collagen and scurvy, misfolding, prions."),

  // ── Wed Aug 19 — Micro Quiz 1, 1pm ──
  add("2026-08-19", "13:00", "13:45", "Micro Quiz 1", "study", "5%. Bacterial cytology I and II, physiology I and II, antimicrobial agents."),
  cut("2026-08-19", "Light review"),
  cut("2026-08-19", "MCAT"),
  add("2026-08-19", "17:00", "18:30", "Biochem — lecture 3, the separation half", "study",
    "Ion exchange, size exclusion, affinity, SDS-PAGE, native PAGE, IEF, 2D, Edman, mass spec, X-ray vs NMR."),
  add("2026-08-19", "19:00", "20:00", "Biochem — lecture 4, Enzymes I, first pass", "study", "Both quizzes are behind you. Everything now points at Monday."),

  // ── Thu Aug 20 ──
  cut("2026-08-20", "Block 1 — Microbiology"),
  cut("2026-08-20", "Block 2 — Cell & Molecular Bio"),
  add("2026-08-20", "17:00", "18:30", "Biochem — Enzymes I, full loop", "study",
    "Catalysts, active site, cofactors, apo vs holo, the six EC classes, transition state, binding energy, induced fit, the four mechanisms, chymotrypsin, isozymes, ribozymes."),
  add("2026-08-20", "19:00", "20:00", "Biochem — cold retrieval across lectures 1–4", "study", "Four days out. This is the pass that finds what's missing."),

  // ── Fri Aug 21 ──
  cut("2026-08-21", "Flex —"),
  cut("2026-08-21", "Gym"),
  add("2026-08-21", "16:00", "17:30", "Biochem — patch the fix list", "study", "Only the misses from last night. Nothing that already works."),
  add("2026-08-21", "18:00", "21:00", "Deandra time", "people", "Take it. Saturday and Sunday are both long."),

  // ── Sat Aug 22 — last Saturday therapy, and the Biochem push ──
  cut("2026-08-22", "Hospital shadowing", "Exam week — shadowing pauses first."),
  cut("2026-08-22", "Major driving exposure", "Never the weekend before an assessment."),
  cut("2026-08-22", "Legal — storage unit"),
  add("2026-08-22", "10:00", "11:00", "Therapy — last Saturday session", "therapy",
    "From the 30th this moves to Sundays at 10, where it collides with church."),
  add("2026-08-22", "11:30", "13:30", "Biochem — full cold retrieval, lectures 1–4", "study", "Two days out. No notes."),
  add("2026-08-22", "14:00", "16:00", "Biochem — patch, then practice questions", "study", "Questions first, then study only what you missed."),
  add("2026-08-22", "16:30", "18:00", "CMB — Exam 1 material, first sweep", "study",
    "CMB Exam 1 is Tuesday. It's the four quiz lectures plus the cell cycle and cancer."),

  // ── Sun Aug 23 ──
  cut("2026-08-23", "Groceries"),
  cut("2026-08-23", "Long study"),
  add("2026-08-23", "07:30", "09:00", "Biochem — final pass before church", "study", "Fresh brain. Error log only."),
  add("2026-08-23", "14:00", "16:00", "CMB — cell cycle and cancer", "study", "The two lectures that are on the exam but weren't on the quiz."),
  add("2026-08-23", "17:00", "18:30", "Biochem — last cold retrieval", "study", "Fifteen hours out. This is the highest-value block of the day."),
  add("2026-08-23", "19:15", "20:15", "CMB — cold retrieval", "study", "Sets up Tuesday while Monday is still fresh."),

  // ── Mon Aug 24 — Biochemistry Exam 1, 8am ──
  add("2026-08-24", "08:00", "10:00", "Biochemistry Exam 1", "study", "15% of the grade. Lectures 1–4."),
  cut("2026-08-24", "Block 1 — Biochemistry"),
  cut("2026-08-24", "Block 2 — Physiology"),
  cut("2026-08-24", "Gym"),
  add("2026-08-24", "17:00", "18:30", "CMB — patch the fix list", "study", "One exam down. CMB Exam 1 is tomorrow at 8."),
  add("2026-08-24", "19:00", "20:00", "CMB — final cold retrieval", "study", "Then stop. Sleep is the rest of the revision."),

  // ── Tue Aug 25 — CMB Exam 1, 8am, and back to normal ──
  add("2026-08-25", "08:00", "10:00", "Cell & Molecular Bio Exam 1", "study", "15%. Cell structure through cell cycle disruption."),
  cut("2026-08-25", "Block 1 — Microbiology"),
  cut("2026-08-25", "Block 2 — Cell & Molecular Bio"),
  add("2026-08-25", "17:00", "18:30", "Physiology — cardiac and blood", "study",
    "Physio Exam 1 is Aug 31. Hemostasis, vWF and GPIb vs GPIIb/IIIa, the coagulation cascade (10 → 2 → 1 → 13), albumin and oncotic pressure, left vs right heart failure. Classmates flagged coagulation as the hardest piece."),
  add("2026-08-25", "19:00", "20:00", "Free — two exams in two days", "rest", "Deliberately empty. Take it."),
];

export const TEMP_WEEKS: TempWeek[] = [
  {
    id: "catch-up-aug-2026",
    name: "Catch-up week",
    why: "Sixteen lectures behind. CMB quiz Monday, Micro quiz Wednesday, then Biochem and CMB exams on the 24th and 25th. Everything cuttable is cut.",
    from: "2026-08-14",
    to: "2026-08-25",
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
