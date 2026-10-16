import type { CreditSnapshot } from "@/lib/creditPlan";
import { cardUtilisation, type CreditAccount } from "@/lib/creditAccounts";

// The plan, named down to the account.
//
// lib/creditPlan.ts ranks the FICO *factors* — useful, but it can only ever say
// "get utilisation under 10%". This says "pay Capital One $853 by the 12th,
// because that card is at 94% of its $1,000 limit, and here is how to check it
// worked." Same rules engine philosophy: published FICO weights, exact
// arithmetic on her own numbers, nothing generated.
//
// On the score projection: FICO does not publish point values for actions, and
// anyone quoting you an exact number is guessing. The ranges below are wide on
// purpose and labelled as estimates everywhere they surface. The arithmetic —
// what to pay, to what balance, by when — is exact. Only the points are a
// forecast.

export type MoveAction = "pay" | "dispute" | "call" | "autopay" | "check" | "ask";

export interface Move {
  id: string;
  action: MoveAction;
  /** The instruction, with the number in it. */
  title: string;
  account?: string;
  /** Dollars, when the move is a payment. */
  amount?: number;
  /** What this is fixing — the specific thing on the report that hurts. */
  hurting: string;
  /** Exact steps. */
  steps: string[];
  /** How she knows it landed. */
  check: string;
  /** Where every number in this move came from, shown as arithmetic. */
  math: string[];
  /** The account itself, when there is one — the letters are built from it. */
  ref?: CreditAccount;
  impact: "large" | "medium" | "small";
  /** Estimated score points. Wide, and never presented as a promise. */
  estPoints: [number, number];
  when: string;
}

export interface ActionPlan {
  moves: Move[];
  utilisation: {
    current: number | null;
    after: number | null;
    /** Total to pay across all cards to land under 9%. */
    totalToPay: number;
  };
  projection: {
    current: number | null;
    low: number | null;
    high: number | null;
    /** Where a private lender stops needing a cosigner. */
    target: number;
    /** Lowest score most private lenders will look at, with a cosigner. */
    floor: number;
    note: string;
  };
  /** True when the report had no account detail to work from. */
  summaryOnly: boolean;
}

/** Where private student lenders generally sit. Federal unsubsidized has no credit check at all. */
export const APPROVAL_TARGET = 700;
export const APPROVAL_FLOOR = 670;

/** The reported balance that stops costing points — just under 10%. */
const TARGET_UTIL = 0.09;

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/**
 * Points available from fixing utilisation, by how bad it is now. Utilisation
 * is the one large factor with no memory, which is why the band is wide at the
 * top: someone at 95% has a lot to win back and someone at 20% has little.
 */
function utilisationBand(current: number): [number, number] {
  if (current >= 90) return [40, 80];
  if (current >= 70) return [30, 60];
  if (current >= 50) return [20, 45];
  if (current >= 30) return [10, 30];
  if (current >= 10) return [5, 15];
  return [0, 0];
}

export function buildActionPlan(
  snapshot: CreditSnapshot | null,
  accounts: CreditAccount[],
): ActionPlan {
  const moves: Move[] = [];
  const from = snapshot?.report_date ? `your ${snapshot.report_date} report` : "your report";

  const scores = snapshot
    ? [snapshot.transunion, snapshot.experian, snapshot.equifax].filter(
        (n): n is number => typeof n === "number" && n > 0,
      )
    : [];
  const sorted = [...scores].sort((a, b) => a - b);
  const current = sorted.length === 3 ? sorted[1] : sorted[0] ?? null;

  const cards = accounts.filter(a => a.kind === "card" && a.limit && a.limit > 0);
  const totalLimit = cards.reduce((s, a) => s + (a.limit ?? 0), 0);
  const totalBalance = cards.reduce((s, a) => s + (a.balance ?? 0), 0);

  // Prefer the accounts when we have them; fall back to the report totals.
  const overallUtil =
    totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100)
    : snapshot?.credit_limit && snapshot.credit_limit > 0 && typeof snapshot.balances === "number"
      ? Math.round((snapshot.balances / snapshot.credit_limit) * 100)
      : null;

  const totalToPay =
    totalLimit > 0 ? Math.max(0, Math.round(totalBalance - totalLimit * TARGET_UTIL))
    : snapshot?.credit_limit && typeof snapshot.balances === "number"
      ? Math.max(0, Math.round(snapshot.balances - snapshot.credit_limit * TARGET_UTIL))
      : 0;

  const utilPoints: [number, number] = overallUtil !== null ? utilisationBand(overallUtil) : [0, 0];

  // ── Pay: one move per card that is actually costing her ───────────────────
  //
  // Points are shared out across the cards in proportion to the balance each
  // one removes, so the itemised moves add up to the overall utilisation gain
  // rather than each claiming the whole thing.
  const payable = cards
    .map(a => {
      const util = cardUtilisation(a)!;
      const target = Math.floor((a.limit ?? 0) * TARGET_UTIL);
      const pay = Math.max(0, Math.round((a.balance ?? 0) - target));
      return { a, util, target, pay };
    })
    .filter(c => c.pay > 0 && c.util >= 30)
    .sort((x, y) => y.util - x.util);

  const payableTotal = payable.reduce((s, c) => s + c.pay, 0) || 1;
  const utilTotal = payable.reduce((s, c) => s + c.util, 0) || 1;

  // How the utilisation points split across the cards.
  //
  // Dollars alone under-credits a small maxed card: paying $850 off a card
  // sitting at 94% of its limit does more than its share of the total, because
  // per-card utilisation is scored on its own as well as feeding the overall
  // ratio. Weighting mostly by dollars and partly by how maxed the card is
  // keeps the shares adding up to the overall band while reflecting that.
  const weightOf = (c: { pay: number; util: number }) =>
    0.7 * (c.pay / payableTotal) + 0.3 * (c.util / utilTotal);

  // The cheapest card to drop under 30% — the quickest visible win, which
  // matters more than optimality when the money is tight.
  const cheapest = [...payable]
    .map(c => ({ ...c, toThirty: Math.max(0, Math.round((c.a.balance ?? 0) - (c.a.limit ?? 0) * 0.29)) }))
    .sort((x, y) => x.toThirty - y.toThirty)[0];

  // Which card to clear first, in her hands rather than in the abstract: the
  // one that buys the most score per dollar.
  const best = [...payable].sort((x, y) => weightOf(y) / y.pay - weightOf(x) / x.pay)[0];

  payable.forEach((c) => {
    const share = weightOf(c);
    const lo = Math.round(utilPoints[0] * share);
    const hi = Math.round(utilPoints[1] * share);
    const isCheapest = cheapest && c.a.name === cheapest.a.name && payable.length > 1;
    const isBest = best && c.a.name === best.a.name && payable.length > 1;

    moves.push({
      id: `pay-${c.a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      action: "pay",
      title: `${isBest ? "First card to pay: " : "Pay "}${c.a.name} down to ${money(c.target)}`,
      ref: c.a,
      math: [
        `Balance now: ${money(c.a.balance ?? 0)} · Limit: ${money(c.a.limit ?? 0)}`,
        `${money(c.a.balance ?? 0)} ÷ ${money(c.a.limit ?? 0)} = ${c.util}% used on this card`,
        `Target is 9% of the limit: ${money(c.a.limit ?? 0)} × 0.09 = ${money(c.target)}`,
        `So the payment is ${money(c.a.balance ?? 0)} − ${money(c.target)} = ${money(c.pay)}`,
        `All from ${from}.`,
      ],
      account: c.a.name,
      amount: c.pay,
      hurting: `${c.a.name} is at ${c.util}% of its ${money(c.a.limit ?? 0)} limit — ${money(c.a.balance ?? 0)} owed. Per-card utilisation is scored as well as your overall figure, so a single maxed card drags you down even if the others are clean.`,
      steps: [
        `Pay ${money(c.pay)} to bring the balance to ${money(c.target)} or below.`,
        "Pay before the statement closing date, not the due date — the statement balance is the number that gets reported.",
        isCheapest
          ? `If you can only do one this month, do this one: ${money(cheapest.toThirty)} gets it under 30%, which is where the steepest part of the penalty stops.`
          : "Ask for a limit increase on this card at the same time — a higher limit lowers utilisation without you paying anything more.",
        "Don't close it afterwards. A closed card takes its limit with it and pushes utilisation back up.",
      ],
      check: `Next statement, confirm the reported balance is ${money(c.target)} or lower. It shows on your report about 30 days after the statement closes.`,
      impact: share >= 0.4 ? "large" : share >= 0.18 ? "medium" : "small",
      estPoints: [lo, hi],
      when: "This statement cycle",
    });
  });

  // No account detail — say the same thing at the level we can.
  if (!payable.length && totalToPay > 0 && overallUtil !== null) {
    moves.push({
      id: "pay-overall",
      action: "pay",
      title: `Pay down ${money(totalToPay)} across your cards`,
      amount: totalToPay,
      math: [
        `Owed across your cards: ${money(snapshot?.balances ?? 0)}`,
        `Total credit limit: ${money(snapshot?.credit_limit ?? 0)}`,
        `${money(snapshot?.balances ?? 0)} ÷ ${money(snapshot?.credit_limit ?? 0)} = ${overallUtil}% used`,
        `Target is 9%: ${money(snapshot?.credit_limit ?? 0)} × 0.09 = ${money(Math.round((snapshot?.credit_limit ?? 0) * TARGET_UTIL))}`,
        `So the paydown is ${money(totalToPay)}. All from ${from}.`,
      ],
      hurting: `Your cards are at ${overallUtil}% of your total limit. That's 30% of your score and the fastest part of it to change.`,
      steps: [
        `${money(totalToPay)} total gets you under 9% overall.`,
        "Start with whichever card is closest to its limit — per-card utilisation counts as well as the total.",
        "Pay before each statement closing date, not the due date.",
        "Ask for limit increases on your oldest cards; a higher limit lowers the ratio for free.",
      ],
      check: "Pull a fresh report in 30 days and confirm the total balance dropped.",
      impact: "large",
      estPoints: utilPoints,
      when: "This statement cycle",
    });
  }

  // ── Dispute: named collections ────────────────────────────────────────────
  const collections = accounts.filter(a => a.kind === "collection" || a.status === "collection" || a.status === "chargeoff");
  const listedCollections = collections.slice(0, 4);

  listedCollections.forEach(a => {
    const recent = a.openedYear !== null && a.openedYear >= new Date().getFullYear() - 2;
    moves.push({
      id: `dispute-${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      action: "dispute",
      title: `Challenge ${a.name}${a.balance ? ` — ${money(a.balance)}` : ""}`,
      account: a.name,
      ref: a,
      math: [
        `Reported by: ${a.name}`,
        `Balance claimed: ${a.balance !== null ? money(a.balance) : "not shown on the report"}`,
        `Status: ${a.status}${a.openedYear ? ` · opened ${a.openedYear}` : ""}`,
        a.address ? `Their address on your report: ${a.address}` : "No mailing address printed on your report for them.",
        `All from ${from}.`,
      ],
      ...(a.balance !== null ? { amount: a.balance } : {}),
      hurting: `A ${a.status === "chargeoff" ? "charge-off" : "collection"}${a.openedYear ? ` from ${a.openedYear}` : ""}. Payment history is 35% of your score — the largest single factor — and this is also the exact kind of entry the federal loan credit check looks for.`,
      steps: [
        "Send a debt validation letter first, in writing, before paying anything. A collector that can't validate has to remove the entry.",
        "If it validates, offer pay-for-delete in writing and get the agreement in writing before any money moves. Once it's paid you have no leverage left.",
        "If you don't recognise it, dispute with all three bureaus at once — not one at a time.",
        "Never agree to anything on a phone call. Written only.",
      ],
      check: `Disputes must be answered in 30–45 days. Re-pull around ${inDays(45)} and confirm ${a.name} is gone or marked deleted — a paid-but-still-listed collection helps far less than a removed one.`,
      impact: recent ? "large" : "medium",
      estPoints: recent ? [15, 45] : [5, 25],
      when: "Send the letter this week",
    });
  });

  // Collections the report counted but didn't name.
  const unnamed = (snapshot?.collections ?? 0) + (snapshot?.derogatory ?? 0) - listedCollections.length;
  if (unnamed > 0 && !listedCollections.length) {
    moves.push({
      id: "dispute-unnamed",
      action: "dispute",
      title: `Challenge the ${unnamed} mark${unnamed === 1 ? "" : "s"} on your report`,
      math: [
        `Collections on file: ${snapshot?.collections ?? 0}`,
        `Derogatory marks: ${snapshot?.derogatory ?? 0}`,
        `Your report didn't list them by name, so the count is all we have. From ${from}.`,
      ],
      hurting: `Your report shows ${snapshot?.collections ?? 0} in collections and ${snapshot?.derogatory ?? 0} derogatory marks. That's the 35% factor, and it's what a lender's credit check keys on.`,
      steps: [
        "Open the report and write down each collector's name and the amount.",
        "Send a debt validation letter to each one before paying anything.",
        "Dispute anything you don't recognise with all three bureaus at once.",
        "Get pay-for-delete in writing before paying anything that does validate.",
      ],
      check: `Re-pull around ${inDays(45)} and count the marks again.`,
      impact: "large",
      estPoints: [15, 45],
      when: "This week",
    });
  }

  // ── Call: anything actually past due right now ────────────────────────────
  const pastDue = accounts.filter(a => a.status === "late" || (a.pastDue ?? 0) > 0);
  const pastDueTotal = pastDue.reduce((s, a) => s + (a.pastDue ?? 0), 0);
  if (pastDue.length || (snapshot?.delinquent ?? 0) > 0) {
    const named = pastDue.map(a => a.name).join(", ");
    moves.push({
      id: "bring-current",
      action: "call",
      title: pastDueTotal > 0
        ? `Bring ${named || "every late account"} current — ${money(pastDueTotal)}`
        : `Bring every late account current`,
      ...(pastDueTotal > 0 ? { amount: pastDueTotal } : {}),
      ...(named ? { account: named } : {}),
      ...(pastDue[0] ? { ref: pastDue[0] } : {}),
      math: pastDue.length
        ? [
            ...pastDue.map(a => `${a.name}: ${a.pastDue ? `${money(a.pastDue)} past due` : "marked late"}`),
            pastDueTotal > 0 ? `Total to bring current: ${money(pastDueTotal)}` : "",
            `All from ${from}.`,
          ].filter(Boolean)
        : [`Your report shows ${snapshot?.delinquent ?? 0} delinquent account(s) but didn't name them. From ${from}.`],
      hurting: `${pastDue.length || snapshot?.delinquent} account${(pastDue.length || snapshot?.delinquent) === 1 ? " is" : "s are"} marked late. An account that is *currently* late keeps hurting every month it stays that way — this stops the bleeding before anything else helps.`,
      steps: [
        "Pay the past-due amount first, before any extra toward balances.",
        "Then send a goodwill letter on any account you've since kept clean — a single late on an otherwise good history is often removed just for asking.",
        "Put the minimum on autopay so it can't happen again.",
      ],
      check: "Next report should show the account as current. The late marker stays but stops compounding, and most of its damage fades by 24 months.",
      impact: "large",
      estPoints: [10, 40],
      when: "Today if you can",
    });
  }

  // ── Protect ───────────────────────────────────────────────────────────────
  moves.push({
    id: "autopay",
    action: "autopay",
    title: "Put every minimum payment on autopay",
    math: ["Nothing to calculate — this one is insurance, not arithmetic."],
    hurting: "Nothing yet — this is the one that stops you undoing the rest. One 30-day late during your program can cost more than everything above gains.",
    steps: [
      "Every account, minimum payment only, from the account your paycheck lands in.",
      "Keep paying extra by hand on top — autopay is the floor, not the plan.",
    ],
    check: "Check each lender's app shows autopay as active. Twenty minutes, once.",
    impact: "medium",
    estPoints: [0, 0],
    when: "Twenty minutes, once",
  });

  // ── Check ─────────────────────────────────────────────────────────────────
  moves.push({
    id: "recheck",
    action: "check",
    title: `Re-pull all three reports around ${inDays(45)}`,
    math: [`45 days from today, which is the outside edge of the dispute window.`],
    hurting: "Not knowing whether any of this worked. Without a before and after you're guessing.",
    steps: [
      "annualcreditreport.com is free and gives you all three.",
      "Upload them here — they merge into one snapshot and the numbers get compared to this pull.",
    ],
    check: "The score card will show the change since this report.",
    impact: "small",
    estPoints: [0, 0],
    when: inDays(45),
  });

  // Order by what each move is actually worth, not by which section built it.
  // Before this, "$68 to bring an account current" — worth 10–40 points — sat
  // below a $3,660 paydown worth 13–30, because payments were emitted first.
  // Among moves worth the same, the cheaper one goes first: she is choosing
  // what to do with limited money, not reading a ranking.
  const TAIL = new Set(["autopay", "recheck"]);
  const worth = (m: Move) => m.estPoints[0] + m.estPoints[1];
  moves.sort((a, b) => {
    const tail = Number(TAIL.has(a.id)) - Number(TAIL.has(b.id));
    if (tail !== 0) return tail;
    const byWorth = worth(b) - worth(a);
    if (byWorth !== 0) return byWorth;
    return (a.amount ?? 0) - (b.amount ?? 0);
  });

  const lo = moves.reduce((s, m) => s + m.estPoints[0], 0);
  const hi = moves.reduce((s, m) => s + m.estPoints[1], 0);

  return {
    moves,
    utilisation: {
      current: overallUtil,
      after: overallUtil !== null ? Math.min(overallUtil, 9) : null,
      totalToPay,
    },
    projection: {
      current,
      low: current !== null ? Math.min(850, current + lo) : null,
      high: current !== null ? Math.min(850, current + hi) : null,
      target: APPROVAL_TARGET,
      floor: APPROVAL_FLOOR,
      note: "An estimate, not a promise. FICO doesn't publish point values for actions, so the range is wide on purpose — the payment amounts above are exact, the points are a forecast.",
    },
    summaryOnly: accounts.length === 0,
  };
}
