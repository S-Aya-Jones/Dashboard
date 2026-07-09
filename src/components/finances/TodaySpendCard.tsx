"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Send, X, AlertCircle } from "lucide-react";
import { BaseBudgetItem } from "@/types/dashboard";

interface Txn {
  id: string; name: string; amount: number; date: string;
  mappedCategory: string; accountName: string;
}

interface Alert {
  category: string; spent: number; limit: number; pct: number;
}

interface TodayData {
  transactions: Txn[];
  spendByCategory: Record<string, number>;
  alerts: Alert[];
  date: string;
}

const LIME = "#7C5CFC";
const MUTED = "var(--text-muted)";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const CARD = "var(--surface)";
const BORDER = "var(--border)";

function fmt$(n: number) { return `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    "Eating Out": "#FB923C", Groceries: "#10B981", Gas: "#F59E0B",
    "Fun / Entertainment": "#E879F9", "Self-Care": "#EC4899", Health: "#EF4444",
    Housing: "#7C5CFC", Shopping: "#F472B6", Travel: "#0EA5E9",
    Subscriptions: "#6366F1", Other: "#94A3B8",
  };
  return map[cat] ?? "#94A3B8";
}

export function TodaySpendCard({ baseBudget }: { baseBudget: BaseBudgetItem[] }) {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flaggedTxn, setFlaggedTxn] = useState<Txn | null>(null);
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/plaid/today");
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function flagTxn(txn: Txn) {
    setFlaggedTxn(txn);
    setDraft(""); setSent(false); setDraftLoading(true);
    const budget = baseBudget.find(b => b.category === txn.mappedCategory);
    try {
      const res = await fetch("/api/plaid/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txnName: txn.name, txnAmount: txn.amount,
          category: txn.mappedCategory,
          budgetedMonthly: budget?.monthlyLimit ?? null,
        }),
      });
      const d = await res.json();
      setDraft(d.draft ?? "");
    } catch { setDraft(`$${txn.amount} at ${txn.name} — was this planned?`); }
    finally { setDraftLoading(false); }
  }

  async function sendDraft() {
    if (!draft) return;
    setSending(true);
    try {
      await fetch("/api/plaid/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", draft }),
      });
      setSent(true);
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  const todayTotal = Object.values(data?.spendByCategory ?? {}).reduce((s, v) => s + v, 0);
  const highAlerts = (data?.alerts ?? []).filter(a => a.pct >= 80);
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="mb-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-left" style={{ color: MUTED, letterSpacing: "0.08em" }}>
            TODAY&apos;S SPENDING · {today.toUpperCase()}
          </p>
          <p className="text-xs mt-0.5 text-left" style={{ color: "var(--text-light)" }}>
            {data ? `${fmt$(todayTotal)} spent · ${data.transactions.length} transactions` : "Live from Plaid"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {highAlerts.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(239,68,68,0.1)", color: RED }}>
              <AlertCircle size={10} /> {highAlerts.length}
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); load(); }} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} style={{ color: MUTED }} />
          </button>
          <span style={{ color: MUTED, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <>
          {error && (
            <div className="rounded-2xl px-4 py-3 mb-3 text-sm" style={{ background: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.15)`, color: RED }}>
              Could not load transactions — check Plaid connection.
            </div>
          )}

          {loading && !data && (
            <div className="rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="w-4 h-4 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
              <p className="text-xs" style={{ color: MUTED }}>Loading today&apos;s transactions…</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Budget category bars */}
              {(data.alerts.length > 0 || Object.keys(data.spendByCategory).length > 0) && (
                <div className="rounded-2xl overflow-hidden mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {data.alerts.map((alert, i) => {
                    const color = alert.limit === 0 ? MUTED : alert.pct >= 100 ? RED : alert.pct >= 80 ? AMBER : LIME;
                    const barPct = alert.limit === 0 ? 100 : Math.min(100, alert.pct);
                    const dailyLimit = alert.limit > 0 ? Math.round(alert.limit / 30) : null;
                    return (
                      <div key={alert.category} className="px-4 py-3"
                        style={{ borderBottom: i < data.alerts.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: getCategoryColor(alert.category) }} />
                            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{alert.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color }}>{fmt$(alert.spent)}</span>
                            {dailyLimit && <span className="text-xs" style={{ color: MUTED }}>/ {fmt$(dailyLimit)} daily</span>}
                            {alert.limit === 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(148,163,184,0.1)", color: MUTED }}>no budget</span>}
                          </div>
                        </div>
                        {alert.limit > 0 && (
                          <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.08)" }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Transaction list */}
              {data.transactions.length === 0 ? (
                <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
                  <p className="text-sm" style={{ color: MUTED }}>No transactions today yet</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {data.transactions.map((txn, i) => {
                    const budget = baseBudget.find(b => b.category === txn.mappedCategory);
                    const daily = budget ? Math.round(budget.monthlyLimit / 30) : null;
                    const isOver = daily && txn.amount > daily;
                    return (
                      <div key={txn.id} className="flex items-center justify-between px-4 py-3 gap-3"
                        style={{ borderBottom: i < data.transactions.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: getCategoryColor(txn.mappedCategory) }} />
                            <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{txn.name}</p>
                            {isOver && <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "rgba(239,68,68,0.08)", color: RED }}>over daily</span>}
                          </div>
                          <p className="text-xs ml-4" style={{ color: MUTED }}>{txn.mappedCategory} · {txn.accountName}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{fmt$(txn.amount)}</span>
                          <button onClick={() => flagTxn(txn)}
                            className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                            style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>
                            Ask
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Draft message panel */}
              {flaggedTxn && (
                <div className="rounded-2xl p-4 mt-3" style={{ background: "rgba(124,92,252,0.04)", border: `1px solid rgba(124,92,252,0.15)` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.06em" }}>
                      DRAFT MESSAGE · {flaggedTxn.name}
                    </p>
                    <button onClick={() => { setFlaggedTxn(null); setDraft(""); setSent(false); }}>
                      <X size={13} style={{ color: MUTED }} />
                    </button>
                  </div>
                  {draftLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-3 h-3 border rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
                      <span className="text-xs" style={{ color: MUTED }}>Drafting message…</span>
                    </div>
                  ) : sent ? (
                    <p className="text-sm font-semibold py-1" style={{ color: LIME }}>Sent ✓</p>
                  ) : (
                    <>
                      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-3"
                        style={{ background: CARD, border: `1px solid ${BORDER}`, color: "var(--text)" }} />
                      <button onClick={sendDraft} disabled={sending || !draft}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                        style={{ background: LIME, color: "#fff" }}>
                        <Send size={13} />
                        {sending ? "Sending…" : "Send to myself"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
