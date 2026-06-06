"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, Plus, Trash2, TrendingUp, Target, Wallet, Calendar } from "lucide-react";
import { DashboardData, BudgetCategory, SinkingFund, AffordGoal, MerchantCategoryOverride } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { parseISO, startOfMonth, isAfter } from "date-fns";

const LIME   = "#C8FF00";
const BG     = "#0A0A0A";
const CARD   = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = "rgba(255,255,255,0.4)";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

interface PlaidAccount {
  accountId: string; name: string; mask?: string | null; type: string; subtype?: string | null;
  balances: { current?: number | null; available?: number | null; limit?: number | null };
  institutionName?: string | null; itemId?: string; loginRequired?: boolean;
}
interface PlaidTxn {
  id: string; name: string; amount: number; date: string; category: string;
  accountId: string; isInternalTransfer: boolean; transferPairId: string | null; itemId: string;
}

const CAT_LABEL: Record<string, string> = {
  FOOD_AND_DRINK: "Eating Out", GROCERIES: "Groceries", TRANSPORTATION: "Transport",
  SHOPPING: "Shopping", ENTERTAINMENT: "Entertainment", MEDICAL: "Healthcare",
  GENERAL_SERVICES: "Services", HOME_IMPROVEMENT: "Home", RENT_AND_UTILITIES: "Housing",
  PERSONAL_CARE: "Personal Care", GENERAL_MERCHANDISE: "Merchandise", TRAVEL: "Travel",
  LOAN_PAYMENTS: "Loan Payments", BANK_FEES: "Bank Fees", RECREATION: "Recreation",
  INSURANCE: "Insurance", EDUCATION: "Education",
};
const CAT_EMOJI: Record<string, string> = {
  FOOD_AND_DRINK: "🍽️", GROCERIES: "🛒", TRANSPORTATION: "🚗", SHOPPING: "🛍️",
  ENTERTAINMENT: "🎬", MEDICAL: "💊", GENERAL_SERVICES: "🔧", HOME_IMPROVEMENT: "🏠",
  RENT_AND_UTILITIES: "⚡", PERSONAL_CARE: "✨", GENERAL_MERCHANDISE: "📦",
  TRAVEL: "✈️", LOAN_PAYMENTS: "💳", BANK_FEES: "🏦", RECREATION: "🎾",
  INSURANCE: "🛡️", EDUCATION: "📚",
};
const INCOME_CATS = new Set(["INCOME", "TRANSFER_IN"]);
const DEFAULT_FC = {
  bigTicketThreshold: 100, watchListMerchants: [], bigMoves: [],
  recurringHidden: [] as string[], recurringFlagged: [] as string[],
  merchantCategoryOverrides: [] as MerchantCategoryOverride[],
};

const CAT_COLORS = ["#C8FF00","#DA667B","#71816D","#C9B79C","#8A9E87","#A8967E","#6B8CAE","#E8A87C","#9B89B4","#5BAD92"];

function fmt$(n: number) { return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function catLabel(c: string) { return CAT_LABEL[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()); }

// ── Plaid Connect ─────────────────────────────────────────────────────────────
function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess: async (pt, meta) => {
    await fetch("/api/plaid/exchange-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicToken: pt, metadata: meta }) });
    onConnected();
  }});
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);
  const handleClick = async () => {
    if (fetching) return; setFetching(true);
    try { const r = await fetch("/api/plaid/create-link-token", { method: "POST" }); const j = await r.json(); if (j.link_token) setLinkToken(j.link_token); } finally { setFetching(false); }
  };
  return (
    <button onClick={handleClick} disabled={fetching}
      className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
      style={{ background: LIME, color: "#000" }}>
      {fetching ? "Preparing…" : "+ Connect Bank Account"}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function FinancesView({ data, update }: Props) {
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [transactions, setTransactions] = useState<PlaidTxn[]>([]);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"overview" | "spending" | "planning" | "accounts">("overview");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchAccounts = useCallback(async (bust = false) => {
    setLoadingAccts(true);
    try { const r = await fetch(bust ? "/api/plaid/accounts?refresh=1" : "/api/plaid/accounts"); const j = await r.json(); if (!j.error) setAccounts(j.accounts ?? []); } finally { setLoadingAccts(false); }
  }, []);

  const fetchTransactions = useCallback(async (bust = false) => {
    setLoadingTxns(true);
    try { const r = await fetch(bust ? "/api/plaid/transactions?refresh=1" : "/api/plaid/transactions"); const j = await r.json(); if (!j.error) setTransactions(j.transactions ?? []); } finally { setLoadingTxns(false); }
  }, []);

  useEffect(() => { fetchAccounts(); fetchTransactions(); }, [fetchAccounts, fetchTransactions]);

  const handleRefresh = async () => {
    if (refreshing) return; setRefreshing(true);
    try { await fetch("/api/plaid/refresh", { method: "POST" }); await new Promise(r => setTimeout(r, 3000)); await Promise.all([fetchAccounts(true), fetchTransactions(true)]); } finally { setRefreshing(false); }
  };

  const handleDisconnect = async (itemId?: string) => {
    if (!itemId || !confirm("Remove this account connection?")) return;
    await fetch("/api/plaid/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    fetchAccounts(true);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const fc = { ...DEFAULT_FC, ...(data.financesConfig ?? {}), merchantCategoryOverrides: data.financesConfig?.merchantCategoryOverrides ?? [] };
  const resolvedCat = (t: PlaidTxn) => {
    for (const o of fc.merchantCategoryOverrides) if (t.name.toLowerCase().includes(o.nameContains.toLowerCase())) return o.category;
    return t.category;
  };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const thisMonthTxns = transactions.filter(t =>
    !t.isInternalTransfer && !INCOME_CATS.has(resolvedCat(t)) && t.amount > 0 && isAfter(parseISO(t.date), monthStart)
  );
  const totalSpentThisMonth = thisMonthTxns.reduce((s, t) => s + t.amount, 0);

  const thisMonthIncome = transactions.filter(t =>
    INCOME_CATS.has(resolvedCat(t)) && t.amount < 0 && isAfter(parseISO(t.date), monthStart)
  ).reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyIncome = data.monthlyIncome ?? (thisMonthIncome > 0 ? thisMonthIncome : 0);

  // Category breakdown this month
  const catSpend: Record<string, number> = {};
  for (const t of thisMonthTxns) {
    const c = resolvedCat(t);
    catSpend[c] = (catSpend[c] ?? 0) + t.amount;
  }
  const sortedCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]);

  const totalBudget = (data.budgetCategories ?? []).reduce((s, b) => s + b.monthlyLimit, 0);
  const budgetPct = totalBudget > 0 ? Math.min((totalSpentThisMonth / totalBudget) * 100, 100) : 0;

  // Spending grade
  const expectedSpendByNow = totalBudget > 0 ? (totalBudget * dayOfMonth) / daysInMonth : 0;
  const gradeRatio = expectedSpendByNow > 0 ? totalSpentThisMonth / expectedSpendByNow : 0;
  const grade = gradeRatio <= 0.75 ? "A" : gradeRatio <= 0.9 ? "B" : gradeRatio <= 1.0 ? "C" : gradeRatio <= 1.15 ? "D" : "F";
  const gradeColor = grade === "A" ? LIME : grade === "B" ? "#8A9E87" : grade === "C" ? "#C9B79C" : grade === "D" ? "#E8A87C" : "#DA667B";

  // Account totals
  const realAccounts = accounts.filter(a => !a.loginRequired);
  const totalCash = realAccounts.filter(a => a.type === "depository").reduce((s, a) => s + (a.balances.available ?? a.balances.current ?? 0), 0);
  const totalDebt = realAccounts.filter(a => a.type === "credit").reduce((s, a) => {
    const lim = a.balances.limit ?? 0; const avail = a.balances.available;
    return s + (avail != null && lim > 0 ? lim - avail : a.balances.current ?? 0);
  }, 0);

  const monthlySavings = monthlyIncome - totalSpentThisMonth;
  const sinkingFunds = data.sinkingFunds ?? [];
  const affordGoals = data.affordGoals ?? [];

  const TABS = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "spending", label: "Spending", icon: Wallet },
    { key: "planning", label: "Planning", icon: Target },
    { key: "accounts", label: "Accounts", icon: Calendar },
  ] as const;

  return (
    <div style={{ background: BG, minHeight: "100%", color: "#fff", fontFamily: "inherit" }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Finances</h1>
            <p className="text-sm" style={{ color: MUTED }}>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}` }}>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} style={{ color: MUTED }} />
          </button>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Spent this month", value: fmt$(totalSpentThisMonth), sub: totalBudget > 0 ? `of ${fmt$(totalBudget)} budget` : "no budget set", color: budgetPct > 90 ? "#DA667B" : LIME },
            { label: "Cash on hand", value: fmt$(totalCash), sub: totalDebt > 0 ? `${fmt$(totalDebt)} in debt` : "no debt tracked", color: "rgba(255,255,255,0.9)" },
            { label: "Spending grade", value: grade, sub: `Day ${dayOfMonth} of ${daysInMonth}`, color: gradeColor },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-xs mb-2" style={{ color: MUTED }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={tab === key ? { background: LIME, color: "#000" } : { color: MUTED }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 pb-8">

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Budget progress bar */}
            {totalBudget > 0 && (
              <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-medium text-white">Monthly Budget</p>
                  <p className="text-sm font-bold" style={{ color: budgetPct > 90 ? "#DA667B" : LIME }}>{Math.round(budgetPct)}%</p>
                </div>
                <div className="rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)", height: 8 }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${budgetPct}%`, background: budgetPct > 90 ? "#DA667B" : budgetPct > 75 ? "#C9B79C" : LIME }} />
                </div>
                <div className="flex justify-between mt-2 text-xs" style={{ color: MUTED }}>
                  <span>{fmt$(totalSpentThisMonth)} spent</span>
                  <span>{fmt$(Math.max(0, totalBudget - totalSpentThisMonth))} left</span>
                </div>
              </div>
            )}

            {/* Top categories */}
            {sortedCats.length > 0 ? (
              <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-sm font-medium text-white mb-4">Where your money went</p>
                <div className="space-y-3">
                  {sortedCats.slice(0, 7).map(([cat, amt], i) => {
                    const pct = totalSpentThisMonth > 0 ? (amt / totalSpentThisMonth) * 100 : 0;
                    const color = CAT_COLORS[i % CAT_COLORS.length];
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{CAT_EMOJI[cat] ?? "💰"}</span>
                            <span className="text-sm text-white">{catLabel(cat)}</span>
                          </div>
                          <span className="text-sm font-semibold" style={{ color }}>{fmt$(amt)}</span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", height: 5 }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-sm" style={{ color: MUTED }}>No transactions yet — connect a bank in Accounts</p>
              </div>
            )}

            {/* Income input */}
            <IncomeCard monthlyIncome={data.monthlyIncome} monthlySavings={monthlySavings} onSave={(v) => update(d => ({ ...d, monthlyIncome: v }))} />
          </div>
        )}

        {/* ── SPENDING ─────────────────────────────────────────────────── */}
        {tab === "spending" && (
          <SpendingTab
            catSpend={catSpend}
            budgetCategories={data.budgetCategories ?? []}
            recentTxns={thisMonthTxns.slice(0, 30)}
            onUpdateBudgets={(cats) => update(d => ({ ...d, budgetCategories: cats }))}
          />
        )}

        {/* ── PLANNING ─────────────────────────────────────────────────── */}
        {tab === "planning" && (
          <PlanningTab
            sinkingFunds={sinkingFunds}
            affordGoals={affordGoals}
            monthlyIncome={monthlyIncome}
            totalSpentThisMonth={totalSpentThisMonth}
            onUpdateFunds={(funds) => update(d => ({ ...d, sinkingFunds: funds }))}
            onUpdateGoals={(goals) => update(d => ({ ...d, affordGoals: goals }))}
            showToast={showToast}
          />
        )}

        {/* ── ACCOUNTS ─────────────────────────────────────────────────── */}
        {tab === "accounts" && (
          <AccountsTab
            accounts={accounts}
            loadingAccts={loadingAccts}
            loadingTxns={loadingTxns}
            onRefresh={handleRefresh}
            onDisconnect={handleDisconnect}
            onConnected={() => { fetchAccounts(true); fetchTransactions(true); }}
            refreshing={refreshing}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none z-50"
          style={{ background: "rgba(200,255,0,0.15)", color: LIME, border: `1px solid rgba(200,255,0,0.3)` }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Income Card ───────────────────────────────────────────────────────────────
function IncomeCard({ monthlyIncome, monthlySavings, onSave }: { monthlyIncome?: number; monthlySavings: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(monthlyIncome ?? ""));
  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-medium text-white mb-3">Monthly Income</p>
      {editing ? (
        <div className="flex gap-2">
          <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. 3500"
            className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
          <button onClick={() => { onSave(parseFloat(val) || 0); setEditing(false); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-white">{monthlyIncome ? `$${monthlyIncome.toLocaleString()}` : "—"}</p>
            {monthlyIncome != null && (
              <p className="text-xs mt-1" style={{ color: monthlySavings >= 0 ? LIME : "#DA667B" }}>
                {monthlySavings >= 0 ? `+$${Math.round(monthlySavings).toLocaleString()} saved this month` : `$${Math.abs(Math.round(monthlySavings)).toLocaleString()} over budget`}
              </p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
        </div>
      )}
    </div>
  );
}

// ── Spending Tab ──────────────────────────────────────────────────────────────
function SpendingTab({ catSpend, budgetCategories, recentTxns, onUpdateBudgets }: {
  catSpend: Record<string, number>; budgetCategories: BudgetCategory[];
  recentTxns: { id: string; name: string; amount: number; date: string; category: string }[];
  onUpdateBudgets: (c: BudgetCategory[]) => void;
}) {
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [limitVal, setLimitVal] = useState("");
  const [showTxns, setShowTxns] = useState(false);

  const allCats = Array.from(new Set([...Object.keys(catSpend), ...budgetCategories.map(b => b.category)]));
  const getLimit = (cat: string) => budgetCategories.find(b => b.category === cat)?.monthlyLimit ?? 0;
  const setLimit = (cat: string, limit: number) => {
    const existing = budgetCategories.filter(b => b.category !== cat);
    onUpdateBudgets(limit > 0 ? [...existing, { category: cat, monthlyLimit: limit }] : existing);
  };

  return (
    <div className="space-y-4">
      {allCats.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>No spending data — connect a bank in Accounts</p>
        </div>
      )}

      {allCats.map((cat, i) => {
        const spent = catSpend[cat] ?? 0;
        const limit = getLimit(cat);
        const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const over = limit > 0 && spent > limit;
        const color = CAT_COLORS[i % CAT_COLORS.length];
        const isEditing = editingCat === cat;

        return (
          <div key={cat} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${over ? "rgba(218,102,123,0.4)" : BORDER}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{CAT_EMOJI[cat] ?? "💰"}</span>
                <div>
                  <p className="text-sm font-medium text-white">{catLabel(cat)}</p>
                  {limit > 0 && <p className="text-xs" style={{ color: over ? "#DA667B" : MUTED }}>{over ? `$${Math.round(spent - limit)} over budget` : `$${Math.round(limit - spent)} left`}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold" style={{ color: over ? "#DA667B" : "#fff" }}>${Math.round(spent).toLocaleString()}</p>
                <button onClick={() => { setEditingCat(isEditing ? null : cat); setLimitVal(String(limit || "")); }}
                  className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>
                  {limit > 0 ? `/ $${limit.toLocaleString()}` : "+ limit"}
                </button>
              </div>
            </div>

            {limit > 0 && (
              <div className="rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)", height: 6 }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? "#DA667B" : color }} />
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2 mt-3">
                <input type="number" value={limitVal} onChange={e => setLimitVal(e.target.value)} placeholder="Monthly limit"
                  className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <button onClick={() => { setLimit(cat, parseFloat(limitVal) || 0); setEditingCat(null); }}
                  className="px-4 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                {limit > 0 && <button onClick={() => { setLimit(cat, 0); setEditingCat(null); }}
                  className="px-3 rounded-xl" style={{ background: "rgba(218,102,123,0.15)", color: "#DA667B" }}>Remove</button>}
              </div>
            )}
          </div>
        );
      })}

      {/* Recent transactions toggle */}
      {recentTxns.length > 0 && (
        <div>
          <button onClick={() => setShowTxns(!showTxns)}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: MUTED }}>
            {showTxns ? "Hide" : "Show"} recent transactions ({recentTxns.length})
          </button>
          {showTxns && (
            <div className="mt-3 rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {recentTxns.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: i < recentTxns.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div>
                    <p className="text-sm text-white truncate" style={{ maxWidth: 220 }}>{t.name}</p>
                    <p className="text-xs" style={{ color: MUTED }}>{t.date} · {catLabel(t.category)}</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#DA667B" }}>${t.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Planning Tab ──────────────────────────────────────────────────────────────
function PlanningTab({ sinkingFunds, affordGoals, monthlyIncome, totalSpentThisMonth, onUpdateFunds, onUpdateGoals, showToast }: {
  sinkingFunds: SinkingFund[]; affordGoals: AffordGoal[];
  monthlyIncome: number; totalSpentThisMonth: number;
  onUpdateFunds: (f: SinkingFund[]) => void; onUpdateGoals: (g: AffordGoal[]) => void;
  showToast: (m: string) => void;
}) {
  const monthlySavings = monthlyIncome > 0 ? monthlyIncome - totalSpentThisMonth : 0;

  // Afford-by state
  const [affordName, setAffordName] = useState("");
  const [affordPrice, setAffordPrice] = useState("");
  const [affordSaved, setAffordSaved] = useState("");

  // Sinking fund state
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundName, setFundName] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundFreq, setFundFreq] = useState("3");

  const addAffordGoal = () => {
    if (!affordName || !affordPrice) return;
    const price = parseFloat(affordPrice);
    const saved = parseFloat(affordSaved) || 0;
    onUpdateGoals([...affordGoals, { id: id(), name: affordName, price, savedSoFar: saved, createdAt: new Date().toISOString() }]);
    setAffordName(""); setAffordPrice(""); setAffordSaved("");
    showToast("Goal added!");
  };

  const removeAffordGoal = (gid: string) => onUpdateGoals(affordGoals.filter(g => g.id !== gid));

  const addFund = () => {
    if (!fundName || !fundAmount) return;
    const newFund: SinkingFund = { id: id(), name: fundName, targetAmount: parseFloat(fundAmount), frequencyMonths: parseInt(fundFreq), saved: 0, color: CAT_COLORS[sinkingFunds.length % CAT_COLORS.length] };
    onUpdateFunds([...sinkingFunds, newFund]);
    setFundName(""); setFundAmount(""); setFundFreq("3"); setShowFundForm(false);
    showToast("Sinking fund added!");
  };

  const updateFundSaved = (fid: string, saved: number) => onUpdateFunds(sinkingFunds.map(f => f.id === fid ? { ...f, saved } : f));
  const removeFund = (fid: string) => onUpdateFunds(sinkingFunds.filter(f => f.id !== fid));

  function affordByDate(price: number, saved: number, monthlySav: number): { months: number; date: string } | null {
    const remaining = price - saved;
    if (remaining <= 0) return { months: 0, date: "Now!" };
    if (monthlySav <= 0) return null;
    const months = Math.ceil(remaining / monthlySav);
    const d = new Date(); d.setMonth(d.getMonth() + months);
    return { months, date: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }

  const totalSinkingPerMonth = sinkingFunds.reduce((s, f) => s + f.targetAmount / f.frequencyMonths, 0);

  return (
    <div className="space-y-5">

      {/* Savings summary */}
      {monthlyIncome > 0 && (
        <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-medium text-white mb-3">Your savings power</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1" style={{ color: MUTED }}>Available to save / mo</p>
              <p className="text-xl font-bold" style={{ color: monthlySavings > 0 ? LIME : "#DA667B" }}>
                {monthlySavings > 0 ? `$${Math.round(monthlySavings).toLocaleString()}` : "Over budget"}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: MUTED }}>Committed to sinking funds</p>
              <p className="text-xl font-bold text-white">${Math.round(totalSinkingPerMonth).toLocaleString()}<span className="text-sm font-normal" style={{ color: MUTED }}>/mo</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Afford-by calculator ── */}
      <div>
        <p className="text-sm font-semibold text-white mb-3">When can I afford this?</p>

        {/* Add goal form */}
        <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="space-y-2 mb-3">
            <input value={affordName} onChange={e => setAffordName(e.target.value)} placeholder="What do you want? (e.g. MacBook, vacation)"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={affordPrice} onChange={e => setAffordPrice(e.target.value)} placeholder="Total price ($)"
                className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <input type="number" value={affordSaved} onChange={e => setAffordSaved(e.target.value)} placeholder="Saved so far ($)"
                className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
          </div>
          <button onClick={addAffordGoal} disabled={!affordName || !affordPrice}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: LIME, color: "#000" }}>
            Calculate
          </button>
        </div>

        {/* Goal cards */}
        {affordGoals.map(g => {
          const result = affordByDate(g.price, g.savedSoFar, monthlySavings);
          const pct = Math.min((g.savedSoFar / g.price) * 100, 100);
          return (
            <div key={g.id} className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{g.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>${g.price.toLocaleString()} total · ${g.savedSoFar.toLocaleString()} saved</p>
                </div>
                <button onClick={() => removeAffordGoal(g.id)}><Trash2 size={14} style={{ color: MUTED }} /></button>
              </div>
              <div className="rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)", height: 6 }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LIME }} />
              </div>
              {result ? (
                <div className="rounded-xl p-3" style={{ background: result.months === 0 ? "rgba(200,255,0,0.08)" : "rgba(255,255,255,0.04)" }}>
                  {result.months === 0 ? (
                    <p className="text-sm font-bold" style={{ color: LIME }}>You can afford this now! 🎉</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-white">{result.date}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{result.months} month{result.months !== 1 ? "s" : ""} away at ${Math.round(monthlySavings).toLocaleString()}/mo savings</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl p-3" style={{ background: "rgba(218,102,123,0.08)" }}>
                  <p className="text-sm" style={{ color: "#DA667B" }}>Set your monthly income above to calculate a date</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Sinking Funds ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Sinking Funds</p>
          <button onClick={() => setShowFundForm(!showFundForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Add fund
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: MUTED }}>Save a little each month for things you buy every few months — car maintenance, haircuts, clothes, etc.</p>

        {showFundForm && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <input value={fundName} onChange={e => setFundName(e.target.value)} placeholder="What is it? (e.g. Car maintenance)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} placeholder="Cost when due ($)"
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <select value={fundFreq} onChange={e => setFundFreq(e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                  <option value="1">Monthly</option>
                  <option value="2">Every 2 months</option>
                  <option value="3">Quarterly</option>
                  <option value="4">Every 4 months</option>
                  <option value="6">Every 6 months</option>
                  <option value="12">Yearly</option>
                </select>
              </div>
            </div>
            {fundAmount && (
              <p className="text-xs mb-3" style={{ color: LIME }}>
                Save ${Math.ceil(parseFloat(fundAmount) / parseInt(fundFreq)).toLocaleString()}/month
              </p>
            )}
            <button onClick={addFund} disabled={!fundName || !fundAmount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>Create Fund</button>
          </div>
        )}

        {sinkingFunds.map(f => {
          const perMonth = f.targetAmount / f.frequencyMonths;
          const pct = Math.min((f.saved / f.targetAmount) * 100, 100);
          const monthsLeft = perMonth > 0 ? Math.ceil((f.targetAmount - f.saved) / perMonth) : 0;
          return (
            <div key={f.id} className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{f.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    ${Math.ceil(perMonth).toLocaleString()}/mo · ${f.targetAmount.toLocaleString()} every {f.frequencyMonths === 1 ? "month" : f.frequencyMonths === 12 ? "year" : `${f.frequencyMonths} months`}
                  </p>
                </div>
                <button onClick={() => removeFund(f.id)}><Trash2 size={14} style={{ color: MUTED }} /></button>
              </div>
              <div className="rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)", height: 6 }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: f.color ?? LIME }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: MUTED }}>${f.saved.toLocaleString()} of ${f.targetAmount.toLocaleString()} · {monthsLeft > 0 ? `${monthsLeft} mo left` : "Ready!"}</p>
                <div className="flex gap-2">
                  <button onClick={() => updateFundSaved(f.id, Math.max(0, f.saved - Math.ceil(perMonth)))}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>−</button>
                  <button onClick={() => updateFundSaved(f.id, Math.min(f.targetAmount, f.saved + Math.ceil(perMonth)))}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(200,255,0,0.1)", color: LIME }}>+{Math.ceil(perMonth)}</button>
                </div>
              </div>
            </div>
          );
        })}

        {sinkingFunds.length === 0 && !showFundForm && (
          <div className="rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>No sinking funds yet. Add your first one — haircut every 6 weeks, car oil change quarterly, etc.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accounts Tab ──────────────────────────────────────────────────────────────
function AccountsTab({ accounts, loadingAccts, loadingTxns, onRefresh, onDisconnect, onConnected, refreshing }: {
  accounts: PlaidAccount[]; loadingAccts: boolean; loadingTxns: boolean;
  onRefresh: () => void; onDisconnect: (itemId?: string) => void;
  onConnected: () => void; refreshing: boolean;
}) {
  const byInstitution: Record<string, PlaidAccount[]> = {};
  for (const a of accounts) {
    const key = a.institutionName ?? "Unknown Bank";
    if (!byInstitution[key]) byInstitution[key] = [];
    byInstitution[key].push(a);
  }
  const loading = loadingAccts || loadingTxns;

  return (
    <div className="space-y-4">
      {loading && accounts.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: MUTED }}>Loading accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>Connect your bank to automatically track transactions and spending.</p>
          <PlaidConnectButton onConnected={onConnected} />
        </div>
      ) : (
        <>
          {Object.entries(byInstitution).map(([inst, accts]) => (
            <div key={inst} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <p className="text-sm font-semibold text-white">{inst}</p>
                <button onClick={() => onDisconnect(accts[0].itemId)} className="p-1.5 rounded-lg" style={{ background: "rgba(218,102,123,0.1)" }}>
                  <Unlink size={12} style={{ color: "#DA667B" }} />
                </button>
              </div>
              {accts.map((a, i) => {
                const bal = a.type === "credit"
                  ? ((a.balances.limit ?? 0) - (a.balances.available ?? 0))
                  : (a.balances.available ?? a.balances.current ?? 0);
                return (
                  <div key={a.accountId} className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: i < accts.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                    <div>
                      <p className="text-sm text-white">{a.name}{a.mask ? ` ···${a.mask}` : ""}</p>
                      <p className="text-xs capitalize" style={{ color: MUTED }}>{a.subtype ?? a.type}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: a.type === "credit" ? "#DA667B" : LIME }}>
                      {a.type === "credit" ? "-" : ""}${Math.abs(bal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={onRefresh} disabled={refreshing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: MUTED }}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <div className="flex-1"><PlaidConnectButton onConnected={onConnected} /></div>
          </div>
        </>
      )}
    </div>
  );
}
