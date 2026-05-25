"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { RefreshCw, Unlink, AlertTriangle, Link2, Link2Off, SlidersHorizontal, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";
import { format, parseISO, startOfMonth, isAfter } from "date-fns";

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
  id:               string;
  name:             string;
  amount:           number;
  date:             string;
  category:         string;
  accountId:        string;
  institutionName?: string | null;
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  FOOD_AND_DRINK:      "Food & Drink",
  TRANSPORTATION:      "Transport",
  SHOPPING:            "Shopping",
  ENTERTAINMENT:       "Entertainment",
  MEDICAL:             "Healthcare",
  GENERAL_SERVICES:    "Services",
  HOME_IMPROVEMENT:    "Home",
  RENT_AND_UTILITIES:  "Housing",
  PERSONAL_CARE:       "Personal Care",
  GENERAL_MERCHANDISE: "Merchandise",
  TRAVEL:              "Travel",
  LOAN_PAYMENTS:       "Loan Payments",
  BANK_FEES:           "Bank Fees",
  INCOME:              "Income",
  TRANSFER_IN:         "Transfer In",
  TRANSFER_OUT:        "Transfer Out",
};

const BUDGET_CATS = [
  "FOOD_AND_DRINK", "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT",
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
  const label =
    subtype === "checking"      ? "Checking"
    : subtype === "savings"     ? "Savings"
    : subtype === "credit card" ? "Credit"
    : type   === "credit"       ? "Credit"
    : type   === "loan"         ? "Loan"
    : type   === "investment"   ? "Investment"
    : "Account";
  const colors: Record<string, string> = {
    Checking: "bg-sage/20 text-sage", Savings: "bg-sage/20 text-sage",
    Credit: "bg-terracotta/15 text-terracotta", Loan: "bg-rose/20 text-rose",
    Investment: "bg-brown/15 text-brown", Account: "bg-sand/30 text-sand-dark",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[label] ?? colors.Account}`}>
      {label}
    </span>
  );
}

function InstitutionAvatar({ name }: { name: string | null | undefined }) {
  const letter = name?.[0]?.toUpperCase() ?? "?";
  const colors = ["#c47a5e", "#7a816c", "#785b4e", "#d68d84", "#8e967d"];
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: colors[letter.charCodeAt(0) % colors.length] }}>
      {letter}
    </div>
  );
}

// ── Plaid Link button ─────────────────────────────────────────────────────────

function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching]   = useState(false);

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

// ── Main view ─────────────────────────────────────────────────────────────────

export function FinancesView({ data, update }: Props) {
  const [accounts,     setAccounts]     = useState<PlaidAccount[]>([]);
  const [transactions, setTransactions] = useState<PlaidTxn[]>([]);
  const [refreshedAt,  setRefreshedAt]  = useState<string | null>(null);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [loadingTxns,  setLoadingTxns]  = useState(true);

  const [cardOpen,    setCardOpen]    = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [budgetOpen,  setBudgetOpen]  = useState(false);
  const [cardForm,    setCardForm]    = useState({ name: "", balance: 0, limit: 0, targetPayoff: "" });
  const [savingsForm, setSavingsForm] = useState({ name: "", current: 0, target: 0, deadline: "" });
  // budget draft: category key → limit string
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
      if (!j.error) setTransactions(j.transactions ?? []);
    } finally { setLoadingTxns(false); }
  }, []);

  useEffect(() => { fetchAccounts(); fetchTransactions(); }, [fetchAccounts, fetchTransactions]);

  const handleRefresh   = () => { fetchAccounts(true); fetchTransactions(true); };
  const handleConnected = () => { fetchAccounts(true); fetchTransactions(true); };

  const handleDisconnect = async (itemId: string | undefined) => {
    if (!itemId || !confirm("Remove this account connection?")) return;
    await fetch("/api/plaid/disconnect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    fetchAccounts(true);
  };

  // ── Plaid totals ───────────────────────────────────────────────────────────

  const realAccounts = accounts.filter((a) => !a.loginRequired);
  const totalCash    = realAccounts.filter((a) => a.type === "depository")
    .reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalCredit  = realAccounts.filter((a) => a.type === "credit")
    .reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const netWorth     = totalCash - totalCredit;

  // ── This-month spending ────────────────────────────────────────────────────

  const monthStart = startOfMonth(new Date());
  const thisMo     = transactions.filter(
    (t) => isAfter(parseISO(t.date), monthStart) || parseISO(t.date) >= monthStart,
  );

  const totalSpent  = thisMo.filter((t) => !INCOME_CATS.has(t.category) && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = thisMo.filter((t) => INCOME_CATS.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Actual spend per category
  const catActual = new Map<string, number>();
  for (const t of thisMo) {
    if (INCOME_CATS.has(t.category) || t.amount <= 0) continue;
    catActual.set(t.category, (catActual.get(t.category) ?? 0) + t.amount);
  }

  // Budget map from saved data
  const budgetMap = new Map(data.budgetCategories.map((b) => [b.category, b.monthlyLimit]));

  // All categories that have either spending or a budget
  const allCats = Array.from(
    new Set([...Array.from(catActual.keys()), ...Array.from(budgetMap.keys())])
  ).filter((c) => !INCOME_CATS.has(c));

  // Budget vs actual rows, sorted: over-budget first, then by spend desc
  const budgetRows = allCats.map((cat) => {
    const actual = catActual.get(cat) ?? 0;
    const limit  = budgetMap.get(cat) ?? 0;
    const diff   = limit > 0 ? actual - limit : 0; // positive = over
    const pct    = limit > 0 ? Math.min(Math.round((actual / limit) * 100), 999) : 0;
    return { cat, actual, limit, diff, pct };
  }).sort((a, b) => {
    if (a.limit > 0 && b.limit > 0) return b.diff - a.diff;
    return b.actual - a.actual;
  });

  const totalBudget    = Array.from(budgetMap.values()).reduce((s, v) => s + v, 0);
  const totalOver      = budgetRows.filter((r) => r.diff > 0).reduce((s, r) => s + r.diff, 0);
  const overBudgetCats = budgetRows.filter((r) => r.limit > 0 && r.diff > 0);
  const hasBudget      = budgetMap.size > 0;

  // Top-5 largest transactions
  const top5 = [...thisMo]
    .filter((t) => !INCOME_CATS.has(t.category) && t.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Simple chart data (for when no budget is set)
  const spendingData = Array.from(catActual.entries())
    .map(([cat, amount]) => ({ name: catLabel(cat), amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // ── Manual entries ─────────────────────────────────────────────────────────

  const addCard = () => {
    if (!cardForm.name.trim()) return;
    update((d) => ({ ...d, creditCards: [...d.creditCards, { ...cardForm, id: id() }] }));
    setCardForm({ name: "", balance: 0, limit: 0, targetPayoff: "" });
    setCardOpen(false);
  };
  const addSavings = () => {
    if (!savingsForm.name.trim()) return;
    update((d) => ({ ...d, savingsGoals: [...d.savingsGoals, { ...savingsForm, id: id() }] }));
    setSavingsForm({ name: "", current: 0, target: 0, deadline: "" });
    setSavingsOpen(false);
  };
  const updateCardBalance = (cid: string, val: number) =>
    update((d) => ({ ...d, creditCards: d.creditCards.map((c) => c.id === cid ? { ...c, balance: val } : c) }));
  const updateSavings = (gid: string, val: number) =>
    update((d) => ({ ...d, savingsGoals: d.savingsGoals.map((g) => g.id === gid ? { ...g, current: val } : g) }));

  // ── Budget modal ───────────────────────────────────────────────────────────

  const openBudgetModal = () => {
    // Pre-fill with current saved budgets + any category with spending this month
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
                  ? (acc?.balances.current ?? g.plaidLinkStartBalance)
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
          <p className="text-sand-dark mt-1 italic text-sm">Building security, one step at a time 💚</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PlaidConnectButton onConnected={handleConnected} />
          <Button variant="secondary" onClick={openBudgetModal}>
            <SlidersHorizontal size={13} className="mr-1.5 inline" />
            Set Budget
          </Button>
          <Button variant="secondary" onClick={() => setSavingsOpen(true)}>+ Savings Goal</Button>
          <Button variant="secondary" onClick={() => setCardOpen(true)}>+ Manual Card</Button>
        </div>
      </div>

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
          <div className="flex items-center justify-end gap-2">
            {refreshedAt && (
              <span className="text-[11px] text-sand-dark">Refreshed {format(parseISO(refreshedAt), "h:mm a")}</span>
            )}
            <button onClick={handleRefresh}
              className="flex items-center gap-1 text-[11px] text-sand-dark hover:text-brown transition-colors">
              <RefreshCw size={11} className={loadingAccts ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
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

              const isCreditCard = acc.type === "credit";
              const balance       = acc.balances.current ?? 0;
              const limit         = acc.balances.limit ?? 0;
              const utilPct       = isCreditCard && limit > 0 ? Math.round((balance / limit) * 100) : 0;
              const utilColor     = utilPct < 30 ? "#7a816c" : utilPct < 70 ? "#c47a5e" : "#d68d84";

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
                            <span>{utilPct}% used</span>
                            <span>limit {fmt$(limit)}</span>
                          </div>
                          <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${utilPct}%`, background: utilColor }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-serif text-lg text-brown leading-tight">{fmt$(balance)}</p>
                      {!isCreditCard && acc.balances.available != null && (
                        <p className="text-[10px] text-sand-dark">{fmt$(acc.balances.available)} available</p>
                      )}
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

      {/* ── This Month: Budget vs Actual ── */}
      {(hasActivity || loadingTxns) && (
        <Card title={`${format(new Date(), "MMMM yyyy")} · Spending`}
          subtitle={hasBudget ? undefined : "No budget set — tap Set Budget to add limits"}>

          {/* Totals row */}
          <div className="flex items-end gap-6 mt-1 mb-5">
            <div>
              <p className="font-serif text-2xl text-terracotta">{fmt$(totalSpent)}</p>
              <p className="text-xs text-sand-dark">spent this month</p>
            </div>
            {hasBudget && (
              <div>
                <p className={`font-serif text-2xl ${totalSpent > totalBudget ? "text-rose" : "text-sage"}`}>
                  {fmt$(totalBudget)}
                </p>
                <p className="text-xs text-sand-dark">monthly budget</p>
              </div>
            )}
            {totalIncome > 0 && (
              <div>
                <p className="font-serif text-2xl text-sage">{fmt$(totalIncome)}</p>
                <p className="text-xs text-sand-dark">income</p>
              </div>
            )}
          </div>

          {/* Overall budget bar */}
          {hasBudget && totalBudget > 0 && (
            <div className="mb-5">
              <div className="flex justify-between text-[11px] text-sand-dark mb-1">
                <span>{Math.round((totalSpent / totalBudget) * 100)}% of budget used</span>
                {totalOver > 0
                  ? <span className="text-rose font-medium">{fmt$(totalOver)} over</span>
                  : <span className="text-sage font-medium">{fmt$(totalBudget - totalSpent)} remaining</span>}
              </div>
              <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
                    background: totalSpent > totalBudget ? "#d68d84" : totalSpent / totalBudget > 0.8 ? "#c47a5e" : "#7a816c",
                  }} />
              </div>
            </div>
          )}

          {/* "Where it went" callout — only when over budget */}
          {overBudgetCats.length > 0 && (
            <div className="mb-5 p-3 rounded-xl bg-rose/8 border border-rose/20">
              <p className="text-xs font-semibold text-brown mb-2">Where the money went</p>
              <div className="space-y-1">
                {overBudgetCats.slice(0, 3).map((r) => (
                  <p key={r.cat} className="text-xs text-brown">
                    <span className="font-medium">{catLabel(r.cat)}</span>
                    {" "}is{" "}
                    <span className="text-rose font-medium">{fmt$(r.diff)} over</span>
                    {" "}— you spent {fmt$(r.actual)} of a {fmt$(r.limit)} budget
                  </p>
                ))}
                {overBudgetCats.length > 3 && (
                  <p className="text-xs text-sand-dark">+ {overBudgetCats.length - 3} more categories over budget</p>
                )}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {hasBudget ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-sand-dark uppercase tracking-wide">By Category</p>
              {budgetRows.map((r) => {
                const isOver    = r.limit > 0 && r.diff > 0;
                const isWarning = r.limit > 0 && r.pct >= 80 && !isOver;
                const barColor  = isOver ? "#d68d84" : isWarning ? "#c47a5e" : "#7a816c";
                const barWidth  = r.limit > 0 ? Math.min(100, r.pct) : 100;

                return (
                  <div key={r.cat}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {isOver
                          ? <TrendingUp size={11} className="text-rose flex-shrink-0" />
                          : isWarning
                            ? <Minus size={11} className="text-terracotta flex-shrink-0" />
                            : <TrendingDown size={11} className="text-sage flex-shrink-0" />}
                        <span className="text-xs text-brown">{catLabel(r.cat)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={isOver ? "text-rose font-medium" : "text-sand-dark"}>
                          {fmt$(r.actual)}
                        </span>
                        {r.limit > 0 && (
                          <span className="text-sand-dark">/ {fmt$(r.limit)}</span>
                        )}
                        {r.limit > 0 && (
                          <span className={`text-[10px] font-medium ${isOver ? "text-rose" : "text-sand-dark"}`}>
                            {isOver ? `+${fmt$(r.diff)} over` : `${fmt$(r.limit - r.actual)} left`}
                          </span>
                        )}
                      </div>
                    </div>
                    {r.limit > 0 && (
                      <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${barWidth}%`, background: barColor }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Simple chart when no budget */
            spendingData.length > 0 && (
              <div>
                <p className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-2">By Category</p>
                <ResponsiveContainer width="100%" height={spendingData.length * 36 + 10}>
                  <BarChart data={spendingData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110}
                      tick={{ fontSize: 11, fill: "#785b4e" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Spent"]}
                      contentStyle={{ background: "#f6efdf", border: "1px solid #cfbb9f", borderRadius: "12px", fontSize: "12px" }} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {spendingData.map((_, idx) => (
                        <Cell key={idx} fill={idx % 2 === 0 ? "#c47a5e" : "#7a816c"} fillOpacity={1 - idx * 0.08} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {/* Top 5 transactions */}
          {top5.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-2">Largest Transactions</p>
              <div className="space-y-1.5">
                {top5.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-sand/20 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-brown truncate">{t.name}</p>
                      <p className="text-xs text-sand-dark">{format(parseISO(t.date), "MMM d")} · {catLabel(t.category)}</p>
                    </div>
                    <p className="font-serif text-base text-terracotta flex-shrink-0">{fmt$(t.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingTxns && transactions.length === 0 && (
            <p className="text-xs text-sand-dark text-center py-4 animate-pulse">Loading transactions…</p>
          )}
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
                      style={{ width: `${pct}%`, background: pct > 70 ? "#d68d84" : pct > 30 ? "#c47a5e" : "#7a816c" }} />
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

      {/* ── Savings Goals ── */}
      {data.savingsGoals.length > 0 && (
        <Card title="Savings Goals">
          <div className="space-y-4 mt-2">
            {data.savingsGoals.map((goal) => {
              const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brown">{goal.name}</p>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={goal.current}
                        onChange={(e) => updateSavings(goal.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6" />
                      <span className="text-xs text-sage font-medium">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7a816c, #8e967d)" }} />
                  </div>
                  <div className="flex justify-between text-xs text-sand-dark">
                    <span>{fmt$(goal.current)} saved</span>
                    <span>Goal: {fmt$(goal.target)}</span>
                  </div>
                  {goal.deadline && <p className="text-xs text-terracotta">By: {goal.deadline}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Financial Goals with Plaid linking ── */}
      {financialGoals.length > 0 && (
        <Card title="Financial Goals" subtitle="From your goals tracker">
          <div className="space-y-3 mt-2">
            {financialGoals.map((g) => {
              const linkedAcc  = realAccounts.find((a) => a.accountId === g.linkedPlaidAccountId);
              const currentBal = linkedAcc?.balances.current ?? null;
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
                            <span className="text-[11px] font-medium text-brown">{fmt$(currentBal)} remaining</span>
                          </div>
                          {paydownPct != null && (
                            <>
                              <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${paydownPct}%`, background: paydownPct >= 70 ? "#7a816c" : paydownPct >= 30 ? "#c47a5e" : "#d68d84" }} />
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
                                {a.name}{a.mask ? ` ···${a.mask}` : ""} — {fmt$(a.balances.current)}
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
          {/* Show categories with spending first, then common ones not yet spent */}
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

      {/* ── Savings modal ── */}
      <Modal open={savingsOpen} onClose={() => setSavingsOpen(false)} title="Add Savings Goal">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Goal Name</label>
            <input type="text" placeholder="e.g. Emergency Fund" value={savingsForm.name}
              onChange={(e) => setSavingsForm({ ...savingsForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current ($)</label>
              <input type="number" min={0} value={savingsForm.current}
                onChange={(e) => setSavingsForm({ ...savingsForm, current: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Target ($)</label>
              <input type="number" min={0} value={savingsForm.target}
                onChange={(e) => setSavingsForm({ ...savingsForm, target: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Deadline (optional)</label>
            <input type="text" placeholder="e.g. Q3 2026" value={savingsForm.deadline}
              onChange={(e) => setSavingsForm({ ...savingsForm, deadline: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setSavingsOpen(false)}>Cancel</Button>
            <Button onClick={addSavings}>Add Goal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
