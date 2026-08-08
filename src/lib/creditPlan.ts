// What's actually dragging the score, and what to do about it.
//
// This is deliberately a rules engine rather than a model. The advice is
// financial, the inputs are exact numbers, and the FICO factor weights are
// published — a wrong-but-fluent answer here costs real money, so nothing in
// this file is generated.
//
// FICO's published weighting, which is what the ranking is built on:
//   Payment history        35%
//   Amounts owed           30%   (utilisation dominates this)
//   Length of history      15%
//   New credit             10%
//   Credit mix             10%

export interface CreditSnapshot {
  report_date: string;
  transunion: number | null;
  experian: number | null;
  equifax: number | null;
  open_accounts: number | null;
  closed_accounts: number | null;
  delinquent: number | null;
  derogatory: number | null;
  collections: number | null;
  balances: number | null;
  monthly_payments: number | null;
  inquiries: number | null;
  public_records: number | null;
  credit_limit?: number | null;
  late_payments?: number | null;
  oldest_account_years?: number | null;
}

export interface Finding {
  id: string;
  /** The FICO factor this sits under. */
  factor: "Payment history" | "Amounts owed" | "Length of history" | "New credit" | "Credit mix";
  /** How much of the score this factor is worth. */
  weight: number;
  severity: "critical" | "high" | "moderate" | "low" | "good";
  headline: string;
  /** What the number actually is. */
  detail: string;
  /** What to do, concretely. */
  actions: string[];
  /** Honest expectation — no promises of a specific number. */
  timeline: string;
}

export interface CreditPlan {
  score: number | null;
  band: string;
  spread: number | null;
  utilisation: number | null;
  findings: Finding[];
  /** The one thing to do first. */
  firstMove: string | null;
  nextReviewDate: string;
}

function band(score: number | null): string {
  if (score === null) return "Unknown";
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0, high: 1, moderate: 2, low: 3, good: 4,
};

export function buildCreditPlan(s: CreditSnapshot): CreditPlan {
  const scores = [s.transunion, s.experian, s.equifax].filter(
    (n): n is number => typeof n === "number" && n > 0
  );
  // The middle score is the one most mortgage and auto lenders actually use.
  const sorted = [...scores].sort((a, b) => a - b);
  const score = sorted.length === 3 ? sorted[1] : sorted.length ? sorted[0] : null;
  const spread = sorted.length > 1 ? sorted[sorted.length - 1] - sorted[0] : null;

  const utilisation =
    s.credit_limit && s.credit_limit > 0 && typeof s.balances === "number"
      ? Math.round((s.balances / s.credit_limit) * 100)
      : null;

  const findings: Finding[] = [];

  // ── Payment history (35%) ─────────────────────────────────────────────────
  const collections = s.collections ?? 0;
  const derogatory  = s.derogatory ?? 0;
  const delinquent  = s.delinquent ?? 0;
  const lates       = s.late_payments ?? 0;

  if (collections > 0 || derogatory > 0) {
    findings.push({
      id: "collections",
      factor: "Payment history",
      weight: 35,
      severity: "critical",
      headline: "Collections and derogatory marks are the single biggest drag",
      detail: `${collections} collection${collections === 1 ? "" : "s"} and ${derogatory} derogatory mark${derogatory === 1 ? "" : "s"} on file.`,
      actions: [
        "Request debt validation in writing before paying anything — a collector that can't validate has to remove the entry.",
        "For anything valid, ask for a pay-for-delete in writing before you pay. Once it's paid you lose the leverage.",
        "Dispute anything you don't recognise with all three bureaus at once, not one at a time.",
        "Never pay a collection with a phone-call promise. Only in writing.",
      ],
      timeline: "Disputes resolve in 30–45 days. Removals show on the next report; a paid-but-not-removed collection helps far less than a deleted one.",
    });
  } else if (delinquent > 0 || lates > 0) {
    findings.push({
      id: "delinquent",
      factor: "Payment history",
      weight: 35,
      severity: "high",
      headline: "Late payments are holding the biggest factor down",
      detail: `${delinquent || lates} account${(delinquent || lates) === 1 ? "" : "s"} marked late or delinquent.`,
      actions: [
        "Bring every account current first — that stops the bleeding before anything else helps.",
        "Send a goodwill letter on any account you've since kept clean; a single late on an otherwise good history is often removed on request.",
        "Put every minimum payment on autopay so this can't recur.",
      ],
      timeline: "A late stops hurting more each month it ages. Most of the damage fades by 24 months, and it drops off entirely at 7 years.",
    });
  } else {
    findings.push({
      id: "payment-clean",
      factor: "Payment history",
      weight: 35,
      severity: "good",
      headline: "Payment history is clean",
      detail: "No collections, derogatory marks or delinquencies reported.",
      actions: ["Keep every account on autopay for at least the minimum. This is 35% of the score and it's already working for you."],
      timeline: "Protect it — one 30-day late can cost more than a year of other progress.",
    });
  }

  // ── Amounts owed (30%) ────────────────────────────────────────────────────
  if (utilisation !== null) {
    const sev: Finding["severity"] =
      utilisation >= 75 ? "critical" :
      utilisation >= 50 ? "high" :
      utilisation >= 30 ? "moderate" :
      utilisation >= 10 ? "low" : "good";

    const target = Math.round((s.credit_limit ?? 0) * 0.09);
    const toPay  = Math.max(0, Math.round((s.balances ?? 0) - target));

    findings.push({
      id: "utilisation",
      factor: "Amounts owed",
      weight: 30,
      severity: sev,
      headline:
        sev === "good"
          ? "Utilisation is in the ideal band"
          : `Utilisation is at ${utilisation}% — this is the fastest thing you can change`,
      detail: `$${(s.balances ?? 0).toLocaleString()} owed against $${(s.credit_limit ?? 0).toLocaleString()} of limit.`,
      actions: sev === "good"
        ? ["Keep reported balances under 10%. Paying before the statement closes, not before the due date, is what controls the reported figure."]
        : [
            `Getting under 9% overall means paying down about $${toPay.toLocaleString()}.`,
            "Pay before the statement closing date, not the due date — the statement balance is what gets reported.",
            "Ask for a credit limit increase on your oldest card. A higher limit drops utilisation without you paying anything.",
            "Never close an old card to tidy up — it removes limit and raises utilisation.",
            "Spread balances rather than maxing one card; per-card utilisation counts as well as overall.",
          ],
      timeline: "This is the one that moves fastest — utilisation has no memory, so a paydown can show on the next reporting cycle, usually 30 days.",
    });
  } else {
    findings.push({
      id: "utilisation-unknown",
      factor: "Amounts owed",
      weight: 30,
      severity: "moderate",
      headline: "Utilisation couldn't be read from this report",
      detail: "The report didn't include total credit limits, so the ratio that drives 30% of the score can't be calculated.",
      actions: ["Upload a report that lists account limits, or add your total limit by hand — without it the second-biggest factor is invisible."],
      timeline: "Worth fixing before the next pull so progress is measurable.",
    });
  }

  // ── Length of history (15%) ───────────────────────────────────────────────
  const age = s.oldest_account_years;
  if (age !== null && age !== undefined) {
    findings.push({
      id: "age",
      factor: "Length of history",
      weight: 15,
      severity: age >= 7 ? "good" : age >= 3 ? "low" : "moderate",
      headline: age >= 7 ? "History length is working for you" : "History is still young — mostly a matter of time",
      detail: `Oldest account is about ${age} year${age === 1 ? "" : "s"} old.`,
      actions: [
        "Never close your oldest card, even if you don't use it. Put one small recurring charge on it and autopay it.",
        "Avoid opening new accounts you don't need — each one lowers your average age.",
      ],
      timeline: "This only improves by waiting. The main thing is not damaging it.",
    });
  }

  // ── New credit (10%) ──────────────────────────────────────────────────────
  const inquiries = s.inquiries ?? 0;
  if (inquiries > 0) {
    findings.push({
      id: "inquiries",
      factor: "New credit",
      weight: 10,
      severity: inquiries >= 6 ? "high" : inquiries >= 3 ? "moderate" : "low",
      headline: inquiries >= 3 ? "Recent applications are costing you a little" : "Inquiries are not a real problem",
      detail: `${inquiries} hard inquir${inquiries === 1 ? "y" : "ies"} in the last two years.`,
      actions: [
        "Hold off on new applications until the bigger factors are fixed.",
        "When you do shop for a car or mortgage rate, keep it inside a 14-day window — those count as one inquiry.",
        "Checking your own report is a soft pull and never costs you anything.",
      ],
      timeline: "Inquiries stop counting toward the score after 12 months and drop off at 24.",
    });
  }

  // ── Credit mix (10%) ──────────────────────────────────────────────────────
  const open = s.open_accounts ?? 0;
  if (open <= 2) {
    findings.push({
      id: "mix",
      factor: "Credit mix",
      weight: 10,
      severity: open === 0 ? "moderate" : "low",
      headline: "Thin file — few open accounts",
      detail: `${open} open account${open === 1 ? "" : "s"} reporting.`,
      actions: [
        "A secured card or credit-builder loan adds history without much risk.",
        "Being added as an authorised user on someone else's long, clean account inherits their history.",
      ],
      timeline: "Slow. Only worth doing once payment history and utilisation are handled.",
    });
  }

  findings.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return sev !== 0 ? sev : b.weight - a.weight;
  });

  // On a clean file there is nothing to fix, but there is still something to
  // do — protecting a good score is its own instruction.
  const worst = findings.find((f) => f.severity !== "good") ?? findings[0];
  const next = new Date();
  next.setDate(next.getDate() + 90);

  return {
    score,
    band: band(score),
    spread,
    utilisation,
    findings,
    firstMove: worst ? worst.actions[0] : null,
    nextReviewDate: next.toISOString().slice(0, 10),
  };
}
