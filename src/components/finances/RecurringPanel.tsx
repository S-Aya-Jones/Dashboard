"use client";

import { useMemo, useState } from "react";
import { differenceInDays, parseISO, addDays, format } from "date-fns";
import { Eye, EyeOff, Flag } from "lucide-react";

export interface PlaidTxnLite {
  id:                  string;
  name:                string;
  amount:              number;
  date:                string;
  category:            string;
  isInternalTransfer?: boolean;
}

export interface DetectedRecurring {
  key:           string;
  merchant:      string;
  type:          "income" | "expense";
  cadence:       "weekly" | "biweekly" | "monthly" | "annual" | "irregular";
  avgAmount:     number;
  nextEstimated: string | null;
  occurrences:   number;
}

interface Props {
  transactions:  PlaidTxnLite[];
  hiddenIds:     string[];
  flaggedIds:    string[];
  onToggleHide:  (key: string) => void;
  onToggleFlag:  (key: string) => void;
}

function normalizeKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 22);
}

function fmt$(n: number) {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function detectRecurring(txns: PlaidTxnLite[]): DetectedRecurring[] {
  const eligible = txns.filter((t) => !t.isInternalTransfer);
  const byKey    = new Map<string, PlaidTxnLite[]>();

  for (const t of eligible) {
    const key = normalizeKey(t.name);
    const g   = byKey.get(key) ?? [];
    g.push(t);
    byKey.set(key, g);
  }

  const results: DetectedRecurring[] = [];

  for (const [key, group] of Array.from(byKey.entries())) {
    if (group.length < 2) continue;

    const sorted  = [...group].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avg     = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (avg < 1) continue;

    const maxAmtDev = Math.max(...amounts.map((a) => Math.abs(a - avg) / avg));
    if (maxAmtDev > 0.25) continue;

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date)));
    }
    const avgInterval    = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const maxIntervalDev = Math.max(...intervals.map((i) => Math.abs(i - avgInterval) / (avgInterval || 1)));
    if (maxIntervalDev > 0.55 && group.length < 3) continue;

    let cadence: DetectedRecurring["cadence"];
    if (avgInterval < 9)        cadence = "weekly";
    else if (avgInterval < 20)  cadence = "biweekly";
    else if (avgInterval < 50)  cadence = "monthly";
    else if (avgInterval < 200) cadence = "annual";
    else                        cadence = "irregular";

    const lastDate     = parseISO(sorted[sorted.length - 1].date);
    const nextEstimated = avgInterval > 0
      ? format(addDays(lastDate, Math.round(avgInterval)), "yyyy-MM-dd")
      : null;

    results.push({
      key,
      merchant:      sorted[sorted.length - 1].name,
      type:          sorted[0].amount < 0 ? "income" : "expense",
      cadence,
      avgAmount:     avg,
      nextEstimated,
      occurrences:   sorted.length,
    });
  }

  return results.sort((a, b) => {
    if (!a.nextEstimated) return 1;
    if (!b.nextEstimated) return -1;
    return parseISO(a.nextEstimated).getTime() - parseISO(b.nextEstimated).getTime();
  });
}

const CADENCE: Record<string, string> = {
  weekly: "weekly", biweekly: "every 2 wks", monthly: "monthly",
  annual: "yearly", irregular: "occasional",
};

function DaysChip({ date }: { date: string | null }) {
  if (!date) return null;
  const d = differenceInDays(parseISO(date), new Date());
  const label = d <= 0 ? "due" : d === 1 ? "tomorrow" : `${d}d`;
  return (
    <span className={`text-xs flex-shrink-0 ${d <= 3 && d >= 0 ? "text-terracotta font-medium" : "text-sand-dark"}`}>
      {label}
    </span>
  );
}

function ActionButtons({ r, hiddenIds, flaggedIds, onToggleHide, onToggleFlag }: {
  r: DetectedRecurring;
  hiddenIds: string[];
  flaggedIds: string[];
  onToggleHide: (k: string) => void;
  onToggleFlag: (k: string) => void;
}) {
  const isHidden  = hiddenIds.includes(r.key);
  const isFlagged = flaggedIds.includes(r.key);
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={() => onToggleFlag(r.key)}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isFlagged ? "bg-terracotta/20 text-terracotta" : "hover:bg-cream-darker text-sand"}`}
        title="Flag for review">
        <Flag size={9} />
      </button>
      <button onClick={() => onToggleHide(r.key)}
        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-cream-darker text-sand transition-colors"
        title={isHidden ? "Show" : "Hide"}>
        {isHidden ? <Eye size={9} /> : <EyeOff size={9} />}
      </button>
    </div>
  );
}

export function RecurringPanel({ transactions, hiddenIds, flaggedIds, onToggleHide, onToggleFlag }: Props) {
  const [showHidden, setShowHidden] = useState(false);

  const all      = useMemo(() => detectRecurring(transactions), [transactions]);
  const income   = all.filter((r) => r.type === "income"  && (showHidden || !hiddenIds.includes(r.key)));
  const expenses = all.filter((r) => r.type === "expense" && (showHidden || !hiddenIds.includes(r.key)));

  const monthlyExpenses = expenses
    .filter((e) => !hiddenIds.includes(e.key))
    .reduce((s, e) => {
      const mult = e.cadence === "weekly" ? 4.3 : e.cadence === "biweekly" ? 2.15 : e.cadence === "monthly" ? 1 : e.cadence === "annual" ? 1 / 12 : 1;
      return s + e.avgAmount * mult;
    }, 0);

  const deadWeight  = expenses.filter((e) => e.avgAmount < 30 && e.occurrences >= 2 && !hiddenIds.includes(e.key));
  const hiddenCount = all.filter((r) => hiddenIds.includes(r.key)).length;

  if (all.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-serif text-xl text-brown">Recurring</h3>
          {monthlyExpenses > 0 && (
            <p className="text-xs text-sand-dark mt-0.5">{fmt$(monthlyExpenses)}/month in bills & subs</p>
          )}
        </div>
        {hiddenCount > 0 && (
          <button onClick={() => setShowHidden((s) => !s)} className="text-[11px] text-sand-dark hover:text-brown">
            {showHidden ? "hide hidden" : `${hiddenCount} hidden`}
          </button>
        )}
      </div>

      {income.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-2">Income</p>
          <div className="space-y-2">
            {income.map((r) => (
              <div key={r.key} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brown truncate">{r.merchant}</p>
                  <p className="text-xs text-sand-dark">{CADENCE[r.cadence]} · ~{fmt$(r.avgAmount)}</p>
                </div>
                <DaysChip date={r.nextEstimated} />
                <ActionButtons r={r} hiddenIds={hiddenIds} flaggedIds={flaggedIds} onToggleHide={onToggleHide} onToggleFlag={onToggleFlag} />
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length > 0 && (
        <div>
          <p className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-2">Bills & Subscriptions</p>
          <div className="space-y-2">
            {expenses.map((r) => {
              const isFlagged = flaggedIds.includes(r.key);
              return (
                <div key={r.key} className={`flex items-center gap-3 ${isFlagged ? "opacity-55" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm truncate ${isFlagged ? "line-through text-sand-dark" : "text-brown"}`}>
                        {r.merchant}
                      </p>
                      {isFlagged && (
                        <span className="text-[9px] text-terracotta font-medium px-1 py-0.5 bg-terracotta/10 rounded flex-shrink-0">
                          review
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-sand-dark">{CADENCE[r.cadence]} · ~{fmt$(r.avgAmount)}</p>
                  </div>
                  <DaysChip date={r.nextEstimated} />
                  <ActionButtons r={r} hiddenIds={hiddenIds} flaggedIds={flaggedIds} onToggleHide={onToggleHide} onToggleFlag={onToggleFlag} />
                </div>
              );
            })}
          </div>

          {deadWeight.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sand/20">
              <p className="text-xs text-sand-dark mb-2">Possibly unused · under $30/mo</p>
              <div className="space-y-1">
                {deadWeight.map((e) => (
                  <div key={`dw-${e.key}`} className="flex items-center justify-between">
                    <p className="text-xs text-sand-dark truncate flex-1">{e.merchant}</p>
                    <p className="text-xs text-sand-dark ml-2">{fmt$(e.avgAmount)}/mo</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
