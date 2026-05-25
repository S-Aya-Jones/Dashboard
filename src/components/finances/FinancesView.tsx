"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, AlertTriangle, Link2, Link2Off, SlidersHorizontal, ChevronDown } from "lucide-react";
import { DashboardData, MerchantCategoryOverride } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";
import { format, parseISO, startOfMonth, isAfter, differenceInDays } from "date-fns";
import { RunwayGauge } from "./RunwayGauge";
import { DashboardVoice } from "./DashboardVoice";
import { RecurringPanel } from "./RecurringPanel";
import { WeeklyScorecard } from "./WeeklyScorecard";
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function typePill(type: string, subtype?: string | null) {
  const sub = (subtype ?? "").toLowerCase();
  const label =
    sub === "checking"       ? "Checking"
    : sub === "savings"      ? "Savings"
    : sub === "cd"           ? "CD"
    : sub === "money market" ? "Money Mkt"
    : sub === "hsa"          ? "HSA"
    : sub === "paypal"       ? "PayPal"
    : sub === "credit card"  ? "Credit"
    : type === "credit"      ? "Credit"
    : type === "depository"  ? "Bank"
    : type === "loan"        ? "Loan"
    : type === "investment"  ? "Investment"
    : "Bank";
  const colors: Record<string, string> = {
    Checking: "bg-sage/20 text-sage", Savings: "bg-sage/20 text-sage",
    Credit: "bg-terracotta/15 text-terracotta", Loan: "bg-rose/20 text-rose",
    Investment: "bg-brown/15 text-brown",
    Bank: "bg-sand/30 text-sand-dark", CD: "bg-sand/30 text-sand-dark",
    "Money Mkt": "bg-sand/30 text-sand-dark", HSA: "bg-sage/20 text-sage",
    PayPal: "bg-sand/30 text-sand-dark",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[label] ?? "bg-sand/30 text-sand-dark"}`}>
      {label}
    </span>
  );
}

function InstitutionAvatar({ name }: { name: string | null | undefined }) {
  const letter = name?.[0]?.toUpperCase() ?? "?";
  const colors = ["#71816D", "#C99A5C", "#DA667B", "#8A9E87", "#A8967E"];
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: colors[letter.charCodeAt(0) % colors.length] }}>
      {letter}
    </div>
  );
}

// Returns the "effective" balance to display:
//   Depository → available (fallback: current, flagged as estimated)
//   Credit     → amount owed = limit − available (fallback: current)
function effectiveBalance(acc: PlaidAccount): number {
  if (acc.type === "credit") {
    const limit = acc.balances.limit ?? 0;
    const avail = acc.balances.available;
    if (avail != null && limit > 0) return limit - avail;
    return acc.balances.current ?? 0;
  }
  return acc.balances.available ?? acc.balances.current ?? 0;
}

// True when we're showing current instead of available for a depository account
function isEstimatedBalance(acc: PlaidAccount): boolean {
  return acc.type !== "credit" && acc.balances.available == null && acc.balances.current != null;
}

// ── Plaid Link button ─────────────────────────────────────────────────────────

function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
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

  return (
    <Button onClick={handleClick} disabled={fetching}>
      {fetching ? "Preparing…" : "+ Connect a bank"}
    </Button>
  );
}

// ── Default financesConfig ────────────────────────────────────────────────────

const DEFAULT_FC = {
  bigTicketThreshold:        100,
  watchListMerchants:        ["sephora", "ulta", "amazon", "starbucks", "coffee", "doordash", "ubereats", "grubhub", "uber", "lyft"],
  bigMoves:                  [],
  recurringHidden:           [] as string[],
  recurringFlagged:          [] as string[],
  merchantCategoryOverrides: [] as MerchantCategoryOverride[],
};

const OVERRIDE_CAT_OPTIONS = [
  { value: "GROCERIES",           label: "Groceries" },
  { value: "FOOD_AND_DRINK",      label: "Eating Out" },
  { value: "TRANSPORTATION",      label: "Transport" },
  { value: "PERSONAL_CARE",       label: "Personal Care" },
  { value: "GENERAL_MERCHANDISE", label: "Merchandise" },
  { value: "SHOPPING",            label: "Shopping" },
  { value: "ENTERTAINMENT",       label: "Entertainment" },
  { value: "GENERAL_SERVICES",    label: "Services" },
  { value: "RENT_AND_UTILITIES",  label: "Housing" },
  { value: "MEDICAL",             label: "Healthcare" },
  { value: "TRAVEL",              label: "Travel" },
];

function timeAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function FinancesView({ data, update }: Props) {
  const [accounts,       setAccounts]       = useState<PlaidAccount[]>([]);
  const [transactions,   setTransactions]   = useState<PlaidTxn[]>([]);
  const [transferCount,  setTransferCount]  = useState(0);
  const [expandedCat,    setExpandedCat]    = useState<string | null>(null);
  const [fixingTxn,      setFixingTxn]      = useState<string | null>(null);
  const [refreshedAt,    setRefreshedAt]    = useState<string | null>(null);
  const [loadingAccts,   setLoadingAccts]   = useState(true);
  const [loadingTxns,    setLoadingTxns]    = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [cardOpen,    setCardOpen]    = useState(false);
  const [budgetOpen,  setBudgetOpen]  = useState(false);
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
      // If Plaid actually triggered a refresh (not rate-limited), wait 3s
      // for the data to propagate before re-fetching.
      if (!json.skipped) await new Promise((r) => setTimeout(r, 3000));
      await Promise.all([fetchAccounts(!json.skipped), fetchTransactions(!json.skipped)]);
    } finally {
      setRefreshing(false);
    }
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

  // ── financesConfig ─────────────────────────────────────────────────────────

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

  const saveOverride = (merchantName: string, newCategory: string) => {
    const nameContains = merchantName.toLowerCase().trim().slice(0, 40);
    update((d) => {
      const cfg      = d.financesConfig ?? DEFAULT_FC;
      const existing = cfg.merchantCategoryOverrides ?? [];
      const filtered = existing.filter((o) => !nameContains.startsWith(o.nameContains.slice(0, 8)) && !o.nameContains.startsWith(nameContains.slice(0, 8)));
      return {
        ...d,
        financesConfig: {
          ...cfg,
          merchantCategoryOverrides: [...filtered, { nameContains, category: newCategory }],
        },
      };
    });
    setFixingTxn(null);
  };

  // ── Handlers for new components ────────────────────────────────────────────

  const handleToggleHide = (key: string) => {
    update((d) => {
      const cfg            = d.financesConfig ?? DEFAULT_FC;
      const recurringHidden = cfg.recurringHidden.includes(key)
        ? cfg.recurringHidden.filter((k) => k !== key)
        : [...cfg.recurringHidden, key];
      return { ...d, financesConfig: { ...cfg, recurringHidden } };
    });
  };

  const handleToggleFlag = (key: string) => {
    update((d) => {
      const cfg              = d.financesConfig ?? DEFAULT_FC;
      const recurringFlagged = cfg.recurringFlagged.includes(key)
        ? cfg.recurringFlagged.filter((k) => k !== key)
        : [...cfg.recurringFlagged, key];
      return { ...d, financesConfig: { ...cfg, recurringFlagged } };
    });
  };

  // ── Plaid totals ───────────────────────────────────────────────────────────

  const realAccounts = accounts.filter((a) => !a.loginRequired);
  // Available balance in checking/savings only — never include credit lines
  const totalCash   = realAccounts.filter((a) => a.type === "depository")
    .reduce((s, a) => s + (a.balances.available ?? a.balances.current ?? 0), 0);
  // Amount owed on credit cards (limit − available, or current as fallback)
  const totalCredit = realAccounts.filter((a) => a.type === "credit")
    .reduce((s, a) => s + effectiveBalance(a), 0);
  const netWorth    = totalCash - totalCredit;

  // ── Cash Runway ───────────────────────────────────────────────────────────

  const last30Spend = transactions
    .filter((t) => {
      if (t.isInternalTransfer) return false;
      if (INCOME_CATS.has(t.category)) return false;
      if (t.amount <= 0) return false;
      return differenceInDays(new Date(), parseISO(t.date)) <= 30;
    })
    .reduce((s, t) => s + t.amount, 0);
  const avgDailySpend = last30Spend / 30;

  // ── This-month spending ────────────────────────────────────────────────────

  const monthStart = startOfMonth(new Date());

  // Transfers always excluded from spending totals
  const thisMo = transactions.filter(
    (t) => !t.isInternalTransfer && (isAfter(parseISO(t.date), monthStart) || parseISO(t.date) >= monthStart),
  );

  const totalIncome = thisMo.filter((t) => INCOME_CATS.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // ── Category analysis ──────────────────────────────────────────────────────

  const catActual = new Map<string, number>();
  for (const t of thisMo) {
    const cat = resolvedCat(t);
    if (INCOME_CATS.has(cat)) continue;
    // Include returns (negative amounts) so they net against purchases
    catActual.set(cat, (catActual.get(cat) ?? 0) + t.amount);
  }

  // Net spending = sum of category totals (returns reduce it naturally)
  const totalSpent = Math.max(0, Array.from(catActual.values()).reduce((s, v) => s + v, 0));

  // Returns summary for the info chip
  const returnTxns  = thisMo.filter((t) => !INCOME_CATS.has(resolvedCat(t)) && t.amount < 0);
  const returnTotal = returnTxns.reduce((s, t) => s + Math.abs(t.amount), 0);

  const budgetMap  = new Map(data.budgetCategories.map((b) => [b.category, b.monthlyLimit]));
  const allCats    = Array.from(new Set([
    ...Array.from(catActual.keys()),
    ...Array.from(budgetMap.keys()),
  ])).filter((c) => !INCOME_CATS.has(c));

  const budgetRows = allCats.map((cat) => {
    const actual = catActual.get(cat) ?? 0;
    const limit  = budgetMap.get(cat) ?? 0;
    const diff   = limit > 0 ? actual - limit : 0;
    const pct    = limit > 0 ? Math.min(Math.round((actual / limit) * 100), 999) : 0;
    return { cat, actual, limit, diff, pct };
  }).sort((a, b) => {
    if (a.limit > 0 && b.limit > 0) return b.diff - a.diff;
    return b.actual - a.actual;
  });

  const totalBudget = Array.from(budgetMap.values()).reduce((s, v) => s + v, 0);
  const hasBudget   = budgetMap.size > 0;

  // ── Voice stats ────────────────────────────────────────────────────────────

  const voiceStats: string[] = [];
  if (totalCash > 0) {
    voiceStats.push(`Available cash: ${fmt$(totalCash)}`);
  }
  if (avgDailySpend > 0 && totalCash > 0) {
    voiceStats.push(`Runway: ${Math.round(totalCash / avgDailySpend)} days`);
  }
  const topCatEntry = Array.from(catActual.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topCatEntry) {
    voiceStats.push(`${catLabel(topCatEntry[0])} is your top spend this month — ${fmt$(topCatEntry[1])}`);
  }
  // ── Manual entries ─────────────────────────────────────────────────────────

  const addCard = () => {
    if (!cardForm.name.trim()) return;
    update((d) => ({ ...d, creditCards: [...d.creditCards, { ...cardForm, id: id() }] }));
    setCardForm({ name: "", balance: 0, limit: 0, targetPayoff: "" });
    setCardOpen(false);
  };
  const updateCardBalance = (cid: string, val: number) =>
    update((d) => ({ ...d, creditCards: d.creditCards.map((c) => c.id === cid ? { ...c, balance: val } : c) }));

  // ── Budget modal ───────────────────────────────────────────────────────────

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

  // ── Goal linking ───────────────────────────────────────────────────────────

  const financialGoals = data.goals.filter((g) => g.category === "financial" && !g.done);

  const linkGoalToAccount = (goalId: string, accountId: string | undefined) => {
    const acc = realAccounts.find((a) => a.accountId === accountId);
    update((d) => ({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              linkedPlaidAccountId: accountId,
              plaidLinkStartBalance:
                accountId && !g.linkedPlaidAccountId
                  ? (acc ? effectiveBalance(acc) : g.plaidLinkStartBalance)
                  : g.plaidLinkStartBalance,
            }
          : g,
      ),
    }));
  };

  const hasPlaid    = accounts.length > 0 || loadingAccts;
  const hasActivity = thisMo.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-brown">Finances</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PlaidConnectButton onConnected={handleConnected} />
          <Button variant="secondary" onClick={openBudgetModal}>
            <SlidersHorizontal size={13} className="mr-1.5 inline" />
            Set Budget
          </Button>
          <Button variant="secondary" onClick={() => setCardOpen(true)}>+ Manual Card</Button>
          <div className="flex flex-col items-end gap-0.5">
            <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={13} className={`mr-1.5 inline ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            {lastRefreshedAt && (
              <span className="text-[10px] text-sand-dark">Last refreshed: {timeAgo(lastRefreshedAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Dashboard Voice ── */}
      {voiceStats.length > 0 && <DashboardVoice stats={voiceStats} />}

      {/* ── Cash Runway ── */}
      {totalCash > 0 && avgDailySpend > 0 && (
        <RunwayGauge cashBalance={totalCash} avgDailySpend={avgDailySpend} />
      )}

      {/* ── Account Overview ── */}
      {hasPlaid && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Cash",        value: totalCash,   color: "text-sage" },
              { label: "Total Credit Debt", value: totalCredit, color: "text-terracotta" },
              { label: "Net Worth",         value: netWorth,    color: netWorth >= 0 ? "text-sage" : "text-rose" },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className={`font-serif text-2xl ${s.color}`}>{fmt$(s.value)}</p>
                <p className="text-xs text-sand-dark mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {refreshedAt && (
            <p className="text-right text-[10px] text-sand-dark pr-0.5">
              Balances as of {format(parseISO(refreshedAt), "h:mm a")}
            </p>
          )}
        </div>
      )}

      {/* ── This Month: Spending ── */}
      {(hasActivity || loadingTxns) && (
        <div className="card p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-brown">{format(new Date(), "MMMM yyyy")}</h3>
            <button onClick={openBudgetModal}
              className="flex items-center gap-1 text-[11px] text-sand-dark hover:text-brown transition-colors">
              <SlidersHorizontal size={11} />
              {hasBudget ? "Edit budget" : "Set budget"}
            </button>
          </div>

          {/* Key numbers */}
          <div className="flex items-end gap-5 mb-4">
            <div>
              <p className="font-serif text-3xl text-terracotta leading-none">{fmt$(totalSpent)}</p>
              <p className="text-xs text-sand-dark mt-1">spent</p>
            </div>
            {hasBudget && totalBudget > 0 && (
              <div>
                <p className={`font-serif text-2xl leading-none ${totalSpent > totalBudget ? "text-rose" : "text-sage"}`}>
                  {totalSpent > totalBudget
                    ? `${fmt$(totalSpent - totalBudget)} over`
                    : `${fmt$(totalBudget - totalSpent)} left`}
                </p>
                <p className="text-xs text-sand-dark mt-1">of {fmt$(totalBudget)}</p>
              </div>
            )}
            {totalIncome > 0 && (
              <div className="ml-auto text-right">
                <p className="font-serif text-xl text-sage leading-none">{fmt$(totalIncome)}</p>
                <p className="text-xs text-sand-dark mt-1">in</p>
              </div>
            )}
          </div>

          {/* Overall budget bar */}
          {hasBudget && totalBudget > 0 && (
            <div className="h-1 bg-cream-darker rounded-full overflow-hidden mb-5">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
                  background: totalSpent > totalBudget ? "#DA667B" : totalSpent / totalBudget > 0.9 ? "#DA667B" : totalSpent / totalBudget > 0.7 ? "#C99A5C" : "#71816D",
                }} />
            </div>
          )}

          {/* Transfer / returns notices */}
          {(transferCount > 0 || returnTxns.length > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
              {transferCount > 0 && (
                <p className="text-[11px] text-sand-dark">
                  🔁 {transferCount} transfer{transferCount !== 1 ? "s" : ""} excluded
                </p>
              )}
              {returnTxns.length > 0 && (
                <p className="text-[11px] text-sage font-medium">
                  ↩ {returnTxns.length} return{returnTxns.length !== 1 ? "s" : ""} · {fmt$(returnTotal)} back
                </p>
              )}
            </div>
          )}

          {/* Category breakdown — expandable */}
          {budgetRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-sand-dark uppercase tracking-widest">Where it went</p>
                {!hasBudget && (
                  <button onClick={openBudgetModal}
                    className="text-[11px] text-terracotta hover:text-brown underline decoration-dotted transition-colors">
                    + add spending limits
                  </button>
                )}
              </div>
              <div className="divide-y divide-sand/10">
                {budgetRows.map((r) => {
                  const isExpanded = expandedCat === r.cat;
                  const isOver     = r.limit > 0 && r.diff > 0;
                  const isWarning  = r.limit > 0 && r.pct >= 80 && !isOver;
                  const dotColor   = isOver ? "#DA667B" : isWarning ? "#C99A5C" : "#71816D";
                  const catTxns    = thisMo
                    .filter((t) => resolvedCat(t) === r.cat)
                    .sort((a, b) => b.amount - a.amount);
                  const purchases  = catTxns.filter((t) => t.amount > 0);
                  const returns    = catTxns.filter((t) => t.amount < 0);

                  return (
                    <div key={r.cat}>
                      <button
                        onClick={() => setExpandedCat(isExpanded ? null : r.cat)}
                        className="w-full flex items-center gap-3 py-3 text-left hover:bg-cream-darker/60 rounded-lg px-1.5 -mx-1.5 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                        <span className="text-sm text-brown flex-1 truncate">{catLabel(r.cat)}</span>
                        <span className="text-xs font-medium text-sand-dark">
                          {purchases.length}×{returns.length > 0 && <span className="text-sage"> ↩{returns.length}</span>}
                        </span>
                        <span className={`text-sm font-semibold ${isOver ? "text-rose" : "text-brown"}`}>
                          {fmt$(r.actual)}
                        </span>
                        {r.limit > 0 && (
                          <span className="text-[10px] text-sand-dark hidden sm:block">/ {fmt$(r.limit)}</span>
                        )}
                        {isOver && (
                          <span className="text-[10px] font-semibold text-rose bg-rose/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            +{fmt$(r.diff)}
                          </span>
                        )}
                        {!isOver && r.limit > 0 && (
                          <span className="text-[10px] text-sage bg-sage/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {fmt$(r.limit - r.actual)} left
                          </span>
                        )}
                        <ChevronDown size={12} className={`text-sand flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {/* Budget progress bar (always visible, thin) */}
                      {r.limit > 0 && (
                        <div className="h-0.5 bg-cream-darker mx-1.5 mb-1 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(100, r.pct)}%`, background: dotColor }} />
                        </div>
                      )}

                      {/* Expanded transaction list */}
                      {isExpanded && catTxns.length > 0 && (
                        <div className="mb-2 mx-1.5 rounded-xl overflow-hidden border border-sand/15">
                          {catTxns.map((t, i) => {
                            const isReturn = t.amount < 0;
                            return (
                              <div key={t.id}
                                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-sand/10" : ""} ${isReturn ? "bg-sage/5" : "bg-cream/40"}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-brown truncate">{t.name}</p>
                                    {isReturn && (
                                      <span className="text-[9px] font-semibold text-sage bg-sage/15 px-1 py-0.5 rounded flex-shrink-0">refund</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-sand-dark">{format(parseISO(t.date), "MMM d")}</p>
                                </div>
                                {!isReturn && (fixingTxn === t.id ? (
                                  <select
                                    autoFocus
                                    defaultValue=""
                                    className="text-[11px] h-6 py-0 px-1.5 rounded-lg flex-shrink-0"
                                    onChange={(e) => { if (e.target.value) saveOverride(t.name, e.target.value); }}
                                    onBlur={() => setFixingTxn(null)}
                                  >
                                    <option value="" disabled>Move to…</option>
                                    {OVERRIDE_CAT_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setFixingTxn(t.id); }}
                                    className="text-[10px] text-sand hover:text-terracotta transition-colors flex-shrink-0"
                                    title="Wrong category?"
                                  >
                                    fix
                                  </button>
                                ))}
                                <p className={`text-xs font-semibold flex-shrink-0 ${isReturn ? "text-sage" : "text-brown"}`}>
                                  {isReturn ? `+${fmt$(Math.abs(t.amount))}` : fmt$(t.amount)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loadingTxns && transactions.length === 0 && (
            <p className="text-xs text-sand-dark text-center py-4 animate-pulse">Loading transactions…</p>
          )}
        </div>
      )}

      {/* ── Weekly Scorecard ── */}
      {transactions.length > 0 && (
        <WeeklyScorecard
          transactions={transactions}
          budgetCategories={data.budgetCategories}
          merchantCategoryOverrides={fc.merchantCategoryOverrides}
        />
      )}


      {/* ── Recurring ── */}
      {transactions.length > 0 && (
        <RecurringPanel
          transactions={transactions}
          hiddenIds={fc.recurringHidden}
          flaggedIds={fc.recurringFlagged}
          onToggleHide={handleToggleHide}
          onToggleFlag={handleToggleFlag}
        />
      )}

      {/* ── Connected Accounts ── */}
      {accounts.length > 0 && (
        <Card title="Connected Accounts">
          <div className="space-y-3 mt-1">
            {accounts.map((acc, i) => {
              if (acc.loginRequired) {
                return (
                  <div key={acc.itemId ?? i} className="flex items-center gap-3 p-3 rounded-xl bg-rose/10 border border-rose/20">
                    <AlertTriangle size={16} className="text-rose flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brown">{acc.institutionName ?? "Bank"}</p>
                      <p className="text-xs text-rose">Reconnection needed — log in to refresh</p>
                    </div>
                    <button onClick={() => handleDisconnect(acc.itemId)}
                      className="text-xs text-sand-dark hover:text-rose transition-colors">Remove</button>
                  </div>
                );
              }

              const isCreditCard  = acc.type === "credit";
              const displayBal    = effectiveBalance(acc);
              const estimated     = isEstimatedBalance(acc);
              const limit         = acc.balances.limit ?? 0;
              const availCredit   = isCreditCard ? (acc.balances.available ?? null) : null;
              const utilPct       = isCreditCard && limit > 0 ? Math.min(100, Math.round((displayBal / limit) * 100)) : 0;
              const utilColor     = utilPct < 30 ? "#71816D" : utilPct < 70 ? "#C99A5C" : "#DA667B";

              return (
                <div key={acc.accountId} className="group">
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-cream-darker transition-colors">
                    <InstitutionAvatar name={acc.institutionName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-brown truncate">
                          {acc.name}
                          {acc.mask ? <span className="text-sand-dark font-normal"> ···{acc.mask}</span> : null}
                        </p>
                        {typePill(acc.type, acc.subtype)}
                      </div>
                      <p className="text-xs text-sand-dark">{acc.institutionName}</p>
                      {isCreditCard && limit > 0 && (
                        <div className="mt-1.5">
                          <div className="flex justify-between text-[10px] text-sand-dark mb-0.5">
                            <span>{utilPct}% of {fmt$(limit)}</span>
                            {availCredit != null && (
                              <span className="text-sage">{fmt$(availCredit)} left</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${utilPct}%`, background: utilColor }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-serif text-lg text-brown leading-tight">{fmt$(displayBal)}</p>
                      {isCreditCard
                        ? <p className="text-[10px] text-sand-dark">owed</p>
                        : <p className="text-[10px] text-sand-dark">{estimated ? "available (est.)" : "available"}</p>
                      }
                    </div>
                    <button onClick={() => handleDisconnect(acc.itemId)}
                      className="opacity-0 group-hover:opacity-100 ml-1 text-sand hover:text-rose transition-all flex-shrink-0"
                      title="Disconnect">
                      <Unlink size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loadingAccts && accounts.length === 0 && data.creditCards.length === 0 && data.savingsGoals.length === 0 && (
        <Card>
          <div className="text-center py-10 space-y-3">
            <p className="font-serif text-2xl text-sand">Connect your accounts</p>
            <p className="text-sm text-sand-dark max-w-xs mx-auto">
              Link a bank or credit card via Plaid to see live balances and spending — or track manually above.
            </p>
          </div>
        </Card>
      )}

      {/* ── Manual Credit Cards ── */}
      {data.creditCards.length > 0 && (
        <Card title="Manual Cards" subtitle="Tracked by hand">
          <div className="space-y-4 mt-2">
            {data.creditCards.map((card) => {
              const pct = card.limit > 0 ? Math.round((card.balance / card.limit) * 100) : 0;
              return (
                <div key={card.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brown">{card.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sand-dark">{pct}% used</span>
                      <input type="number" min={0} value={card.balance}
                        onChange={(e) => updateCardBalance(card.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6" />
                    </div>
                  </div>
                  <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct > 70 ? "#DA667B" : pct > 30 ? "#C99A5C" : "#71816D" }} />
                  </div>
                  <div className="flex justify-between text-xs text-sand-dark">
                    <span>{fmt$(card.balance)} balance</span>
                    <span>{fmt$(card.limit)} limit</span>
                  </div>
                  {card.targetPayoff && <p className="text-xs text-terracotta">Target: {card.targetPayoff}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Savings Quests ── */}
      <SavingsQuests
        goals={data.savingsGoals}
        onUpdate={(goals) => update((d) => ({ ...d, savingsGoals: goals }))}
      />

      {/* ── Financial Goals with Plaid linking ── */}
      {financialGoals.length > 0 && (
        <Card title="Financial Goals" subtitle="From your goals tracker">
          <div className="space-y-3 mt-2">
            {financialGoals.map((g) => {
              const linkedAcc  = realAccounts.find((a) => a.accountId === g.linkedPlaidAccountId);
              const currentBal = linkedAcc ? effectiveBalance(linkedAcc) : null;
              const startBal   = g.plaidLinkStartBalance ?? null;
              const paydownPct =
                startBal != null && startBal > 0 && currentBal != null
                  ? Math.max(0, Math.min(100, Math.round(((startBal - currentBal) / startBal) * 100)))
                  : null;

              return (
                <div key={g.id} className="p-3 rounded-xl bg-cream hover:bg-cream-dark transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">💚</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brown">{g.text}</p>
                      {g.notes && <p className="text-xs text-sand-dark italic mt-0.5">{g.notes}</p>}
                      {g.quarter && <p className="text-xs text-terracotta mt-0.5">{g.quarter}</p>}

                      {linkedAcc && currentBal != null && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-sand-dark">
                              {linkedAcc.name}{linkedAcc.mask ? ` ···${linkedAcc.mask}` : ""}
                            </span>
                            <span className="text-[11px] font-medium text-brown">
                              {fmt$(currentBal)} {linkedAcc.type === "credit" ? "owed" : "available"}
                            </span>
                          </div>
                          {paydownPct != null && (
                            <>
                              <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${paydownPct}%`, background: paydownPct >= 70 ? "#71816D" : paydownPct >= 30 ? "#C99A5C" : "#DA667B" }} />
                              </div>
                              <p className="text-[10px] text-sand-dark">
                                {paydownPct}% paid down · started at {fmt$(startBal)}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {!loadingAccts && realAccounts.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          {linkedAcc ? <Link2 size={11} className="text-sage flex-shrink-0" /> : <Link2Off size={11} className="text-sand flex-shrink-0" />}
                          <select value={g.linkedPlaidAccountId ?? ""}
                            onChange={(e) => linkGoalToAccount(g.id, e.target.value || undefined)}
                            className="text-[11px] py-0.5 px-1.5 h-auto rounded-lg flex-1" style={{ minWidth: 0 }}>
                            <option value="">Link to a Plaid account…</option>
                            {realAccounts.map((a) => (
                              <option key={a.accountId} value={a.accountId}>
                                {a.name}{a.mask ? ` ···${a.mask}` : ""} — {fmt$(effectiveBalance(a))}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Budget modal ── */}
      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title={`Monthly Budget · ${format(new Date(), "MMMM yyyy")}`}>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-sand-dark mb-3">
            Set a monthly limit for each category. Leave blank to skip tracking that category.
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
                  spent {fmt$(catActual.get(cat))}
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

      {/* ── Footer disclaimer ── */}
      <p className="text-[11px] text-center pb-2" style={{ color: "rgba(52,42,33,0.5)" }}>
        Balances and transactions may lag your bank by a few hours. Tap Refresh to request the latest from your bank.
      </p>

      {/* ── Manual card modal ── */}
      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="Add Manual Card">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Card Name</label>
            <input type="text" placeholder="e.g. Chase Sapphire" value={cardForm.name}
              onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current Balance ($)</label>
              <input type="number" min={0} value={cardForm.balance}
                onChange={(e) => setCardForm({ ...cardForm, balance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Credit Limit ($)</label>
              <input type="number" min={0} value={cardForm.limit}
                onChange={(e) => setCardForm({ ...cardForm, limit: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Target payoff (optional)</label>
            <input type="text" placeholder="e.g. December 2025" value={cardForm.targetPayoff}
              onChange={(e) => setCardForm({ ...cardForm, targetPayoff: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={addCard}>Add Card</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
