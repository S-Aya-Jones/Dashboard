// The paycheck plan, September 2026.
//
// Written down as data rather than prose because the whole thing only works if
// the same numbers appear every payday. It is a two-card system: bills come off
// the Bank of America card automatically, spending comes off the Capital One
// card and stops when it stops.
//
// Every figure here is per check. Monthly is shown alongside only because bills
// arrive monthly — the decisions are all made per check, which is the point.

export interface Line {
  id: string;
  label: string;
  /** Per check. Monthly is simply twice this. */
  perCheck: number;
  note?: string;
  /** Savings and debt payoff aren't costs; they're the reason for the plan. */
  kind: "bill" | "save" | "debt" | "spend";
}

export interface Card {
  id: "bills" | "spending";
  name: string;
  sub: string;
  rule: string;
  lines: Line[];
}

export const CARDS: Card[] = [
  {
    id: "bills",
    name: "Bank of America",
    sub: "Bills, per check",
    rule: "Autopay handles all of it. The app is off your phone so you don't watch it.",
    lines: [
      { id: "car",      label: "Car note",          perCheck: 255, kind: "bill" },
      { id: "carins",   label: "Car insurance",     perCheck: 47,  kind: "bill" },
      { id: "electric", label: "Electric",          perCheck: 61,  kind: "bill" },
      { id: "therapy",  label: "Therapy",           perCheck: 65,  kind: "bill" },
      { id: "subs",     label: "Subscriptions",     perCheck: 30,  kind: "bill", note: "Claude, Spotify/Hulu, Google, Ladder" },
      { id: "debt",     label: "Extra debt payoff", perCheck: 120, kind: "debt" },
      { id: "deandra",  label: "Deandra",           perCheck: 125, kind: "bill" },
      { id: "savings",  label: "Savings transfer",  perCheck: 792, kind: "save", note: "The day the check lands, before anything else" },
    ],
  },
  {
    id: "spending",
    name: "Capital One",
    sub: "Spending, per check",
    rule: "When it's gone, it's gone until the next check.",
    lines: [
      { id: "food", label: "Groceries and eating out", perCheck: 325, kind: "spend" },
      { id: "gas",  label: "Gas",                      perCheck: 50,  kind: "spend" },
      { id: "fun",  label: "Fun and wants",            perCheck: 200, kind: "spend" },
      { id: "buff", label: "Buffer",                   perCheck: 42,  kind: "spend" },
    ],
  },
];

export const RULES = [
  "The savings transfer happens the day the check lands, before anything else moves.",
  "The spending card is for food, gas and fun. No Cash App, no Zelle to yourself, no joint account.",
  "Anything over $100 waits 48 hours.",
  "The Bank of America app stays off your phone. Bills autopay from it.",
];

/** The short October 2 check — one-off, and it breaks every normal rule. */
export const SHORT_CHECK = {
  date: "2026-10-02",
  amount: 1050,
  why: "A short check. Savings sits this one out — that's planned, not a slip.",
  lines: [
    { label: "Electric catch-up",        amount: 341 },
    { label: "Half bills, minus the car", amount: 203 },
    { label: "Spending until the 16th",  amount: 506 },
    { label: "Savings",                  amount: 0, note: "Zero this check. It resumes October 16." },
  ],
};

/** Savings: seven full checks, October 16 to January 8. */
export const SAVINGS = {
  perCheck: 792,
  checks: 7,
  from: "2026-10-16",
  to: "2027-01-08",
  goal: 5000,
  /** Paydays, every other Friday from October 16. */
  paydays: [
    "2026-10-16", "2026-10-30", "2026-11-13", "2026-11-27",
    "2026-12-11", "2026-12-25", "2027-01-08",
  ],
  note: "Third-check months are pure bonus on top. October has one.",
};

/** What February does to all of it. */
export const FEBRUARY = {
  from: "2027-02-01",
  rentMonthly: 1200,
  rentPerCheck: 600,
  savingsPerCheckAfter: 192,
  why: "Rent comes out of the $792, so savings drops to about $192 a check. The $5,000 is the cushion for exactly this.",
};

export function cardTotal(card: Card): number {
  return card.lines.reduce((n, l) => n + l.perCheck, 0);
}

export const BILLS_TOTAL = cardTotal(CARDS[0]);
export const SPEND_TOTAL = cardTotal(CARDS[1]);
export const CHECK_TOTAL = BILLS_TOTAL + SPEND_TOTAL;

export const SAVINGS_TOTAL = SAVINGS.perCheck * SAVINGS.checks;
export const SAVINGS_SPARE = SAVINGS_TOTAL - SAVINGS.goal;

/** Paydays already banked as of a given date. */
export function savedBy(dateStr: string): { checks: number; saved: number; left: number } {
  const checks = SAVINGS.paydays.filter(d => d <= dateStr).length;
  const saved = checks * SAVINGS.perCheck;
  return { checks, saved, left: Math.max(0, SAVINGS.goal - saved) };
}

export function nextPayday(dateStr: string): string | null {
  if (dateStr < SHORT_CHECK.date) return SHORT_CHECK.date;
  return SAVINGS.paydays.find(d => d >= dateStr) ?? null;
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
