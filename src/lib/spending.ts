// Where the money actually went.
//
// The Flow tab answers "what's left this paycheck". This answers the different
// question — what is she spending on, is it growing, and which of it is a
// standing commitment versus a choice she makes each week. All arithmetic, no
// model: these are her own transactions added up.
//
// Two things are excluded from every total, and both matter:
//   · internal transfers — moving $200 to savings is not $200 of spending, and
//     counting it makes her look like she overspends every payday
//   · refunds and income (negative amounts) net against the category rather
//     than being dropped, so a returned $80 coat doesn't leave $80 of phantom
//     clothing spend on the record

export interface Txn {
  id: string;
  name: string;
  amount: number;          // positive = money out, Plaid's convention
  date: string;            // YYYY-MM-DD
  category: string;
  isInternalTransfer?: boolean;
}

export interface CategorySlice {
  category: string;
  label: string;
  total: number;
  count: number;
  share: number;           // 0–1 of the period's spend
  /** Same category, previous period of equal length. */
  prior: number;
  changePct: number | null;
}

export interface MerchantRow {
  name: string;
  total: number;
  count: number;
  category: string;
}

export interface MonthPoint {
  month: string;           // YYYY-MM
  label: string;           // "Aug"
  total: number;
}

export interface SpendingReport {
  from: string;
  to: string;
  total: number;
  dailyAverage: number;
  categories: CategorySlice[];
  merchants: MerchantRow[];
  months: MonthPoint[];
  /** Charges that recur on a similar amount — the standing commitments. */
  recurring: MerchantRow[];
  recurringTotal: number;
  oneOffTotal: number;
  /** Biggest movers versus the previous period of equal length. */
  growing: CategorySlice[];
  shrinking: CategorySlice[];
  txnCount: number;
}

/** Plaid's SCREAMING_SNAKE categories, said the way a person would. */
const LABELS: Record<string, string> = {
  FOOD_AND_DRINK: "Food & drink",
  GENERAL_MERCHANDISE: "Shopping",
  TRANSPORTATION: "Transport",
  TRAVEL: "Travel",
  RENT_AND_UTILITIES: "Rent & utilities",
  LOAN_PAYMENTS: "Loan payments",
  MEDICAL: "Medical",
  PERSONAL_CARE: "Personal care",
  GENERAL_SERVICES: "Services",
  ENTERTAINMENT: "Entertainment",
  HOME_IMPROVEMENT: "Home",
  GOVERNMENT_AND_NON_PROFIT: "Government & giving",
  BANK_FEES: "Bank fees",
  INCOME: "Income",
  OTHER: "Other",
};

export function categoryLabel(c: string): string {
  return LABELS[c] ?? c.replace(/_/g, " ").toLowerCase().replace(/^./, m => m.toUpperCase());
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Spending only: transfers out, income out, refunds netted in. */
function spendable(txns: Txn[]): Txn[] {
  return txns.filter(t => !t.isInternalTransfer && t.category !== "INCOME");
}

/**
 * Merchant names arrive with store numbers, cities and card suffixes attached,
 * so "STARBUCKS #4471 NASHVILLE" and "STARBUCKS #219" would otherwise count as
 * two different places she goes.
 */
export function normaliseMerchant(name: string): string {
  return name
    .replace(/\b(x{2,}\d+|\*+\d+|#\d+)\b/gi, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\b(purchase|pos|debit|card|payment|recurring)\b/gi, " ")
    .replace(/[^A-Za-z0-9&' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32)
    // Bank feeds shout. Lower-case first, then title-case, or "KROGER
    // NASHVILLE" stays shouting because the first letters are already capitals.
    .toLowerCase()
    .replace(/\b\w/g, m => m.toUpperCase()) || "Unknown";
}

/**
 * A charge that shows up on a regular cadence for a similar amount.
 *
 * Three or more hits, and the amounts clustered within 15% of the median — a
 * grocery run happens weekly too, but for a different amount every time, and
 * calling that a subscription would make the "standing commitments" figure
 * meaningless.
 */
function isRecurring(amounts: number[]): boolean {
  if (amounts.length < 3) return false;
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= 0) return false;
  const close = amounts.filter(a => Math.abs(a - median) / median <= 0.15).length;
  return close / amounts.length >= 0.7;
}

export function buildReport(all: Txn[], days = 30, now: Date = new Date()): SpendingReport {
  const start = new Date(now); start.setDate(start.getDate() - days + 1);
  const priorStart = new Date(start); priorStart.setDate(priorStart.getDate() - days);

  const from = ymd(start);
  const to = ymd(now);
  const priorFrom = ymd(priorStart);

  const spend = spendable(all);
  const inPeriod = spend.filter(t => t.date >= from && t.date <= to);
  const inPrior  = spend.filter(t => t.date >= priorFrom && t.date < from);

  const sum = (rows: Txn[]) => rows.reduce((s, t) => s + t.amount, 0);
  const total = Math.max(0, sum(inPeriod));

  // ── By category, against the same window before it ──
  const byCat = new Map<string, Txn[]>();
  for (const t of inPeriod) {
    const key = t.category || "OTHER";
    byCat.set(key, [...(byCat.get(key) ?? []), t]);
  }
  const priorByCat = new Map<string, number>();
  for (const t of inPrior) {
    const key = t.category || "OTHER";
    priorByCat.set(key, (priorByCat.get(key) ?? 0) + t.amount);
  }

  const categories: CategorySlice[] = Array.from(byCat.entries())
    .map(([category, rows]) => {
      const catTotal = sum(rows);
      const prior = priorByCat.get(category) ?? 0;
      return {
        category,
        label: categoryLabel(category),
        total: catTotal,
        count: rows.length,
        share: total > 0 ? catTotal / total : 0,
        prior,
        // No prior spend means "new", not "up infinity percent".
        changePct: prior > 0 ? ((catTotal - prior) / prior) * 100 : null,
      };
    })
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // ── Merchants ──
  const byMerchant = new Map<string, { total: number; count: number; category: string; amounts: number[] }>();
  for (const t of inPeriod) {
    if (t.amount <= 0) continue;
    const key = normaliseMerchant(t.name);
    const row = byMerchant.get(key) ?? { total: 0, count: 0, category: t.category, amounts: [] };
    row.total += t.amount;
    row.count += 1;
    row.amounts.push(t.amount);
    byMerchant.set(key, row);
  }
  const merchants: MerchantRow[] = Array.from(byMerchant.entries())
    .map(([name, r]) => ({ name, total: r.total, count: r.count, category: r.category }))
    .sort((a, b) => b.total - a.total);

  // Recurring is judged over the whole history, not just this window — three
  // monthly charges never fit inside 30 days.
  const historyByMerchant = new Map<string, number[]>();
  for (const t of spend) {
    if (t.amount <= 0) continue;
    const key = normaliseMerchant(t.name);
    historyByMerchant.set(key, [...(historyByMerchant.get(key) ?? []), t.amount]);
  }
  const recurringNames = new Set(
    Array.from(historyByMerchant.entries()).filter(([, a]) => isRecurring(a)).map(([n]) => n),
  );
  const recurring = merchants.filter(m => recurringNames.has(m.name));
  const recurringTotal = recurring.reduce((s, m) => s + m.total, 0);

  // ── Month by month, last six ──
  const byMonth = new Map<string, number>();
  for (const t of spend) {
    if (t.amount <= 0) continue;
    const m = t.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + t.amount);
  }
  const months: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      total: byMonth.get(key) ?? 0,
    };
  });

  const movers = categories.filter(c => c.changePct !== null && Math.abs(c.total - c.prior) >= 20);

  return {
    from, to, total,
    dailyAverage: total / days,
    categories,
    merchants,
    months,
    recurring,
    recurringTotal,
    oneOffTotal: Math.max(0, total - recurringTotal),
    growing: movers.filter(c => c.changePct! > 10).sort((a, b) => (b.total - b.prior) - (a.total - a.prior)).slice(0, 4),
    shrinking: movers.filter(c => c.changePct! < -10).sort((a, b) => (a.total - a.prior) - (b.total - b.prior)).slice(0, 3),
    txnCount: inPeriod.length,
  };
}

/**
 * The donut's slices: the four biggest by identity, everything else folded into
 * a labelled Other. Beyond four, a categorical palette stops being reliably
 * distinguishable — and a ring of twelve slivers answers no question anyway.
 */
export function donutSlices(categories: CategorySlice[], keep = 4): CategorySlice[] {
  if (categories.length <= keep + 1) return categories;
  const head = categories.slice(0, keep);
  const rest = categories.slice(keep);
  const total = rest.reduce((s, c) => s + c.total, 0);
  return [
    ...head,
    {
      category: "OTHER_ROLLUP",
      label: `Other (${rest.length})`,
      total,
      count: rest.reduce((s, c) => s + c.count, 0),
      share: rest.reduce((s, c) => s + c.share, 0),
      prior: rest.reduce((s, c) => s + c.prior, 0),
      changePct: null,
    },
  ];
}
