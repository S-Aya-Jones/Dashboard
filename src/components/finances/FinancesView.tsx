"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { RefreshCw, Unlink, AlertTriangle } from "lucide-react";
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

// ── Types returned by our API ─────────────────────────────────────────────────

interface PlaidAccount {
  accountId:       string;
  name:            string;
  officialName?:   string | null;
  mask?:           string | null;
  type:            string;
  subtype?:        string | null;
  balances:        { current?: number | null; available?: number | null; limit?: number | null };
  institutionName?: string | null;
  itemId?:         string;
  loginRequired?:  boolean;
}

interface PlaidTxn {
  id:              string;
  name:            string;
  amount:          number;
  date:            string;
  category:        string;
  accountId:       string;
  institutionName?: string | null;
}

// ── Category display ──────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  FOOD_AND_DRINK:           "Food & Drink",
  TRANSPORTATION:           "Transport",
  SHOPPING:                 "Shopping",
  ENTERTAINMENT:            "Entertainment",
  MEDICAL:                  "Healthcare",
  GENERAL_SERVICES:         "Services",
  HOME_IMPROVEMENT:         "Home",
  RENT_AND_UTILITIES:       "Housing",
  PERSONAL_CARE:            "Personal Care",
  GENERAL_MERCHANDISE:      "Merchandise",
  TRAVEL:                   "Travel",
  LOAN_PAYMENTS:            "Loan Payments",
  BANK_FEES:                "Bank Fees",
  INCOME:                   "Income",
  TRANSFER_IN:              "Transfer In",
  TRANSFER_OUT:             "Transfer Out",
};

function catLabel(raw: string) {
  return CAT_LABEL[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const INCOME_CATS = new Set(["INCOME", "TRANSFER_IN"]);

// ── Account helpers ───────────────────────────────────────────────────────────

function typePill(type: string, subtype?: string | null) {
  const label =
    subtype === "checking"    ? "Checking"
    : subtype === "savings"   ? "Savings"
    : subtype === "credit card" ? "Credit"
    : type   === "credit"     ? "Credit"
    : type   === "loan"       ? "Loan"
    : type   === "investment" ? "Investment"
    : "Account";

  const colors: Record<string, string> = {
    Checking:   "bg-sage/20 text-sage",
    Savings:    "bg-sage/20 text-sage",
    Credit:     "bg-terracotta/15 text-terracotta",
    Loan:       "bg-rose/20 text-rose",
    Investment: "bg-brown/15 text-brown",
    Account:    "bg-sand/30 text-sand-dark",
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
  const color  = colors[letter.charCodeAt(0) % colors.length];
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: color }}
    >
      {letter}
    </div>
  );
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Plaid Link button ─────────────────────────────────────────────────────────

function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching]   = useState(false);

  const { open, ready } = usePlaidLink({
    token:     linkToken,
    onSuccess: async (publicToken, metadata) => {
      await fetch("/api/plaid/exchange-token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ publicToken, metadata }),
      });
      onConnected();
    },
  });

  // Auto-open once the widget is ready
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  const handleClick = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const res  = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const json = await res.json();
      if (json.link_token) setLinkToken(json.link_token);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={fetching}>
      {fetching ? "Preparing…" : "+ Connect a bank"}
    </Button>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function FinancesView({ data, update }: Props) {
  const [accounts,       setAccounts]       = useState<PlaidAccount[]>([]);
  const [transactions,   setTransactions]   = useState<PlaidTxn[]>([]);
  const [refreshedAt,    setRefreshedAt]    = useState<string | null>(null);
  const [loadingAccts,   setLoadingAccts]   = useState(true);
  const [loadingTxns,    setLoadingTxns]    = useState(true);

  // Manual entries modals
  const [cardOpen,    setCardOpen]    = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [cardForm,    setCardForm]    = useState({ name: "", balance: 0, limit: 0, targetPayoff: "" });
  const [savingsForm, setSavingsForm] = useState({ name: "", current: 0, target: 0, deadline: "" });

  const fetchAccounts = useCallback(async (bust = false) => {
    setLoadingAccts(true);
    try {
      const url = bust ? "/api/plaid/accounts?refresh=1" : "/api/plaid/accounts";
      const res = await fetch(url);
      const j   = await res.json();
      if (!j.error) { setAccounts(j.accounts ?? []); setRefreshedAt(j.refreshedAt ?? null); }
    } finally { setLoadingAccts(false); }
  }, []);

  const fetchTransactions = useCallback(async (bust = false) => {
    setLoadingTxns(true);
    try {
      const url = bust ? "/api/plaid/transactions?refresh=1" : "/api/plaid/transactions";
      const res = await fetch(url);
      const j   = await res.json();
      if (!j.error) setTransactions(j.transactions ?? []);
    } finally { setLoadingTxns(false); }
  }, []);

  useEffect(() => { fetchAccounts(); fetchTransactions(); }, [fetchAccounts, fetchTransactions]);

  const handleRefresh = () => { fetchAccounts(true); fetchTransactions(true); };

  const handleDisconnect = async (itemId: string | undefined) => {
    if (!itemId || !confirm("Remove this account connection?")) return;
    await fetch("/api/plaid/disconnect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    fetchAccounts(true);
  };

  const handleConnected = () => { fetchAccounts(true); fetchTransactions(true); };

  // ── Computed Plaid totals ───────────────────────────────────────────────────

  const realAccounts = accounts.filter((a) => !a.loginRequired);
  const totalCash   = realAccounts
    .filter((a) => a.type === "depository")
    .reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalCredit = realAccounts
    .filter((a) => a.type === "credit")
    .reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const netWorth    = totalCash - totalCredit;

  // ── This-month transactions ────────────────────────────────────────────────

  const monthStart = startOfMonth(new Date());
  const thisMo     = transactions.filter((t) => isAfter(parseISO(t.date), monthStart) || parseISO(t.date) >= monthStart);

  const totalSpent  = thisMo.filter((t) => !INCOME_CATS.has(t.category) && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = thisMo.filter((t) => INCOME_CATS.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Spending by category (exclude income)
  const catMap = new Map<string, number>();
  for (const t of thisMo) {
    if (INCOME_CATS.has(t.category) || t.amount <= 0) continue;
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  }
  const spendingData = Array.from(catMap.entries())
    .map(([cat, amount]) => ({ name: catLabel(cat), amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const top5 = [...thisMo]
    .filter((t) => !INCOME_CATS.has(t.category) && t.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

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

  const hasPlaid = accounts.length > 0 || loadingAccts;

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
          <Button variant="secondary" onClick={() => setSavingsOpen(true)}>+ Savings Goal</Button>
          <Button variant="secondary" onClick={() => setCardOpen(true)}>+ Manual Card</Button>
        </div>
      </div>

      {/* ── Account Overview (Plaid) ── */}
      {(hasPlaid) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Cash",         value: totalCash,   color: "text-sage",       prefix: true },
            { label: "Total Credit Debt",   value: totalCredit, color: "text-terracotta", prefix: true },
            { label: "Net Worth",           value: netWorth,    color: netWorth >= 0 ? "text-sage" : "text-rose", prefix: true },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`font-serif text-2xl ${s.color}`}>{fmt$(s.value)}</p>
              <p className="text-xs text-sand-dark mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Connected Accounts ── */}
      {accounts.length > 0 && (
        <Card
          title="Connected Accounts"
          subtitle={
            refreshedAt
              ? `Last refreshed ${format(parseISO(refreshedAt), "h:mm a")}`
              : undefined
          }
        >
          <div className="flex justify-end mb-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-sand-dark hover:text-brown transition-colors"
            >
              <RefreshCw size={12} className={loadingAccts ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {accounts.map((acc, i) => {
              if (acc.loginRequired) {
                return (
                  <div key={acc.itemId ?? i} className="flex items-center gap-3 p-3 rounded-xl bg-rose/10 border border-rose/20">
                    <AlertTriangle size={16} className="text-rose flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brown">{acc.institutionName ?? "Bank"}</p>
                      <p className="text-xs text-rose">Reconnection needed — log in to refresh</p>
                    </div>
                    <button
                      onClick={() => handleDisconnect(acc.itemId)}
                      className="text-xs text-sand-dark hover:text-rose transition-colors"
                    >
                      Remove
                    </button>
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
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${utilPct}%`, background: utilColor }}
                            />
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

                    <button
                      onClick={() => handleDisconnect(acc.itemId)}
                      className="opacity-0 group-hover:opacity-100 ml-1 text-sand hover:text-rose transition-all flex-shrink-0"
                      title="Disconnect account"
                    >
                      <Unlink size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Empty state if no Plaid + no manual ── */}
      {!loadingAccts && accounts.length === 0 && data.creditCards.length === 0 && data.savingsGoals.length === 0 && (
        <Card>
          <div className="text-center py-10 space-y-3">
            <p className="font-serif text-2xl text-sand">Connect your accounts</p>
            <p className="text-sm text-sand-dark max-w-xs mx-auto">
              Link a bank or credit card via Plaid to see live balances and spending — or track manually with the buttons above.
            </p>
          </div>
        </Card>
      )}

      {/* ── This Month ── */}
      {(spendingData.length > 0 || top5.length > 0) && (
        <Card title={`This Month · ${format(new Date(), "MMMM yyyy")}`}>
          {/* Totals row */}
          <div className="flex gap-6 mt-1 mb-4">
            <div>
              <p className="font-serif text-xl text-terracotta">{fmt$(totalSpent)}</p>
              <p className="text-xs text-sand-dark">total spent</p>
            </div>
            {totalIncome > 0 && (
              <div>
                <p className="font-serif text-xl text-sage">{fmt$(totalIncome)}</p>
                <p className="text-xs text-sand-dark">total income</p>
              </div>
            )}
          </div>

          {/* Spending chart */}
          {spendingData.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-2">By Category</p>
              <ResponsiveContainer width="100%" height={spendingData.length * 36 + 10}>
                <BarChart data={spendingData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: "#785b4e" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Spent"]}
                    contentStyle={{ background: "#f6efdf", border: "1px solid #cfbb9f", borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {spendingData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={idx % 2 === 0 ? "#c47a5e" : "#7a816c"}
                        fillOpacity={1 - idx * 0.08}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top 5 transactions */}
          {top5.length > 0 && (
            <div>
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
                      <input
                        type="number" min={0} value={card.balance}
                        onChange={(e) => updateCardBalance(card.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6"
                      />
                    </div>
                  </div>
                  <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct > 70 ? "#d68d84" : pct > 30 ? "#c47a5e" : "#7a816c" }}
                    />
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
                      <input
                        type="number" min={0} value={goal.current}
                        onChange={(e) => updateSavings(goal.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6"
                      />
                      <span className="text-xs text-sage font-medium">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7a816c, #8e967d)" }} />
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

      {/* ── Financial Goals from data ── */}
      {data.goals.filter((g) => g.category === "financial" && !g.done).length > 0 && (
        <Card title="Financial Goals" subtitle="From your goals tracker">
          <div className="space-y-2 mt-2">
            {data.goals.filter((g) => g.category === "financial" && !g.done).map((g) => (
              <div key={g.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-cream-darker">
                <span className="text-base mt-0.5">💚</span>
                <div>
                  <p className="text-sm text-brown">{g.text}</p>
                  {g.notes && <p className="text-xs text-sand-dark italic">{g.notes}</p>}
                  {g.quarter && <p className="text-xs text-terracotta">{g.quarter}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Modals ── */}
      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="Add Manual Card">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Card Name</label>
            <input type="text" placeholder="e.g. Chase Sapphire" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current Balance ($)</label>
              <input type="number" min={0} value={cardForm.balance} onChange={(e) => setCardForm({ ...cardForm, balance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Credit Limit ($)</label>
              <input type="number" min={0} value={cardForm.limit} onChange={(e) => setCardForm({ ...cardForm, limit: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Target payoff (optional)</label>
            <input type="text" placeholder="e.g. December 2025" value={cardForm.targetPayoff} onChange={(e) => setCardForm({ ...cardForm, targetPayoff: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={addCard}>Add Card</Button>
          </div>
        </div>
      </Modal>

      <Modal open={savingsOpen} onClose={() => setSavingsOpen(false)} title="Add Savings Goal">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Goal Name</label>
            <input type="text" placeholder="e.g. Emergency Fund" value={savingsForm.name} onChange={(e) => setSavingsForm({ ...savingsForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current ($)</label>
              <input type="number" min={0} value={savingsForm.current} onChange={(e) => setSavingsForm({ ...savingsForm, current: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Target ($)</label>
              <input type="number" min={0} value={savingsForm.target} onChange={(e) => setSavingsForm({ ...savingsForm, target: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Deadline (optional)</label>
            <input type="text" placeholder="e.g. Q3 2026" value={savingsForm.deadline} onChange={(e) => setSavingsForm({ ...savingsForm, deadline: e.target.value })} />
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
