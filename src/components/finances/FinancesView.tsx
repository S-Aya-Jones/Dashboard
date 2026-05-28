"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { DashboardData, MerchantCategoryOverride } from "@/types/dashboard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";
import {
  format, parseISO, startOfMonth, isAfter, differenceInDays,
  startOfWeek, addDays,
} from "date-fns";
import { detectRecurring } from "./RecurringPanel";
import { SavingsQuests } from "./SavingsQuests";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

interface PlaidAccount {
  accountId:        string;
  name:             string;
  officialName?:    string | null;
  mask?:            string | null;
  type:             string;
  subtype?:         string | null;
  balances:         { current?: number | null; available?: number | null; limit?: number | null };
  institutionName?: string | null;
  itemId?:          string;
  loginRequired?:   boolean;
}

interface PlaidTxn {
  id:                 string;
  name:               string;
  amount:             number;
  date:               string;
  category:           string;
  accountId:          string;
  institutionName?:   string | null;
  isInternalTransfer: boolean;
  transferPairId:     string | null;
  itemId:             string;
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  FOOD_AND_DRINK:              "Eating Out",
  GROCERIES:                   "Groceries",
  TRANSPORTATION:              "Transport",
  SHOPPING:                    "Shopping",
  ENTERTAINMENT:               "Entertainment",
  MEDICAL:                     "Healthcare",
  GENERAL_SERVICES:            "Services",
  HOME_IMPROVEMENT:            "Home",
  RENT_AND_UTILITIES:          "Housing",
  PERSONAL_CARE:               "Personal Care",
  GENERAL_MERCHANDISE:         "Merchandise",
  TRAVEL:                      "Travel",
  LOAN_PAYMENTS:               "Loan Payments",
  BANK_FEES:                   "Bank Fees",
  INCOME:                      "Income",
  TRANSFER_IN:                 "Transfer In",
  TRANSFER_OUT:                "Bank Transfers",
  GOVERNMENT_AND_NON_PROFIT:   "Gov & Non-Profit",
  EDUCATION:                   "Education",
  HOME_SERVICES:               "Home Services",
  INSURANCE:                   "Insurance",
  RECREATION:                  "Recreation",
  PERSONAL_AND_FAMILY_CARE:    "Family Care",
  FOOD_AND_DRINK_GROCERIES:    "Groceries",
};

const BUDGET_CATS = [
  "GROCERIES", "FOOD_AND_DRINK", "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT",
  "MEDICAL", "GENERAL_SERVICES", "HOME_IMPROVEMENT", "RENT_AND_UTILITIES",
  "PERSONAL_CARE", "GENERAL_MERCHANDISE", "TRAVEL", "LOAN_PAYMENTS",
];

function catLabel(raw: string) {
  return CAT_LABEL[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const INCOME_CATS = new Set(["INCOME", "TRANSFER_IN"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtN(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function fmtBal(n: number | null | undefined): { text: string; negative: boolean } {
  if (n == null) return { text: "—", negative: false };
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: n < 0 ? `-$${abs}` : `$${abs}`, negative: n < 0 };
}

function cleanAcctName(raw: string, subtype?: string | null, type?: string): string {
  if (!/^(depository|loan|credit|investment)\s/i.test(raw)) return raw;
  const sub = (subtype ?? "").toLowerCase();
  if (sub === "checking")      return "Checking";
  if (sub === "savings")       return "Savings";
  if (sub === "cd")            return "CD";
  if (sub === "money market")  return "Money Market";
  if (sub === "credit card")   return "Credit Card";
  if (type === "loan")         return "Loan";
  if (type === "investment")   return "Brokerage";
  return "Account";
}

function effectiveBalance(acc: PlaidAccount): number {
  if (acc.type === "credit") {
    const limit = acc.balances.limit ?? 0;
    const avail = acc.balances.available;
    if (avail != null && limit > 0) return limit - avail;
    return acc.balances.current ?? 0;
  }
  if (acc.type === "loan") return acc.balances.current ?? 0;
  return acc.balances.available ?? acc.balances.current ?? 0;
}

function timeAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
}

// ── Plaid Connect ─────────────────────────────────────────────────────────────

function PlaidConnectButton({ onConnected, compact = false }: { onConnected: () => void; compact?: boolean }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching,  setFetching]  = useState(false);

  const { open, ready } = usePlaidLink({
    token:     linkToken,
    onSuccess: async (publicToken, metadata) => {
      await fetch("/api/plaid/exchange-token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, metadata }),
      });
      onConnected();
    },
  });

  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  const handleClick = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const res  = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const json = await res.json();
      if (json.link_token) setLinkToken(json.link_token);
    } finally { setFetching(false); }
  };

  if (compact) {
    return (
      <button onClick={handleClick} disabled={fetching}
        className="text-[10px] text-sand-dark hover:text-white transition-colors">
        {fetching ? "…" : "+ connect"}
      </button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={fetching}>
      {fetching ? "Preparing…" : "+ Connect a bank"}
    </Button>
  );
}

// ── Config defaults ───────────────────────────────────────────────────────────

const DEFAULT_FC = {
  bigTicketThreshold:        100,
  watchListMerchants:        ["sephora", "ulta", "amazon", "starbucks", "coffee", "doordash", "ubereats", "grubhub", "uber", "lyft"],
  bigMoves:                  [],
  recurringHidden:           [] as string[],
  recurringFlagged:          [] as string[],
  merchantCategoryOverrides: [] as MerchantCategoryOverride[],
};


// ── Main component ────────────────────────────────────────────────────────────

export function FinancesView({ data, update }: Props) {
  const [accounts,        setAccounts]        = useState<PlaidAccount[]>([]);
  const [transactions,    setTransactions]    = useState<PlaidTxn[]>([]);
  const [, setTransferCount]   = useState(0);
  const [refreshedAt,     setRefreshedAt]     = useState<string | null>(null);
  const [loadingAccts,    setLoadingAccts]    = useState(true);
  const [loadingTxns,     setLoadingTxns]     = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [cardOpen,    setCardOpen]    = useState(false);
  const [budgetOpen,  setBudgetOpen]  = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [cardForm,    setCardForm]    = useState({ name: "", balance: 0, limit: 0, targetPayoff: "" });
  const [budgetDraft, setBudgetDraft] = useState<Record<string, string>>({});

  const fetchAccounts = useCallback(async (bust = false) => {
    setLoadingAccts(true);
    try {
      const res = await fetch(bust ? "/api/plaid/accounts?refresh=1" : "/api/plaid/accounts");
      const j   = await res.json();
      if (!j.error) { setAccounts(j.accounts ?? []); setRefreshedAt(j.refreshedAt ?? null); }
    } finally { setLoadingAccts(false); }
  }, []);

  const fetchTransactions = useCallback(async (bust = false) => {
    setLoadingTxns(true);
    try {
      const res = await fetch(bust ? "/api/plaid/transactions?refresh=1" : "/api/plaid/transactions");
      const j   = await res.json();
      if (!j.error) {
        setTransactions(j.transactions ?? []);
        setTransferCount(j.transferCount ?? 0);
      }
    } finally { setLoadingTxns(false); }
  }, []);

  useEffect(() => { fetchAccounts(); fetchTransactions(); }, [fetchAccounts, fetchTransactions]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res  = await fetch("/api/plaid/refresh", { method: "POST" });
      const json = await res.json();
      const ts   = json.refreshedAt ? new Date(json.refreshedAt) : new Date();
      setLastRefreshedAt(ts);
      if (!json.skipped) await new Promise((r) => setTimeout(r, 3000));
      await Promise.all([fetchAccounts(!json.skipped), fetchTransactions(!json.skipped)]);
    } finally { setRefreshing(false); }
  };

  const handleConnected = () => { fetchAccounts(true); fetchTransactions(true); };

  const handleDisconnect = async (itemId: string | undefined) => {
    if (!itemId || !confirm("Remove this account connection?")) return;
    await fetch("/api/plaid/disconnect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    fetchAccounts(true);
  };

  // ── Config ─────────────────────────────────────────────────────────────────

  const fc = {
    ...DEFAULT_FC,
    ...(data.financesConfig ?? {}),
    merchantCategoryOverrides: data.financesConfig?.merchantCategoryOverrides ?? [],
  };

  const resolvedCat = (t: PlaidTxn) => {
    for (const o of fc.merchantCategoryOverrides) {
      if (t.name.toLowerCase().includes(o.nameContains.toLowerCase())) return o.category;
    }
    return t.category;
  };

  // ── Account totals ─────────────────────────────────────────────────────────

  const realAccounts = accounts.filter((a) => !a.loginRequired);
  const totalCash    = realAccounts.filter((a) => a.type === "depository")
    .reduce((s, a) => s + (a.balances.available ?? a.balances.current ?? 0), 0);
  const totalCredit  = realAccounts.filter((a) => a.type === "credit")
    .reduce((s, a) => s + effectiveBalance(a), 0);
  const netWorth     = totalCash - totalCredit;

  // ── Runway ─────────────────────────────────────────────────────────────────

  const last30Spend = transactions
    .filter((t) => {
      if (t.isInternalTransfer) return false;
      if (INCOME_CATS.has(t.category)) return false;
      if (t.amount <= 0) return false;
      return differenceInDays(new Date(), parseISO(t.date)) <= 30;
    })
    .reduce((s, t) => s + t.amount, 0);

  const avgDailySpend = last30Spend / 30;
  const runwayDays    = avgDailySpend > 0 && totalCash > 0 ? Math.round(totalCash / avgDailySpend) : null;
  const runwayColor   = runwayDays == null ? "#ffffff"
    : runwayDays > 90 ? "#9B7FFF"
    : runwayDays > 30 ? "#C99A5C"
    : "#DA667B";

  // ── This-month spending ────────────────────────────────────────────────────

  const monthStart = startOfMonth(new Date());

  const thisMo = transactions.filter(
    (t) => !t.isInternalTransfer && (isAfter(parseISO(t.date), monthStart) || parseISO(t.date) >= monthStart),
  );

  const catActual = new Map<string, number>();
  for (const t of thisMo) {
    const cat = resolvedCat(t);
    if (INCOME_CATS.has(cat)) continue;
    catActual.set(cat, (catActual.get(cat) ?? 0) + t.amount);
  }

  const totalSpent = Math.max(0, Array.from(catActual.values()).reduce((s, v) => s + v, 0));

  const budgetMap  = new Map(data.budgetCategories.map((b) => [b.category, b.monthlyLimit]));
  const allCats    = Array.from(new Set([
    ...Array.from(catActual.keys()),
    ...Array.from(budgetMap.keys()),
  ])).filter((c) => !INCOME_CATS.has(c));

  const budgetRows = allCats
    .map((cat) => {
      const actual = catActual.get(cat) ?? 0;
      const limit  = budgetMap.get(cat) ?? 0;
      const diff   = limit > 0 ? actual - limit : 0;
      const pct    = limit > 0 ? Math.min(Math.round((actual / limit) * 100), 999) : 0;
      return { cat, actual, limit, diff, pct };
    })
    .filter((r) => r.actual > 0 || r.limit > 0)
    .sort((a, b) => {
      if (a.limit > 0 && b.limit > 0) return b.diff - a.diff;
      return b.actual - a.actual;
    });

  const totalBudget = Array.from(budgetMap.values()).reduce((s, v) => s + v, 0);
  const hasBudget   = budgetMap.size > 0;

  // ── Weekly calculations ────────────────────────────────────────────────────

  const today      = new Date();
  const weekStart  = startOfWeek(today, { weekStartsOn: 1 });
  const daysIntoWeek = Math.min(differenceInDays(today, weekStart) + 1, 7);
  const weekFraction = daysIntoWeek / 7;

  const thisWeekCatMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.isInternalTransfer) continue;
    const tDate = parseISO(t.date);
    if (tDate < weekStart || tDate > today) continue;
    const cat = resolvedCat(t);
    if (INCOME_CATS.has(cat)) continue;
    if (t.amount <= 0) continue;
    thisWeekCatMap.set(cat, (thisWeekCatMap.get(cat) ?? 0) + t.amount);
  }

  const thisWeekTotal   = Array.from(thisWeekCatMap.values()).reduce((s, v) => s + v, 0);
  const weeklyBudget    = totalBudget > 0 ? totalBudget / 4.3 : 0;
  const weekPaceTarget  = weeklyBudget * weekFraction;
  const weekAheadOfPace = weekPaceTarget > 0 && thisWeekTotal < weekPaceTarget;

  const weekDayAmounts = Array.from({ length: 7 }, (_, i) => {
    const day    = addDays(weekStart, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const amt    = transactions
      .filter((t) => !t.isInternalTransfer && t.date === dayStr && t.amount > 0 && !INCOME_CATS.has(resolvedCat(t)))
      .reduce((s, t) => s + t.amount, 0);
    return {
      label:    format(day, "EEEEE"),
      amount:   amt,
      isToday:  dayStr === format(today, "yyyy-MM-dd"),
      isFuture: day > today,
    };
  });

  const thisWeekTopCats = Array.from(thisWeekCatMap.entries()).sort((a, b) => b[1] - a[1]);
  const dayBarMax       = Math.max(...weekDayAmounts.map((d) => d.amount), 1);

  // ── Recurring ─────────────────────────────────────────────────────────────

  const allRecurring    = detectRecurring(transactions);
  const recurringItems  = allRecurring.filter(
    (r) => r.type === "expense" && !fc.recurringHidden.includes(r.key),
  );
  const monthlyRecurring = recurringItems.reduce((s, r) => {
    const mult = r.cadence === "weekly" ? 4.3 : r.cadence === "biweekly" ? 2.15
      : r.cadence === "monthly" ? 1 : r.cadence === "annual" ? 1 / 12 : 1;
    return s + r.avgAmount * mult;
  }, 0);

  // ── Modals ─────────────────────────────────────────────────────────────────

  const openBudgetModal = () => {
    const draft: Record<string, string> = {};
    for (const b of data.budgetCategories) draft[b.category] = String(b.monthlyLimit);
    for (const cat of Array.from(catActual.keys())) {
      if (!(cat in draft)) draft[cat] = "";
    }
    setBudgetDraft(draft);
    setBudgetOpen(true);
  };

  const saveBudget = () => {
    const saved = Object.entries(budgetDraft)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([category, v]) => ({ category, monthlyLimit: Number(v) }));
    update((d) => ({ ...d, budgetCategories: saved }));
    setBudgetOpen(false);
  };

  const addCard = () => {
    if (!cardForm.name.trim()) return;
    update((d) => ({ ...d, creditCards: [...d.creditCards, { ...cardForm, id: id() }] }));
    setCardForm({ name: "", balance: 0, limit: 0, targetPayoff: "" });
    setCardOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="font-serif text-2xl text-white">Finances</h1>
        <div className="flex items-center gap-2">
          {(loadingAccts || loadingTxns) && (
            <span className="text-xs text-sand-dark animate-pulse">Loading…</span>
          )}
          <PlaidConnectButton onConnected={handleConnected} />
          <Button variant="secondary" onClick={openBudgetModal}>
            <SlidersHorizontal size={12} className="mr-1 inline" />Budget
          </Button>
          <button
            onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-sand-dark hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {lastRefreshedAt && (
            <span className="text-[10px] text-sand-dark">{timeAgo(lastRefreshedAt)}</span>
          )}
        </div>
      </div>

      {/* ── Hero: 4 stat cards ── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">

        <div className="card p-4 flex flex-col justify-between" style={{ minHeight: 90 }}>
          <p className="text-[10px] font-medium text-sand-dark uppercase tracking-widest">Net Worth</p>
          <p className={`font-serif text-3xl leading-none mt-1 ${netWorth < 0 ? "text-rose" : "text-white"}`}>
            {netWorth < 0 && "−"}{fmtN(netWorth)}
          </p>
          <p className="text-[10px] text-sand-dark mt-1.5">
            {fmtN(totalCash)} cash · {fmtN(totalCredit)} owed
          </p>
        </div>

        <div className="card p-4 flex flex-col justify-between" style={{ minHeight: 90 }}>
          <p className="text-[10px] font-medium text-sand-dark uppercase tracking-widest">Cash Runway</p>
          <p className="font-serif text-3xl leading-none mt-1" style={{ color: runwayColor }}>
            {runwayDays != null ? `${runwayDays}d` : "—"}
          </p>
          <p className="text-[10px] text-sand-dark mt-1.5">
            {avgDailySpend > 0 ? `~$${Math.round(avgDailySpend)}/day avg` : "loading…"}
          </p>
        </div>

        <div className="card p-4 flex flex-col justify-between" style={{ minHeight: 90 }}>
          <p className="text-[10px] font-medium text-sand-dark uppercase tracking-widest">
            {format(today, "MMMM")}
          </p>
          {hasBudget && totalBudget > 0 ? (
            <>
              <p className={`font-serif text-3xl leading-none mt-1 ${totalSpent > totalBudget ? "text-rose" : "text-sage"}`}>
                {totalSpent > totalBudget
                  ? `${fmtN(totalSpent - totalBudget)} over`
                  : `${fmtN(totalBudget - totalSpent)} left`}
              </p>
              <p className="text-[10px] text-sand-dark mt-1.5">
                {fmtN(totalSpent)} of {fmtN(totalBudget)}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-3xl text-white leading-none mt-1">{fmtN(totalSpent)}</p>
              <p className="text-[10px] text-sand-dark mt-1.5">spent this month</p>
            </>
          )}
        </div>

        <div className="card p-4 flex flex-col justify-between" style={{ minHeight: 90 }}>
          <p className="text-[10px] font-medium text-sand-dark uppercase tracking-widest">This Week</p>
          <p className="font-serif text-3xl leading-none mt-1" style={{ color: "#C8FF00" }}>
            {fmtN(thisWeekTotal)}
          </p>
          <p className="text-[10px] text-sand-dark mt-1.5">
            {weekAheadOfPace
              ? `${fmtN(weekPaceTarget - thisWeekTotal)} under pace`
              : weeklyBudget > 0
              ? `${fmtN(thisWeekTotal - weekPaceTarget)} over pace`
              : `day ${daysIntoWeek} of 7`}
          </p>
        </div>

      </div>

      {/* ── Middle Row: Budget · This Week · Recurring ── */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">

        {/* Budget Categories */}
        <div className="card p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="font-serif text-base text-white">Budget</h3>
            <button onClick={openBudgetModal} className="text-[10px] text-sand-dark hover:text-white transition-colors">
              edit
            </button>
          </div>
          {hasBudget && totalBudget > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <div className="flex-1 h-0.5 bg-cream-darker rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
                    background: totalSpent > totalBudget ? "#DA667B" : "#9B7FFF",
                  }} />
              </div>
              <span className="text-[10px] text-sand-dark flex-shrink-0">
                {Math.round((totalSpent / totalBudget) * 100)}%
              </span>
            </div>
          )}
          <div className="space-y-2 overflow-hidden flex-1">
            {budgetRows.slice(0, 6).map((r) => {
              const isOver = r.limit > 0 && r.diff > 0;
              const isWarn = r.limit > 0 && r.pct >= 80 && !isOver;
              const dotColor = isOver ? "#DA667B" : isWarn ? "#C99A5C" : "#9B7FFF";
              const barPct   = r.limit > 0 ? Math.min(100, r.pct) : 60;
              return (
                <div key={r.cat} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <span className="text-xs text-white flex-1 truncate min-w-0">{catLabel(r.cat)}</span>
                  <div className="w-14 h-0.5 bg-cream-darker rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: dotColor }} />
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${isOver ? "text-rose" : "text-white"}`}>
                    {fmtN(r.actual)}
                  </span>
                </div>
              );
            })}
            {budgetRows.length > 6 && (
              <p className="text-[10px] text-sand-dark">+{budgetRows.length - 6} more categories</p>
            )}
            {budgetRows.length === 0 && !loadingTxns && (
              <p className="text-xs text-sand-dark">No spending this month yet.</p>
            )}
          </div>
        </div>

        {/* This Week */}
        <div className="card p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
            <h3 className="font-serif text-base text-white">This Week</h3>
            {weeklyBudget > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${weekAheadOfPace ? "bg-sage/15 text-sage" : "bg-rose/10 text-rose"}`}>
                {weekAheadOfPace ? "on track" : "over pace"}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-3 flex-shrink-0">
            <p className="font-serif text-2xl text-white leading-none">{fmtN(thisWeekTotal)}</p>
            <span className="text-xs text-sand-dark">day {daysIntoWeek}/7</span>
          </div>

          {/* Day bars */}
          <div className="flex items-end gap-1 mb-3 flex-shrink-0" style={{ height: 40 }}>
            {weekDayAmounts.map((d, i) => {
              const barH = d.isFuture ? 2 : Math.max(2, Math.round((d.amount / dayBarMax) * 32));
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="w-full rounded-sm" style={{
                    height: barH,
                    background: d.isToday ? "#C8FF00" : d.isFuture ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)",
                    alignSelf: "flex-end",
                  }} />
                  <span className="text-[9px]" style={{ color: d.isToday ? "#C8FF00" : "rgba(255,255,255,0.35)" }}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Top categories */}
          <div className="space-y-1.5 overflow-hidden flex-1">
            {thisWeekTopCats.slice(0, 4).map(([cat, amt]) => {
              const pct = thisWeekTotal > 0 ? (amt / thisWeekTotal) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-[11px] text-white flex-1 truncate">{catLabel(cat)}</span>
                  <div className="w-14 h-0.5 bg-cream-darker rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgba(155,127,255,0.6)" }} />
                  </div>
                  <span className="text-[11px] text-sand-dark flex-shrink-0">{fmtN(amt)}</span>
                </div>
              );
            })}
            {thisWeekTopCats.length === 0 && (
              <p className="text-xs text-sand-dark">No spending yet this week.</p>
            )}
          </div>
        </div>

        {/* Recurring */}
        <div className="card p-4 overflow-hidden flex flex-col">
          <div className="mb-2 flex-shrink-0">
            <h3 className="font-serif text-base text-white">Recurring</h3>
            {monthlyRecurring > 0 && (
              <p className="text-[10px] text-sand-dark mt-0.5">{fmt$(monthlyRecurring)}/month in bills</p>
            )}
          </div>
          <div className="space-y-2 overflow-hidden flex-1">
            {recurringItems.slice(0, 7).map((r) => {
              const daysUntil = r.nextEstimated
                ? differenceInDays(parseISO(r.nextEstimated), today)
                : null;
              const dueSoon = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
              return (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="text-[11px] text-white truncate flex-1 min-w-0">{r.merchant}</span>
                  <span className="text-[10px] text-sand-dark flex-shrink-0">{fmt$(r.avgAmount)}</span>
                  {daysUntil !== null && (
                    <span className="text-[10px] flex-shrink-0 font-medium"
                      style={{ color: dueSoon ? "#C8FF00" : "rgba(255,255,255,0.35)" }}>
                      {daysUntil <= 0 ? "due" : daysUntil === 1 ? "tmrw" : `${daysUntil}d`}
                    </span>
                  )}
                </div>
              );
            })}
            {recurringItems.length > 7 && (
              <p className="text-[10px] text-sand-dark">+{recurringItems.length - 7} more</p>
            )}
            {recurringItems.length === 0 && !loadingTxns && (
              <p className="text-xs text-sand-dark">No recurring detected yet.</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Bottom Row: Accounts · Savings ── */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0" style={{ height: 168 }}>

        {/* Connected Accounts */}
        <div className="card p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="font-serif text-base text-white">Accounts</h3>
            <div className="flex items-center gap-3">
              {refreshedAt && (
                <span className="text-[10px] text-sand-dark">as of {format(parseISO(refreshedAt), "h:mm a")}</span>
              )}
              <PlaidConnectButton onConnected={handleConnected} compact />
              <button onClick={() => setCardOpen(true)} className="text-[10px] text-sand-dark hover:text-white transition-colors">
                + manual
              </button>
            </div>
          </div>
          <div className="space-y-1.5 overflow-hidden flex-1">
            {loadingAccts && accounts.length === 0 && (
              <p className="text-xs text-sand-dark animate-pulse">Loading accounts…</p>
            )}
            {accounts.slice(0, 5).map((acc) => {
              if (acc.loginRequired) {
                return (
                  <div key={acc.itemId ?? acc.accountId} className="flex items-center gap-2">
                    <AlertTriangle size={10} className="text-rose flex-shrink-0" />
                    <span className="text-xs text-rose truncate flex-1">
                      {acc.institutionName ?? "Bank"} — reconnect needed
                    </span>
                  </div>
                );
              }
              const dotColor = acc.type === "credit" ? "#DA667B" : acc.type === "loan" ? "#FF6B9D" : "#9B7FFF";
              const { text, negative } = fmtBal(effectiveBalance(acc));
              return (
                <div key={acc.accountId} className="group flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <span className="text-xs text-white truncate flex-1 min-w-0">
                    {acc.institutionName ?? cleanAcctName(acc.name, acc.subtype, acc.type)}
                    {acc.mask ? ` ···${acc.mask}` : ""}
                  </span>
                  <span className={`text-xs font-medium flex-shrink-0 ${negative ? "text-rose" : "text-white"}`}>
                    {text}
                  </span>
                  <button onClick={() => handleDisconnect(acc.itemId)}
                    className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose transition-all flex-shrink-0"
                    title="Disconnect">
                    <Unlink size={10} />
                  </button>
                </div>
              );
            })}
            {accounts.length > 5 && (
              <p className="text-[10px] text-sand-dark">+{accounts.length - 5} more accounts</p>
            )}
            {!loadingAccts && accounts.length === 0 && (
              <p className="text-xs text-sand-dark">No accounts connected yet.</p>
            )}
          </div>
        </div>

        {/* Savings Quests */}
        <div className="card p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="font-serif text-base text-white">Savings Quests</h3>
            <button onClick={() => setSavingsOpen(true)} className="text-[10px] text-sand-dark hover:text-white transition-colors">
              manage
            </button>
          </div>
          {data.savingsGoals.length === 0 ? (
            <button onClick={() => setSavingsOpen(true)}
              className="text-xs text-sand-dark hover:text-white transition-colors flex-1 flex items-start pt-1">
              + Add a savings goal
            </button>
          ) : (
            <div className="space-y-2 overflow-hidden flex-1">
              {data.savingsGoals.slice(0, 4).map((goal, i) => {
                const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
                const barColors = ["#DA667B", "#9B7FFF", "#C8FF00", "#C99A5C"];
                const barColor  = barColors[i % barColors.length];
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-white truncate flex-1 min-w-0">{goal.name}</span>
                      <span className="text-[10px] text-sand-dark ml-2 flex-shrink-0">
                        {fmtN(goal.current)} / {fmtN(goal.target)}
                      </span>
                    </div>
                    <div className="h-1 bg-cream-darker rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
              {data.savingsGoals.length > 4 && (
                <p className="text-[10px] text-sand-dark">+{data.savingsGoals.length - 4} more</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Budget Modal ── */}
      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title={`Monthly Budget · ${format(today, "MMMM yyyy")}`}>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-sand-dark mb-3">
            Set a monthly limit for each category. Leave blank to skip tracking.
          </p>
          {Array.from(new Set([
            ...Object.keys(budgetDraft),
            ...BUDGET_CATS.filter((c) => !(c in budgetDraft)),
          ])).map((cat) => (
            <div key={cat} className="flex items-center gap-3 py-2 border-b border-sand/20 last:border-0">
              <label className="text-sm text-brown flex-1">{catLabel(cat)}</label>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-dark text-xs">$</span>
                <input
                  type="number" min={0} placeholder="—"
                  value={budgetDraft[cat] ?? ""}
                  onChange={(e) => setBudgetDraft((d) => ({ ...d, [cat]: e.target.value }))}
                  className="pl-5 text-right text-xs"
                />
              </div>
              {catActual.get(cat) != null && (
                <span className="text-[10px] text-sand-dark w-16 text-right flex-shrink-0">
                  spent {fmtN(catActual.get(cat))}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setBudgetOpen(false)}>Cancel</Button>
          <Button onClick={saveBudget}>Save Budget</Button>
        </div>
      </Modal>

      {/* ── Manual Card Modal ── */}
      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="Add Manual Card">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Card Name</label>
            <input type="text" placeholder="e.g. Chase Sapphire" value={cardForm.name}
              onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Balance ($)</label>
              <input type="number" min={0} value={cardForm.balance}
                onChange={(e) => setCardForm({ ...cardForm, balance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Limit ($)</label>
              <input type="number" min={0} value={cardForm.limit}
                onChange={(e) => setCardForm({ ...cardForm, limit: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={addCard}>Add Card</Button>
          </div>
        </div>
      </Modal>

      {/* ── Savings Quests Modal ── */}
      <Modal open={savingsOpen} onClose={() => setSavingsOpen(false)} title="Savings Quests">
        <div className="max-h-[70vh] overflow-y-auto -mx-1">
          <SavingsQuests
            goals={data.savingsGoals}
            onUpdate={(goals) => update((d) => ({ ...d, savingsGoals: goals }))}
          />
        </div>
      </Modal>

    </div>
  );
}
