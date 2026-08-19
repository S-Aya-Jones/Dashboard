import { ASSESSMENTS, type Assessment } from "@/lib/assessments";

// What you still need, recalculated every time a score lands.
//
// The semester plan works this out once, in a PDF, from Quiz 1. It stops being
// true the moment a second score comes in — and the whole point of the number
// is that it moves. So it lives here as arithmetic instead.
//
// All four syllabi weight identically:
//   Exam 1 15% · Exam 2 25% · Exam 3 25% · five quizzes 25% (5% each)
//   Assignments 5% · Attendance and professionalism 5%
//
// Nothing here is estimated. Given the scores entered, the average needed on
// everything remaining is exact.

export const WEIGHTS = {
  exam: [15, 25, 25] as const,
  quiz: 5,
  assignments: 5,
  attendance: 5,
};

/** The grade boundaries, from the syllabi. */
export const BANDS: Array<[number, string]> = [
  [90, "A"], [85, "B+"], [80, "B"], [75, "C+"], [65, "C"], [0, "F"],
];

export function letterFor(pct: number): string {
  return BANDS.find(([min]) => pct >= min)?.[1] ?? "F";
}

export interface Score {
  /** Matches an Assessment id, e.g. "micro-quiz-1". */
  id: string;
  earned: number;
  outOf: number;
}

export interface CourseGrade {
  course: Assessment["course"];
  short: Assessment["short"];
  /** Percentage points already secured. */
  banked: number;
  /** Percentage points already lost for good. */
  lost: number;
  /** Weight not yet assessed. */
  remaining: number;
  /** Average needed across everything remaining to reach the target. */
  neededFor: Record<string, number | null>;
  /** Where the course lands if everything remaining is average-so-far. */
  projected: number | null;
  graded: Array<{ assessment: Assessment; pct: number; weight: number }>;
  /** Assessments still to come, soonest first. */
  upcoming: Assessment[];
  /** True when even 100% on everything left can't reach an A. */
  aStillPossible: boolean;
}

function weightOf(a: Assessment): number {
  return a.kind === "quiz" ? WEIGHTS.quiz : (WEIGHTS.exam[a.number - 1] ?? 25);
}

/**
 * One course's position.
 *
 * `assumeFullSoftPoints` treats assignments and attendance as full marks,
 * which is what the plan assumes and what the syllabi make easy — but it is an
 * assumption, so it is a flag rather than a hard-coded 10.
 */
export function courseGrade(
  short: Assessment["short"],
  scores: Score[],
  opts: { assumeFullSoftPoints?: boolean; today?: Date } = {},
): CourseGrade {
  const { assumeFullSoftPoints = true, today = new Date() } = opts;
  const mine = ASSESSMENTS.filter(a => a.short === short);
  const byId = new Map(scores.map(s => [s.id, s]));

  let banked = 0;
  let lost = 0;
  const graded: CourseGrade["graded"] = [];

  for (const a of mine) {
    const s = byId.get(a.id);
    if (!s || s.outOf <= 0) continue;
    const pct = Math.max(0, Math.min(1, s.earned / s.outOf));
    const w = weightOf(a);
    banked += w * pct;
    lost += w * (1 - pct);
    graded.push({ assessment: a, pct: pct * 100, weight: w });
  }

  const soft = WEIGHTS.assignments + WEIGHTS.attendance;
  if (assumeFullSoftPoints) banked += soft;

  const assessedWeight = graded.reduce((s, g) => s + g.weight, 0);
  const remaining = 100 - assessedWeight - (assumeFullSoftPoints ? soft : 0);

  const neededFor: Record<string, number | null> = {};
  for (const [min, letter] of BANDS) {
    if (min === 0) continue;
    if (remaining <= 0) { neededFor[letter] = null; continue; }
    const need = ((min - banked) / remaining) * 100;
    // Already secured, or already impossible — both are useful to say, and
    // both are different from a number.
    neededFor[letter] = need <= 0 ? 0 : need;
  }

  const avgSoFar = assessedWeight > 0
    ? (graded.reduce((s, g) => s + g.pct * g.weight, 0) / assessedWeight) / 100
    : null;

  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return {
    course: mine[0]?.course ?? "Biochemistry",
    short,
    banked,
    lost,
    remaining,
    neededFor,
    projected: avgSoFar === null ? null : banked + remaining * avgSoFar,
    graded,
    upcoming: mine
      .filter(a => a.date >= iso && !byId.has(a.id))
      .sort((a, b) => a.date.localeCompare(b.date)),
    aStillPossible: banked + remaining >= 90,
  };
}

export const COURSES: Array<Assessment["short"]> = ["Biochem", "Physio", "Micro", "CMB"];

export function allCourseGrades(scores: Score[], opts?: { assumeFullSoftPoints?: boolean; today?: Date }) {
  return COURSES.map(c => courseGrade(c, scores, opts));
}

/**
 * The scores from Quiz 1, as recorded in the semester plan.
 *
 * Seeded rather than left blank because they are already true and the whole
 * page is useless empty. Everything after this she enters, and any of these can
 * be corrected — they are a starting point, not a fact the app insists on.
 */
export const QUIZ_1: Score[] = [
  { id: "cmb-quiz-1",     earned: 11, outOf: 15 },
  { id: "physio-quiz-1",  earned: 10, outOf: 15 },
  { id: "biochem-quiz-1", earned: 8,  outOf: 15 },
  { id: "micro-quiz-1",   earned: 5,  outOf: 15 },
];

/**
 * A plain-English read on where a course stands.
 *
 * The threshold that matters isn't the average needed, it's how far above the
 * A line that average sits — needing 89.8% is an ordinary semester, needing
 * 94% in a memorisation-heavy course after a 33% is a different problem.
 */
export function verdict(g: CourseGrade): { text: string; tone: "good" | "warn" | "hard" } {
  if (!g.aStillPossible) {
    return { text: "An A is no longer reachable. Protect the B+ and move the hours elsewhere.", tone: "hard" };
  }
  // Compare the number she is shown, not the raw float. 90.9999 prints as
  // "91.0" and was landing in the softer band than the one it reads as.
  const need = Math.round((g.neededFor.A ?? 0) * 10) / 10;
  if (need <= 0) return { text: "The A is already secured. Don't spend more here than it needs.", tone: "good" };
  if (need >= 93) {
    return {
      text: `Needs ${need.toFixed(1)}% on everything left — and there's no rounding promise in the syllabus. Treat the real target as 94+.`,
      tone: "hard",
    };
  }
  if (need >= 91) return { text: `Needs ${need.toFixed(1)}% on everything left. Recoverable, but no slack.`, tone: "warn" };
  return { text: `Needs ${need.toFixed(1)}% on everything left. Recoverable with normal effort.`, tone: "good" };
}
