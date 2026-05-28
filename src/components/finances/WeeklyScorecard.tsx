"use client";

import { useMemo } from "react";
import { startOfWeek, endOfWeek, subWeeks, parseISO, format, isWithinInterval, differenceInDays } from "date-fns";
import { BudgetCategory, MerchantCategoryOverride } from "@/types/dashboard";

export interface PlaidTxnLite {
  id:                 string;
  name:               string;
  amount:             number;
  date:               string;
  category:           string;
  isInternalTransfer: boolean;
}

interface Props {
  transactions:              PlaidTxnLite[];
  budgetCategories:          BudgetCategory[];
  merchantCategoryOverrides: MerchantCategoryOverride[];
}

const INCOME_CATS = new Set(["INCOME", "TRANSFER_IN"]);

const CAT_LABEL: Record<string, string> = {
  FOOD_AND_DRINK:            "Eating Out",
  GROCERIES:                 "Groceries",
  TRANSPORTATION:            "Transport",
  SHOPPING:                  "Shopping",
  ENTERTAINMENT:             "Entertainment",
  MEDICAL:                   "Healthcare",
  GENERAL_SERVICES:          "Services",
  HOME_IMPROVEMENT:          "Home",
  RENT_AND_UTILITIES:        "Housing",
  PERSONAL_CARE:             "Personal Care",
  GENERAL_MERCHANDISE:       "Merchandise",
  TRAVEL:                    "Travel",
  LOAN_PAYMENTS:             "Loan Payments",
  BANK_FEES:                 "Bank Fees",
  GOVERNMENT_AND_NON_PROFIT: "Gov & Non-Profit",
};

function catLabel(raw: string) {
  return CAT_LABEL[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt$(n: number) {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function resolvedCat(name: string, category: string, overrides: MerchantCategoryOverride[]): string {
  for (const o of overrides) {
    if (name.toLowerCase().includes(o.nameContains.toLowerCase())) return o.category;
  }
  return category;
}

function weekSpend(txns: PlaidTxnLite[], start: Date, end: Date, overrides: MerchantCategoryOverride[]) {
  const inWindow = txns.filter(
    (t) => !t.isInternalTransfer && isWithinInterval(parseISO(t.date), { start, end }),
  );
  const bycat = new Map<string, number>();
  for (const t of inWindow) {
    const cat = resolvedCat(t.name, t.category, overrides);
    if (INCOME_CATS.has(cat)) continue;
    bycat.set(cat, (bycat.get(cat) ?? 0) + t.amount);
  }
  return bycat;
}

export function WeeklyScorecard({ transactions, budgetCategories, merchantCategoryOverrides }: Props) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd   = endOfWeek(today,   { weekStartsOn: 1 });
  const lastStart = subWeeks(weekStart, 1);
  const lastEnd   = subWeeks(weekEnd,   1);

  const daysIntoWeek = Math.min(differenceInDays(today, weekStart) + 1, 7);
  const weekFraction = daysIntoWeek / 7;

  const thisWeek = useMemo(
    () => weekSpend(transactions, weekStart, today, merchantCategoryOverrides),
    [transactions, weekStart, today, merchantCategoryOverrides],
  );
  const lastWeek = useMemo(
    () => weekSpend(transactions, lastStart, lastEnd, merchantCategoryOverrides),
    [transactions, lastStart, lastEnd, merchantCategoryOverrides],
  );

  const budgetMap = new Map(budgetCategories.map((b) => [b.category, b.monthlyLimit]));

  const thisTotal = Math.max(0, Array.from(thisWeek.values()).reduce((s, v) => s + v, 0));
  const lastTotal = Math.max(0, Array.from(lastWeek.values()).reduce((s, v) => s + v, 0));
  const totalMonthlyBudget = Array.from(budgetMap.values()).reduce((s, v) => s + v, 0);
  const weeklyBudget = totalMonthlyBudget / 4.3;
  const paceTarget  = weeklyBudget * weekFraction; // what you'd expect to have spent by today

  if (thisTotal === 0 && lastTotal === 0) return null;

  const vsLast    = lastTotal > 0 ? thisTotal - lastTotal : null;
  const vsPace    = paceTarget > 0 ? thisTotal - paceTarget : null;
  const aheadOfPace = vsPace !== null && vsPace < 0;

  // Category rows — all cats that have any activity this or last week
  const allCats = Array.from(
    new Set([...Array.from(thisWeek.keys()), ...Array.from(lastWeek.keys())]),
  ).filter((c) => !INCOME_CATS.has(c));

  const rows = allCats
    .map((cat) => {
      const actual     = thisWeek.get(cat) ?? 0;
      const prev       = lastWeek.get(cat) ?? 0;
      const monthLimit = budgetMap.get(cat) ?? 0;
      const weekLimit  = monthLimit > 0 ? monthLimit / 4.3 : 0;
      const prorated   = weekLimit * weekFraction;
      const isOver     = prorated > 0 && actual > prorated;
      return { cat, actual, prev, weekLimit, prorated, isOver };
    })
    .filter((r) => r.actual !== 0 || r.prev !== 0)
    .sort((a, b) => b.actual - a.actual);

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-serif text-xl text-brown">This Week</h3>
          <p className="text-xs text-sand-dark mt-0.5">
            {format(weekStart, "MMM d")} – {format(today, "MMM d")} · day {daysIntoWeek} of 7
          </p>
        </div>
        {vsLast !== null && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${vsLast < 0 ? "bg-sage/15 text-sage" : "bg-rose/10 text-rose"}`}>
            {vsLast < 0 ? `${fmt$(Math.abs(vsLast))} less` : `${fmt$(vsLast)} more`} than last week
          </span>
        )}
      </div>

      {/* Totals */}
      <div className="flex items-end gap-5 mb-4">
        <div>
          <p className="font-serif text-3xl text-brown leading-none">{fmt$(thisTotal)}</p>
          <p className="text-xs text-sand-dark mt-1">spent</p>
        </div>
        {vsPace !== null && (
          <div>
            <p className={`font-serif text-xl leading-none ${aheadOfPace ? "text-sage" : "text-rose"}`}>
              {aheadOfPace ? `${fmt$(Math.abs(vsPace))} under` : `${fmt$(vsPace)} over`}
            </p>
            <p className="text-xs text-sand-dark mt-1">pace for {daysIntoWeek}d</p>
          </div>
        )}
        {lastTotal > 0 && (
          <div className="ml-auto text-right">
            <p className="font-serif text-base text-sand-dark leading-none">{fmt$(lastTotal)}</p>
            <p className="text-xs text-sand-dark mt-1">last week</p>
          </div>
        )}
      </div>

      {/* Pace bar */}
      {weeklyBudget > 0 && (
        <div className="mb-5">
          <div className="h-1 bg-cream-darker rounded-full overflow-hidden relative">
            {/* Pace marker */}
            <div className="absolute top-0 h-full w-0.5 bg-sand/50 z-10"
              style={{ left: `${Math.min(100, weekFraction * 100)}%` }} />
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (thisTotal / weeklyBudget) * 100)}%`,
                background: thisTotal > weeklyBudget ? "#DA667B" : aheadOfPace ? "#71816D" : "#C99A5C",
              }} />
          </div>
          <div className="flex justify-between text-[10px] text-sand-dark mt-0.5 px-0.5">
            <span>0</span>
            <span className="relative" style={{ left: `${Math.min(90, weekFraction * 100 - 5)}%` }}>
              pace
            </span>
            <span>{fmt$(weeklyBudget)}</span>
          </div>
        </div>
      )}

      {/* Category rows */}
      <div className="space-y-2">
        {rows.map((r) => {
          const barMax   = Math.max(thisTotal, lastTotal, r.prorated, 1);
          const thisPct  = Math.min(100, (Math.max(0, r.actual) / barMax) * 100);
          const prevPct  = Math.min(100, (Math.max(0, r.prev)   / barMax) * 100);
          const dotColor = r.isOver ? "#DA667B" : "#71816D";

          return (
            <div key={r.cat}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                <span className="text-xs text-brown flex-1">{catLabel(r.cat)}</span>
                {r.actual < 0 ? (
                  <span className="text-[11px] text-sage">+{fmt$(Math.abs(r.actual))} back</span>
                ) : (
                  <>
                    <span className={`text-xs font-medium ${r.isOver ? "text-rose" : "text-brown"}`}>{fmt$(r.actual)}</span>
                    {r.prev > 0 && (
                      <span className="text-[10px] text-sand-dark">vs {fmt$(r.prev)}</span>
                    )}
                  </>
                )}
              </div>
              {r.actual > 0 && (
                <div className="relative h-1 bg-cream-darker rounded-full overflow-hidden ml-3.5">
                  {/* Last week ghost bar */}
                  {r.prev > 0 && (
                    <div className="absolute top-0 h-full rounded-full opacity-30"
                      style={{ width: `${prevPct}%`, background: "rgba(255,255,255,0.3)" }} />
                  )}
                  {/* This week bar */}
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${thisPct}%`, background: dotColor }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
