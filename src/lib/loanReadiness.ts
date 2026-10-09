import type { CreditSnapshot } from "@/lib/creditPlan";

// What the credit score is actually for: school loans.
//
// Like lib/creditPlan.ts this is a rules engine, not a model. The rules are
// published federal ones and the numbers are exact — a fluent guess about
// loan eligibility costs her a semester, so nothing here is generated.
//
// The law changed on 1 July 2026. Grad PLUS is closed to new borrowers, and
// graduate borrowing is capped for the first time. That matters more than any
// score advice, so it is the first thing this returns.
//
// Sources, all checked August 2026:
//   savingforcollege.com/article/grad-plus-loan-changes-2026
//   nasfaa.org — OB3: What Graduate Students Need to Know
//   studentaid.gov — PLUS adverse credit history standard
//   edvisors.com/ask/faq/credit-grad-plus

/** Whether she is inside the Grad PLUS grandfather window. */
export type Grandfathered = "yes" | "no" | "unknown";

/** Federal borrowing limits key off this, and the two differ by 2x. */
export type ProgramType = "graduate" | "professional";

export interface LoanProfile {
  grandfathered: Grandfathered;
  programType: ProgramType;
}

export const DEFAULT_LOAN_PROFILE: LoanProfile = {
  grandfathered: "unknown",
  programType: "graduate",
};

export interface AdverseCheck {
  id: string;
  test: string;
  /** clear = passes, flagged = fails, unknown = the report can't answer it */
  status: "clear" | "flagged" | "unknown";
  detail: string;
}

export interface ReadinessStep {
  id: string;
  title: string;
  detail: string;
  /** Why this one matters for the loan specifically, not for the score. */
  why: string;
  when: string;
  /** Ordering: 1 is do-this-now. */
  rank: number;
}

export interface LoanReadiness {
  headline: string;
  summary: string;
  /** null when she hasn't answered the grandfather question yet. */
  gradPlusOpen: boolean | null;
  limits: { annual: number; aggregate: number; label: string };
  adverse: AdverseCheck[];
  adverseFlagged: boolean;
  /** Private lenders do use a score. This is the number to aim at. */
  scoreTarget: { current: number | null; target: number; gap: number | null; note: string };
  steps: ReadinessStep[];
  /** Things only Meharry's aid office can answer. Never guessed at. */
  askTheAidOffice: string[];
}

const LIMITS: Record<ProgramType, { annual: number; aggregate: number; label: string }> = {
  graduate:     { annual: 20500, aggregate: 100000, label: "Graduate / master's" },
  professional: { annual: 50000, aggregate: 200000, label: "Professional (MD, DDS, JD…)" },
};

/**
 * The Department of Education's adverse-credit standard, run against whatever
 * the report actually shows.
 *
 * This is not a score test — Grad PLUS has never had a minimum score. It is a
 * list of specific events. Where the report can't answer a test the status is
 * "unknown" rather than "clear", because a false all-clear here is the
 * expensive direction to be wrong in.
 */
export function adverseChecks(s: CreditSnapshot | null): AdverseCheck[] {
  if (!s) {
    return [{
      id: "no-report",
      test: "No credit report uploaded yet",
      status: "unknown",
      detail: "Upload a tri-bureau report and every check below fills itself in.",
    }];
  }

  const collections = s.collections ?? 0;
  const derogatory  = s.derogatory ?? 0;
  const delinquent  = s.delinquent ?? 0;
  const records     = s.public_records ?? 0;

  const out: AdverseCheck[] = [];

  const pastDue = collections + derogatory + delinquent;
  out.push({
    id: "past-due",
    test: "No accounts 90+ days late, charged off or in collections in the last 2 years, totalling more than about $2,085",
    status: pastDue > 0 ? "flagged" : "clear",
    detail: pastDue > 0
      ? `${collections} in collections, ${derogatory} derogatory, ${delinquent} delinquent. The test is on the combined balance of those accounts, not the count — check whether they add to more than $2,085.`
      : "Nothing reported past due, charged off or in collections.",
  });

  out.push({
    id: "public-records",
    test: "No bankruptcy discharge, foreclosure, repossession, tax lien or wage garnishment in the last 5 years",
    status: records > 0 ? "flagged" : records === 0 ? "clear" : "unknown",
    detail: records > 0
      ? `${records} public record${records === 1 ? "" : "s"} on file. Any one of these fails the test on its own, regardless of your score.`
      : "No public records reported.",
  });

  out.push({
    id: "federal-default",
    test: "No default on a federal student loan, and no federal debt written off in the last 5 years",
    status: "unknown",
    detail: "A credit report doesn't reliably show this. Check your own record at studentaid.gov — it's free and takes two minutes.",
  });

  return out;
}

function middleScore(s: CreditSnapshot | null): number | null {
  if (!s) return null;
  const v = [s.transunion, s.experian, s.equifax].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  const sorted = [...v].sort((a, b) => a - b);
  return sorted.length === 3 ? sorted[1] : sorted[0] ?? null;
}

export function buildLoanReadiness(
  snapshot: CreditSnapshot | null,
  profile: LoanProfile = DEFAULT_LOAN_PROFILE,
): LoanReadiness {
  const limits = LIMITS[profile.programType];
  const adverse = adverseChecks(snapshot);
  const adverseFlagged = adverse.some(a => a.status === "flagged");
  const score = middleScore(snapshot);

  const gradPlusOpen =
    profile.grandfathered === "yes" ? true
    : profile.grandfathered === "no" ? false
    : null;

  // Private lenders are the ones with a score cutoff, and they are what fills
  // the gap once federal money is capped. 700 is roughly where approval stops
  // depending on a cosigner and the rate stops being punitive.
  const target = 700;
  const scoreTarget = {
    current: score,
    target,
    gap: score !== null ? Math.max(0, target - score) : null,
    note: gradPlusOpen === true
      ? "Neither federal loan checks your score — unsubsidized has no credit check at all, and Grad PLUS is the pass/fail test below. This number is for a private loan on top, and for whether you need a cosigner."
      : "Your federal unsubsidized loan has no credit check — you get it regardless of your score. Approval only becomes a question above the cap, where a private lender takes over. Those do use a score: about 670 gets you looked at with a cosigner, about 700 on your own and at a rate worth having.",
  };

  const steps: ReadinessStep[] = [];

  if (profile.grandfathered === "unknown") {
    steps.push({
      id: "settle-eligibility",
      rank: 1,
      title: "Settle whether Grad PLUS is even open to you",
      detail: "Email Meharry's financial aid office one question: given the 1 July 2026 change, am I eligible for Grad PLUS for this program, or am I capped at the unsubsidized limit? Ask them to confirm in writing.",
      why: "Everything else — how much you can borrow, whether a private loan is in the picture, whether your score matters at all — hangs on this answer. Guessing at it is the expensive mistake.",
      when: "This week. Aid offices get slower as the term goes on.",
    });
  }

  steps.push({
    id: "fafsa",
    rank: 1,
    title: "File the FAFSA — the part nobody can turn you down for",
    detail: "studentaid.gov, once a year. It is what releases the unsubsidized loan, and there is no credit check on it whatsoever.",
    why: "This is the floor under everything else. However your score goes, this money is yours — so the credit work below is only ever about the gap above it, never about whether you can go.",
    when: "As early in the cycle as you can. Some aid is first-come.",
  });

  if (adverseFlagged) {
    steps.push({
      id: "clear-adverse",
      rank: 2,
      title: "Clear the adverse-credit marks, in writing",
      detail: "Request debt validation before paying anything. For valid debts, ask for pay-for-delete in writing — once it's paid you have no leverage. Dispute anything you don't recognise with all three bureaus at once.",
      why: gradPlusOpen === false
        ? "These are what stop a private lender approving you at all, cosigner or not."
        : "Grad PLUS is an adverse-credit test, not a score test. One collection over the threshold fails it outright while a 750 score would have passed.",
      when: "Disputes resolve in 30–45 days. Start now and it's off the report before spring billing.",
    });
  }

  steps.push({
    id: "utilisation",
    rank: 3,
    title: "Get reported card balances under 10%",
    detail: "Pay before the statement closing date, not the due date — the statement balance is the figure that gets reported. Ask for a limit increase on your oldest card; a higher limit lowers utilisation without you paying anything.",
    why: "30% of the score, and the only large factor with no memory — it can move in one cycle. If you need a private loan or a better rate, this is the fastest lever you have.",
    when: "Shows on the next reporting cycle, usually 30 days.",
  });

  steps.push({
    id: "autopay",
    rank: 4,
    title: "Put every minimum payment on autopay",
    detail: "Every account, minimum only, no exceptions. You are about to spend a semester where remembering a due date is not realistic.",
    why: "Payment history is 35% of the score, and a single 30-day late during your program can undo a year of everything else — and creates the exact kind of mark the federal adverse-credit test looks for.",
    when: "Twenty minutes, once. Protects the next four years.",
  });

  if (adverseFlagged && gradPlusOpen === true) {
    steps.push({
      id: "endorser",
      rank: 5,
      title: "Line up an endorser as the backstop",
      detail: "If the adverse marks don't clear in time, Grad PLUS still approves with an endorser — someone without adverse credit who agrees to repay if you don't. You'd also complete PLUS credit counselling.",
      why: "It's the documented route through a failed credit check, and it's better to have asked someone in September than in a panic in January.",
      when: "Ask before you need it.",
    });
  }

  steps.push({
    id: "pull-report",
    rank: 6,
    title: "Pull a fresh tri-bureau report every 90 days",
    detail: "Upload it here and the numbers get tracked against the last one, so you can see what actually moved rather than guessing.",
    why: "You can't tell whether any of the above worked without a before and after.",
    when: "Next one around 90 days from your last pull.",
  });

  steps.sort((a, b) => a.rank - b.rank);

  const headline =
    gradPlusOpen === false
      ? "Your federal loan is automatic. Approval is only a question above the cap."
      : gradPlusOpen === true
      ? "Grad PLUS is open to you — the test is adverse credit, not a score"
      : "One question decides how much you can borrow";

  const summary =
    gradPlusOpen === false
      ? `Nobody checks your credit for the federal unsubsidized loan — $${limits.annual.toLocaleString()} a year, $${limits.aggregate.toLocaleString()} lifetime, yours by filing the FAFSA. Grad PLUS ended for new borrowers on 1 July 2026, so anything above that ceiling comes from a private lender, and that is the only place your score decides whether you are approved.`
      : gradPlusOpen === true
      ? "You started before the cutoff, so Grad PLUS stays open while you're enrolled, for up to three years. It has no minimum credit score — it's a pass/fail check on specific events listed below."
      : "Grad PLUS closed to new borrowers on 1 July 2026, with a carve-out for students already enrolled. Which side you're on changes how much you can borrow and whether your score matters at all.";

  return {
    headline,
    summary,
    gradPlusOpen,
    limits,
    adverse,
    adverseFlagged,
    scoreTarget,
    steps,
    askTheAidOffice: [
      "Am I inside the Grad PLUS grandfather window for this program, or am I a new borrower?",
      `Is the MHS classified as graduate ($${LIMITS.graduate.annual.toLocaleString()}/yr) or professional ($${LIMITS.professional.annual.toLocaleString()}/yr) for loan limits?`,
      "What is the cost of attendance for the year, and what's the gap after the unsubsidized limit?",
      "If I go on to medical school, does what I borrow now count against the professional aggregate limit?",
    ],
  };
}
