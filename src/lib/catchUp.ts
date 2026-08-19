import { PlanBlock, planForDay, planMinutes, DAY_ORDER } from "@/lib/weekPlan";

// Catch-up week.
//
// A week where the schedule has to bend. The instinct when behind is to cut
// sleep, the gym and the people — the things that are actually holding her up —
// because they feel optional in a way a lecture doesn't. This decides in
// advance what gets cut and what doesn't, so the decision isn't made at 11pm
// by whoever is most tired.
//
// Three tiers:
//   fixed      work, classes, sleep — not hers to move
//   protected  therapy, church, gym, Deandra, wind-down — the load-bearing ones
//   cuttable   everything that survives a week off

export type Tier = "fixed" | "protected" | "cuttable" | "study";

/** Cut first, and in this order, when a week has to give. */
const CUTTABLE = [
  /^Legal/i,
  /shadowing/i,
  /cleaning/i,
  /^Flex/i, /^Home · flex/i,
  /exposure drive/i, /driving exposure/i,
  /groceries/i,
  /budget check/i,
  /buffer/i,
];

/** Never cut, however far behind she is. */
const PROTECTED = [
  /therapy/i,
  /church/i,
  /^Gym/i,
  /deandra/i,
  /skincare/i,
  /^Up\b/i, /^Up —/i,
  /shower/i,
  /dinner|lunch/i,
  /cook/i,          // she still has to eat next week
  /family time/i,
  /week planning/i, // the thing that stops next week going the same way
  // Thirty minutes with the person who writes the quiz is worth more in a
  // catch-up week than it is in a normal one, not less.
  /office hours/i,
  // Her only genuinely open block. Cutting the recovery time to buy study
  // hours is how a catch-up week turns into a worse one.
  /^Open —/i,
];

export function tierOf(b: PlanBlock): Tier {
  if (b.cat === "work") return "fixed";
  if (PROTECTED.some(r => r.test(b.label))) return "protected";
  if (CUTTABLE.some(r => r.test(b.label))) return "cuttable";
  if (b.cat === "study") return "study";
  if (b.cat === "exposure") return "cuttable";
  if (b.cat === "rest") return "protected";
  return "cuttable";
}

export function blockMinutes(b: PlanBlock): number {
  return planMinutes(b.end) - planMinutes(b.start);
}

export interface CatchUpBlock {
  block: PlanBlock;
  tier: Tier;
  /** Reclaimed slots become study time and say what for. */
  reclaimedFor?: string;
}

export interface CatchUpDay {
  dow: number;
  blocks: CatchUpBlock[];
  /** Minutes freed by cutting, which is the honest measure of the plan. */
  reclaimedMinutes: number;
  /** Minutes of study this day already had. */
  existingStudyMinutes: number;
}

/**
 * The week with cuts applied. Cut blocks are kept in the list rather than
 * removed — seeing what was given up is the point, and it makes putting them
 * back a decision rather than an act of memory.
 */
export function catchUpWeek(subjects: string[] = []): CatchUpDay[] {
  let subjectIdx = 0;
  const nextSubject = () =>
    subjects.length ? subjects[subjectIdx++ % subjects.length] : "the subject you're furthest behind in";

  return DAY_ORDER.map(dow => {
    const blocks = planForDay(dow);
    let reclaimed = 0;
    let existingStudy = 0;

    const out: CatchUpBlock[] = blocks.map(b => {
      const tier = tierOf(b);
      if (tier === "study") existingStudy += blockMinutes(b);
      if (tier !== "cuttable") return { block: b, tier };

      const mins = blockMinutes(b);
      reclaimed += mins;
      // Anything under half an hour isn't worth renaming into a study block.
      return mins >= 30
        ? { block: b, tier, reclaimedFor: nextSubject() }
        : { block: b, tier };
    });

    return { dow, blocks: out, reclaimedMinutes: reclaimed, existingStudyMinutes: existingStudy };
  });
}

export function totalReclaimed(week: CatchUpDay[]): number {
  return week.reduce((n, d) => n + d.reclaimedMinutes, 0);
}

export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
