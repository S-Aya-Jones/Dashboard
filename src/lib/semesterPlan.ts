import { ASSESSMENTS, type Assessment } from "@/lib/assessments";

// The fourteen weeks, Aug 19 to Nov 20.
//
// From the Fall 2026 semester plan. The weekly rhythm lives in weekPlan.ts —
// this is what that rhythm is pointed at on any given week, so the blocks say
// what to study rather than just "Block 1".
//
// One deliberate departure from the source document: it puts 60 minutes of
// study before work, five mornings a week. She has said twice that she does not
// wake at five-something, and the whole schedule was rebuilt around that. A
// plan that assumes a wake-up time she doesn't hit is a plan that fails in week
// two, so those five hours are found in the Saturday block and the Sunday
// evening instead. See WEEKLY_HOURS below for the arithmetic.

export interface SemesterWeek {
  n: number;
  from: string;
  to: string;
  /** What this week is actually for. */
  focus: string;
  /** Work that has to happen now to make a later week survivable. */
  getAhead: string;
  /** True for the weeks the plan marks as pressure points. */
  heavy?: boolean;
}

export const SEMESTER: SemesterWeek[] = [
  { n: 1, from: "2026-08-19", to: "2026-08-23",
    focus: "Exam 1 sprint: Biochem (buffers, amino acids, proteins, enzymes I and II) and CMB (cell structure, culture and stem cells, signalling I and II, cell cycle, cancer). Rework every missed Quiz 1 question first.",
    getAhead: "Micro flashcards 20 min daily: bacterial cytology and physiology" },
  { n: 2, from: "2026-08-24", to: "2026-08-30", heavy: true,
    focus: "Biochem Exam 1 Monday, CMB Exam 1 Tuesday. After Tuesday pivot hard to Physio (fluid homeostasis, membrane transport, NMJ and muscle, heart and circulation) and Micro (cytology, physiology, antimicrobials, gene regulation, microbial variation, genetic exchange).",
    getAhead: "CMB Quiz 2 topics: DNA structure, chromatin, replication" },
  { n: 3, from: "2026-08-31", to: "2026-09-06", heavy: true,
    focus: "Physio Exam 1 Monday, Micro Exam 1 Tuesday, CMB Quiz 2 Friday. Two exams then a quiz in five days — CMB Quiz 2 prep happens Wednesday and Thursday only, so it must already be loaded.",
    getAhead: "Biochem Quiz 2: metabolism basics, carbohydrates, glycolysis, TCA" },
  { n: 4, from: "2026-09-07", to: "2026-09-13",
    focus: "Breathing room — the only real gap all semester. Use it. Biochem metabolism plus a full head start on next week's three-quiz pile-up. Start the Micro immunology deck now.",
    getAhead: "Physio respiratory, Micro immunology, CMB mutation and transcription" },
  { n: 5, from: "2026-09-14", to: "2026-09-20", heavy: true,
    focus: "Three quizzes in four days: Physio Quiz 2 Tuesday, Micro Quiz 2 Wednesday, CMB Quiz 3 Friday. Zero prep time available during the week, which is why W4 carried it.",
    getAhead: "CMB Exam 2 is two days after Quiz 3" },
  { n: 6, from: "2026-09-21", to: "2026-09-27", heavy: true,
    focus: "CMB Exam 2 Tuesday covers exactly what Quizzes 2 and 3 just covered, so Monday is error-log review only, not relearning. Then Biochem oxidative phosphorylation, PPP, glycogen for Quiz 3 Friday.",
    getAhead: "Begin Micro Exam 2 and Physio Exam 2 prep" },
  { n: 7, from: "2026-09-28", to: "2026-10-04",
    focus: "The setup week for the worst week of the semester. Physio renal for Quiz 3 Friday, and simultaneously build the Micro immunology and Physio cardio review. Do not enter October behind.",
    getAhead: "Everything for Oct 5–11. Seriously." },
  { n: 8, from: "2026-10-05", to: "2026-10-11", heavy: true,
    focus: "The hardest week of the term — Micro Exam 2 Tuesday, CMB Quiz 4 Wednesday, Physio Exam 2 Friday. 50 percentage points plus a quiz. No new learning this week, only review of W6 and W7 work. Take PTO Oct 5–9 if you can get it.",
    getAhead: "Biochem Exam 2 is the following Monday" },
  { n: 9, from: "2026-10-12", to: "2026-10-18", heavy: true,
    focus: "Biochem Exam 2 Monday — eleven topics, the whole metabolism and lipid block. Then Micro pivots to organisms for Quiz 3 Friday: staph and strep, coryne and myco, bordetella group.",
    getAhead: "CMB recombinant DNA, Physio GI" },
  { n: 10, from: "2026-10-19", to: "2026-10-25",
    focus: "Recovery week. Physio GI for Quiz 4 Friday. Rebuild the Micro organism deck properly, since Exam 3 is eleven lectures of it.",
    getAhead: "CMB genetics block, Biochem nitrogen metabolism" },
  { n: 11, from: "2026-10-26", to: "2026-11-01",
    focus: "CMB Quiz 5 Monday: genetics — mitosis and meiosis, inheritance, cytogenetics, Mendelian and non-Mendelian. Biochem Quiz 4 Friday: nitrogen and amino acid metabolism, urea cycle, gluconeogenesis, clotting and haemoglobin.",
    getAhead: "Micro CNS, rickettsiae, enterics and mycology" },
  { n: 12, from: "2026-11-02", to: "2026-11-08", heavy: true,
    focus: "Micro Quiz 4 Monday, Physio Quiz 5 Thursday. Micro organisms round two; Physio endocrine (pituitary, adrenal, parathyroid and calcium, pancreas). Begin CMB Exam 3 review Wednesday.",
    getAhead: "All three Exam 3s are in the next 12 days" },
  { n: 13, from: "2026-11-09", to: "2026-11-15", heavy: true,
    focus: "CMB Exam 3 Monday — includes population genetics and pedigree analysis, never quizzed, so they need fresh work. Micro Quiz 5 Wednesday (viruses), Biochem Quiz 5 Thursday (nucleic acids, vitamins and minerals, hormones). Complete every course evaluation within 3 days of receipt.",
    getAhead: "Biochem and Micro Exam 3" },
  { n: 14, from: "2026-11-16", to: "2026-11-20", heavy: true,
    focus: "Three finals in five days, none cumulative. Biochem Exam 3 Monday, Micro Exam 3 Wednesday — eleven organism lectures, the single heaviest recall load of the term — Physio Exam 3 Friday, which adds male and female reproduction, taught last.",
    getAhead: "Done." },
];

export interface Checkpoint {
  date: string;
  title: string;
  know: string;
  decide: string;
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    date: "2026-09-06",
    title: "First checkpoint",
    know: "All four Exam 1 scores are in.",
    decide: "Recalculate every target on the Grades page. If Micro Exam 1 came in under 85, the Micro A is already unlikely — shift 3 to 4 hours a week from Micro into Biochem, which is the next most fragile.",
  },
  {
    date: "2026-10-13",
    title: "The go / no-go",
    know: "All four Exam 2 scores. 55% of each grade is settled.",
    decide: "Any course still mathematically live for an A gets full effort; any that isn't gets maintenance only. Do the arithmetic honestly rather than hoping — the Grades page will tell you which is which.",
  },
  {
    date: "2026-11-08",
    title: "Final allocation",
    know: "Everything except the three finals.",
    decide: "Allocate the last two weeks by how many points each A is still short. Not by which subject you like most.",
  },
];

/**
 * Where the plan's 20–22 hours actually come from, without any early mornings.
 *
 * Written down because the source document reaches its total by assuming five
 * 60-minute pre-work blocks, and dropping those without replacing them would
 * quietly turn a 21-hour plan into a 16-hour one.
 */
export const WEEKLY_HOURS: Array<{ slot: string; hours: number; note: string }> = [
  { slot: "Mon–Thu evenings", hours: 10, note: "Two blocks a night: 17:00–18:30 and 19:00–20:00" },
  { slot: "Saturday", hours: 4.5, note: "The big block, 12:00–16:30 — closed-notes self test, then patch" },
  { slot: "Sunday evening", hours: 2.5, note: "Error log across all four courses, plus the Micro deck" },
  { slot: "Sunday reset", hours: 0.5, note: "Look 14 days ahead, confirm downloads, set priorities" },
  { slot: "Micro deck", hours: 1.75, note: "15 minutes daily, taken off the front of Block 1" },
  { slot: "Friday", hours: 0, note: "Off. Non-negotiable — a plan you can't sustain for 14 weeks isn't a plan." },
];

export const WEEKLY_TOTAL = WEEKLY_HOURS.reduce((s, x) => s + x.hours, 0);

/** The block format the plan prescribes, used for every study block. */
export const BLOCK_FORMAT = [
  { minutes: 15, what: "Skim slides or notes for structure, not detail. You're building a map, not reading." },
  { minutes: 35, what: "Retrieval — answer questions cold, notes closed. This is the part that moves scores. Rereading does not." },
  { minutes: 15, what: "Error log. Every miss, with a one-sentence fix in your own words. The log is what you review before exams, not your notes." },
];

export function weekFor(date: string): SemesterWeek | null {
  return SEMESTER.find(w => date >= w.from && date <= w.to) ?? null;
}

export function nextCheckpoint(date: string): Checkpoint | null {
  return CHECKPOINTS.find(c => c.date >= date) ?? null;
}

/** Assessments inside a week, soonest first. */
export function assessmentsIn(w: SemesterWeek): Assessment[] {
  return ASSESSMENTS.filter(a => a.date >= w.from && a.date <= w.to)
    .sort((a, b) => a.date.localeCompare(b.date));
}
