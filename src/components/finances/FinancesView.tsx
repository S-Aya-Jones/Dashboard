"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, Plus, Trash2, Check } from "lucide-react";
import { DashboardData, PaycheckConfig, SelfCareItem, RecurringBill } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { parseISO, format, addDays, differenceInDays } from "date-fns";

const LIME   = "#C8FF00";
const BG     = "#0A0A0A";
const CARD   = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = "rgba(255,255,255,0.4)";
const RED    = "#DA667B";
const COLORS = ["#C8FF00","#DA667B","#71816D","#C9B79C","#8A9E87","#A8967E","#6B8CAE","#E8A87C"];

const DEFAULT_CARE: Omit<SelfCareItem, "id">[] = [
  { name: "Hair",           emoji: "💇🏾‍♀️", cost: 150, frequencyWeeks: 12, color: COLORS[0] },
  { name: "Nails",          emoji: "💅🏾",   cost: 50,  frequencyWeeks: 3,  color: COLORS[1] },
  { name: "Facial / Skin",  emoji: "🧖🏾‍♀️", cost: 80,  frequencyWeeks: 6,  color: COLORS[2] },
];

function fmt$(n: number) { return `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function fmtDate(d: Date) { return format(d, "MMM d"); }
function ordinal(n: number) { const s = ["th","st","nd","rd"]; const v = n % 100; return s[(v-20)%10] || s[v] || s[0]; }
function nextDue(item: SelfCareItem): Date {
  if (!item.lastDone) return new Date();
  return addDays(parseISO(item.lastDone), item.frequencyWeeks * 7);
}
function daysUntil(d: Date) { return differenceInDays(d, new Date()); }
function perCheck(item: SelfCareItem) { return Math.ceil((item.cost / item.frequencyWeeks) * 2); }

function dueBillsInPeriod(bills: RecurringBill[], payday: Date): RecurringBill[] {
  const end = addDays(payday, 13);
  return bills.filter(b => {
    const d = new Date(payday);
    while (d <= end) { if (d.getDate() === b.dayOfMonth) return true; d.setDate(d.getDate() + 1); }
    return false;
  });
}

// ── Plaid helpers ─────────────────────────────────────────────────────────────
interface PlaidAccount {
  accountId: string; name: string; mask?: string | null; type: string; subtype?: string | null;
  balances: { current?: number | null; available?: number | null; limit?: number | null };
  institutionName?: string | null; itemId?: string; loginRequired?: boolean;
}

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
interface Props { data: DashboardData; update: (fn: (d: DashboardData) => DashboardData) => void; }

export function FinancesView({ data, update }: Props) {
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"check" | "schedule" | "goals" | "accounts">("check");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchAccounts = useCallback(async (bust = false) => {
    setLoadingAccts(true);
    try { const r = await fetch(bust ? "/api/plaid/accounts?refresh=1" : "/api/plaid/accounts"); const j = await r.json(); if (!j.error) setAccounts(j.accounts ?? []); }
    finally { setLoadingAccts(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleRefresh = async () => {
    if (refreshing) return; setRefreshing(true);
    try { await fetch("/api/plaid/refresh", { method: "POST" }); await new Promise(r => setTimeout(r, 3000)); await fetchAccounts(true); }
    finally { setRefreshing(false); }
  };

  const handleDisconnect = async (itemId?: string) => {
    if (!itemId || !confirm("Remove this account connection?")) return;
    await fetch("/api/plaid/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    fetchAccounts(true);
  };

  const pc         = data.paycheckConfig;
  const selfCare   = data.selfCareItems ?? [];
  const bills      = data.recurringBills ?? [];

  // ── Setup flow ─────────────────────────────────────────────────────────────
  if (!pc) {
    return (
      <SetupFlow onDone={(config, items) => update(d => ({
        ...d,
        paycheckConfig: config,
        selfCareItems: items,
        recurringBills: [],
        budgetCategories: [],
        sinkingFunds: [],
        affordGoals: [],
      }))} />
    );
  }

  const payday     = parseISO(pc.nextPayday);
  const periodEnd  = addDays(payday, 13);
  const dueBills   = dueBillsInPeriod(bills, payday);
  const totalBills = dueBills.reduce((s, b) => s + b.amount, 0);
  const totalCarePerCheck = selfCare.reduce((s, i) => s + perCheck(i), 0);
  const savingsAmt = Math.round(pc.takeHomePerCheck * (pc.savingsPercent / 100));
  const freeToSpend = pc.takeHomePerCheck - totalBills - totalCarePerCheck - savingsAmt;
  const dueCareItems = selfCare.filter(i => { const d = daysUntil(nextDue(i)); return d <= 14 && d >= -7; });

  const TABS = [
    { key: "check"    as const, label: "This Check", emoji: "💸" },
    { key: "schedule" as const, label: "Schedule",   emoji: "📅" },
    { key: "goals"    as const, label: "Afford",     emoji: "🏠" },
    { key: "accounts" as const, label: "Accounts",   emoji: "🏦" },
  ];

  return (
    <div style={{ background: BG, minHeight: "100%", color: "#fff" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Finances</h1>
            <p className="text-xs" style={{ color: MUTED }}>{fmtDate(payday)} – {fmtDate(periodEnd)} · {fmt$(pc.takeHomePerCheck)}/check</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => update(d => ({ ...d, paycheckConfig: { ...pc, nextPayday: format(addDays(payday, 14), "yyyy-MM-dd") } }))}
              className="text-xs px-3 py-1.5 rounded-xl font-medium"
              style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
              Received ✓
            </button>
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}` }}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: MUTED }} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
          {TABS.map(({ key, label, emoji }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={tab === key ? { background: LIME, color: "#000" } : { color: MUTED }}>
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-12">
        {tab === "check" && (
          <CheckTab
            pc={pc} selfCare={selfCare} dueBills={dueBills} bills={bills}
            totalBills={totalBills} totalCarePerCheck={totalCarePerCheck}
            savingsAmt={savingsAmt} freeToSpend={freeToSpend}
            dueCareItems={dueCareItems} payday={payday} periodEnd={periodEnd}
          />
        )}
        {tab === "schedule" && (
          <ScheduleTab
            selfCare={selfCare}
            onUpdate={(items) => update(d => ({ ...d, selfCareItems: items }))}
            showToast={showToast}
          />
        )}
        {tab === "goals" && (
          <GoalsTab
            pc={pc} bills={bills}
            onUpdateBills={(b) => update(d => ({ ...d, recurringBills: b }))}
            onUpdatePc={(p) => update(d => ({ ...d, paycheckConfig: p }))}
            showToast={showToast}
          />
        )}
        {tab === "accounts" && (
          <AccountsTab accounts={accounts} loadingAccts={loadingAccts} refreshing={refreshing}
            onRefresh={handleRefresh} onDisconnect={handleDisconnect}
            onConnected={() => fetchAccounts(true)} />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none z-50"
          style={{ background: "rgba(200,255,0,0.15)", color: LIME, border: `1px solid rgba(200,255,0,0.3)` }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Setup Flow ────────────────────────────────────────────────────────────────
function SetupFlow({ onDone }: { onDone: (config: PaycheckConfig, items: SelfCareItem[]) => void }) {
  const [takeHome, setTakeHome] = useState("");
  const [nextPayday, setNextPayday] = useState("");
  const [savingsPct, setSavingsPct] = useState("10");

  const handleStart = () => {
    const config: PaycheckConfig = {
      takeHomePerCheck: parseFloat(takeHome) || 0,
      savingsPercent: parseFloat(savingsPct) || 10,
      nextPayday,
    };
    const items: SelfCareItem[] = DEFAULT_CARE.map(c => ({ ...c, id: id() }));
    onDone(config, items);
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: LIME, letterSpacing: "0.1em" }}>BUDGET SETUP</p>
        <h1 className="text-2xl font-semibold text-white mb-1">Fresh start.</h1>
        <p className="text-sm mb-8" style={{ color: MUTED }}>Let&apos;s set up your paycheck plan. Takes 30 seconds.</p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Take-home per check (after taxes)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
              <input type="number" value={takeHome} onChange={e => setTakeHome(e.target.value)} placeholder="e.g. 1800"
                className="w-full rounded-2xl pl-8 pr-4 py-3.5 text-sm text-white outline-none"
                style={{ background: CARD, border: `1px solid ${BORDER}` }} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Your next payday</label>
            <input type="date" value={nextPayday} onChange={e => setNextPayday(e.target.value)}
              className="w-full rounded-2xl px-4 py-3.5 text-sm text-white outline-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, colorScheme: "dark" }} />
          </div>

          <div>
            <label className="text-xs mb-2 block" style={{ color: MUTED }}>Save per check (%)</label>
            <div className="grid grid-cols-4 gap-2">
              {["5","10","15","20"].map(p => (
                <button key={p} onClick={() => setSavingsPct(p)}
                  className="py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={savingsPct === p ? { background: LIME, color: "#000" } : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(200,255,0,0.05)", border: `1px solid rgba(200,255,0,0.15)` }}>
          <p className="text-xs font-semibold mb-2" style={{ color: LIME }}>I&apos;ll pre-load your self-care schedule:</p>
          <div className="space-y-1.5">
            {DEFAULT_CARE.map(c => (
              <p key={c.name} className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                {c.emoji} {c.name} · {fmt$(c.cost)} every {c.frequencyWeeks} weeks
              </p>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: MUTED }}>You can edit costs, frequency, or add your own after setup.</p>
        </div>

        <button onClick={handleStart} disabled={!takeHome || !nextPayday}
          className="w-full py-4 rounded-2xl text-base font-bold disabled:opacity-40 transition-all active:scale-95"
          style={{ background: LIME, color: "#000" }}>
          Start Budgeting →
        </button>
      </div>
    </div>
  );
}

// ── Check Tab ─────────────────────────────────────────────────────────────────
function CheckTab({ pc, selfCare, dueBills, bills, totalBills, totalCarePerCheck, savingsAmt, freeToSpend, dueCareItems, payday, periodEnd }: {
  pc: PaycheckConfig; selfCare: SelfCareItem[]; dueBills: RecurringBill[]; bills: RecurringBill[];
  totalBills: number; totalCarePerCheck: number; savingsAmt: number; freeToSpend: number;
  dueCareItems: SelfCareItem[]; payday: Date; periodEnd: Date;
}) {
  const allocs = [
    { label: "Bills due",            amount: totalBills,         color: "#E8A87C", detail: dueBills.length > 0 ? dueBills.map(b => b.name).join(" · ") : "No bills this period 🎉" },
    { label: "Self-care set aside",  amount: totalCarePerCheck,  color: COLORS[1], detail: selfCare.length > 0 ? selfCare.map(i => `${i.emoji} ${fmt$(perCheck(i))}`).join("  ") : "No items set up" },
    { label: `Savings (${pc.savingsPercent}%)`, amount: savingsAmt, color: "#6B8CAE", detail: "your safety net, building quietly" },
  ];

  return (
    <div className="space-y-4">
      {/* Due this check alerts */}
      {dueCareItems.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(200,255,0,0.05)", border: `1px solid rgba(200,255,0,0.2)` }}>
          <p className="text-xs font-semibold mb-3" style={{ color: LIME, letterSpacing: "0.08em" }}>DUE THIS CHECK</p>
          <div className="space-y-3">
            {dueCareItems.map(item => {
              const days = daysUntil(nextDue(item));
              return (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{item.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>
                        {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `Due in ${days} days`} · {fmtDate(nextDue(item))}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">{fmt$(item.cost)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allocation breakdown */}
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-semibold mb-4" style={{ color: MUTED, letterSpacing: "0.08em" }}>
          {fmtDate(payday).toUpperCase()} – {fmtDate(periodEnd).toUpperCase()} · {fmt$(pc.takeHomePerCheck)} CHECK
        </p>

        {allocs.map(a => {
          const pct = pc.takeHomePerCheck > 0 ? (a.amount / pc.takeHomePerCheck) * 100 : 0;
          return (
            <div key={a.label} className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm text-white">{a.label}</p>
                <p className="text-sm font-bold text-white">{fmt$(a.amount)}</p>
              </div>
              <div className="rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.06)", height: 5 }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: a.color }} />
              </div>
              <p className="text-xs" style={{ color: MUTED }}>{a.detail}</p>
            </div>
          );
        })}

        <div className="rounded-2xl p-4 mt-1" style={{
          background: freeToSpend >= 0 ? "rgba(200,255,0,0.07)" : "rgba(218,102,123,0.08)",
          border: `1px solid ${freeToSpend >= 0 ? "rgba(200,255,0,0.2)" : "rgba(218,102,123,0.2)"}`,
        }}>
          <p className="text-xs mb-1" style={{ color: MUTED }}>Free to spend</p>
          <p className="text-4xl font-bold" style={{ color: freeToSpend >= 0 ? LIME : RED }}>
            {fmt$(Math.abs(freeToSpend))}{freeToSpend < 0 ? " over" : ""}
          </p>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            {freeToSpend >= 0
              ? "This is yours — guilt-free spending money."
              : "You're over budget this check. Review your bills or self-care amounts."}
          </p>
        </div>
      </div>

      {/* Bills list */}
      {bills.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="px-4 pt-4 pb-2 text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>
            BILLS THIS PERIOD
          </p>
          {dueBills.length === 0 ? (
            <p className="px-4 pb-4 text-sm" style={{ color: MUTED }}>None due {fmtDate(payday)}–{fmtDate(periodEnd)} 🎉</p>
          ) : dueBills.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: `1px solid ${BORDER}` }}>
              <div>
                <p className="text-sm text-white">{b.name}</p>
                <p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)} of the month</p>
              </div>
              <p className="text-sm font-semibold" style={{ color: RED }}>{fmt$(b.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {bills.length === 0 && (
        <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
          <p className="text-sm mb-1 text-white">No bills set up yet</p>
          <p className="text-xs" style={{ color: MUTED }}>Add rent, phone, subscriptions in the Afford tab so this check knows what&apos;s coming out.</p>
        </div>
      )}
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab({ selfCare, onUpdate, showToast }: {
  selfCare: SelfCareItem[]; onUpdate: (items: SelfCareItem[]) => void; showToast: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""); const [emoji, setEmoji] = useState("💄");
  const [cost, setCost] = useState(""); const [freqWeeks, setFreqWeeks] = useState("4");
  const [editId, setEditId] = useState<string | null>(null);

  const markDone = (item: SelfCareItem) => {
    const today = format(new Date(), "yyyy-MM-dd");
    onUpdate(selfCare.map(i => i.id === item.id ? { ...i, lastDone: today } : i));
    showToast(`${item.emoji} ${item.name} — marked done today!`);
  };

  const removeItem = (itemId: string) => onUpdate(selfCare.filter(i => i.id !== itemId));

  const addItem = () => {
    if (!name || !cost) return;
    const newItem: SelfCareItem = {
      id: id(), name, emoji, cost: parseFloat(cost),
      frequencyWeeks: parseInt(freqWeeks),
      color: COLORS[selfCare.length % COLORS.length],
    };
    onUpdate([...selfCare, newItem]);
    setName(""); setCost(""); setFreqWeeks("4"); setEmoji("💄"); setShowForm(false);
    showToast("Added to your schedule!");
  };

  const sorted = [...selfCare].sort((a, b) => daysUntil(nextDue(a)) - daysUntil(nextDue(b)));

  // Build upcoming calendar — next 4 occurrences of each item
  const upcoming: { date: Date; item: SelfCareItem }[] = [];
  for (const item of selfCare) {
    let due = nextDue(item);
    for (let i = 0; i < 4; i++) {
      if (daysUntil(due) >= -1) upcoming.push({ date: new Date(due), item });
      due = addDays(due, item.frequencyWeeks * 7);
    }
  }
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  const futureUpcoming = upcoming.filter(u => daysUntil(u.date) >= 0).slice(0, 10);

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !showForm && (
        <div className="rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-white mb-1">No self-care items yet</p>
          <p className="text-xs" style={{ color: MUTED }}>Add your hair, nails, facials, waxing — anything you do on a schedule.</p>
        </div>
      )}

      {sorted.map(item => {
        const due   = nextDue(item);
        const days  = daysUntil(due);
        const over  = days < 0;
        const soon  = days <= 7 && !over;
        const freqDays = item.frequencyWeeks * 7;
        const elapsed = item.lastDone ? freqDays - Math.max(days, 0) : freqDays;
        const pct = Math.min((elapsed / freqDays) * 100, 100);
        const isEditing = editId === item.id;

        return (
          <div key={item.id} className="rounded-2xl overflow-hidden"
            style={{ background: CARD, border: `1px solid ${over || soon ? "rgba(218,102,123,0.3)" : BORDER}` }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    {item.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      {fmt$(item.cost)} · every {item.frequencyWeeks} week{item.frequencyWeeks !== 1 ? "s" : ""} · {fmt$(perCheck(item))}/check
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditId(isEditing ? null : item.id)}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>
                    Edit
                  </button>
                  <button onClick={() => removeItem(item.id)} className="p-1">
                    <Trash2 size={13} style={{ color: MUTED }} />
                  </button>
                </div>
              </div>

              <div className="rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)", height: 5 }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color ?? LIME }} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: over ? RED : soon ? "#E8A87C" : "rgba(255,255,255,0.85)" }}>
                    {over ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today!" : `Due in ${days} days`}
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    {fmtDate(due)}
                    {item.lastDone ? ` · last done ${format(parseISO(item.lastDone), "MMM d")}` : " · never tracked"}
                  </p>
                </div>
                <button onClick={() => markDone(item)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all"
                  style={{ background: "rgba(200,255,0,0.12)", color: LIME, border: `1px solid rgba(200,255,0,0.25)` }}>
                  <Check size={12} /> Done!
                </button>
              </div>
            </div>

            {/* Inline edit */}
            {isEditing && (
              <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: MUTED }}>Cost ($)</label>
                    <input type="number" defaultValue={item.cost}
                      id={`cost-${item.id}`}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: MUTED }}>Every N weeks</label>
                    <input type="number" defaultValue={item.frequencyWeeks}
                      id={`freq-${item.id}`}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                  </div>
                </div>
                <button onClick={() => {
                  const newCost = parseFloat((document.getElementById(`cost-${item.id}`) as HTMLInputElement)?.value) || item.cost;
                  const newFreq = parseInt((document.getElementById(`freq-${item.id}`) as HTMLInputElement)?.value) || item.frequencyWeeks;
                  onUpdate(selfCare.map(i => i.id === item.id ? { ...i, cost: newCost, frequencyWeeks: newFreq } : i));
                  setEditId(null);
                  showToast("Updated!");
                }} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      <button onClick={() => setShowForm(!showForm)}
        className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ background: "rgba(255,255,255,0.04)", border: `1px dashed ${BORDER}`, color: MUTED }}>
        <Plus size={14} /> Add self-care item
      </button>

      {showForm && (
        <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
          <div className="space-y-3 mb-3">
            <div className="flex gap-2">
              <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
                className="w-14 rounded-xl px-2 py-3 text-xl text-center text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="What is it? (e.g. Waxing)"
                className="flex-1 rounded-xl px-3 py-3 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost ($)"
                className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <select value={freqWeeks} onChange={e => setFreqWeeks(e.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                {[["1","Every week"],["2","Every 2 wks"],["3","Every 3 wks"],["4","Every 4 wks"],["6","Every 6 wks"],["8","Every 8 wks"],["12","Every 12 wks"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            {cost && <p className="text-xs" style={{ color: LIME }}>Put aside {fmt$(Math.ceil((parseFloat(cost) / parseInt(freqWeeks)) * 2))}/check</p>}
          </div>
          <button onClick={addItem} disabled={!name || !cost}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: LIME, color: "#000" }}>
            Add to Schedule
          </button>
        </div>
      )}

      {/* Upcoming calendar */}
      {futureUpcoming.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="px-4 pt-4 pb-2 text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>COMING UP</p>
          {futureUpcoming.map((u, i) => (
            <div key={`${u.item.id}-${i}`} className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <span className="text-base">{u.item.emoji}</span>
                <div>
                  <p className="text-sm text-white">{u.item.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{format(u.date, "EEEE, MMM d")}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{fmt$(u.item.cost)}</p>
                <p className="text-xs" style={{ color: MUTED }}>in {daysUntil(u.date)} days</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Goals / Afford Tab ────────────────────────────────────────────────────────
function GoalsTab({ pc, bills, onUpdateBills, onUpdatePc, showToast }: {
  pc: PaycheckConfig; bills: RecurringBill[];
  onUpdateBills: (b: RecurringBill[]) => void;
  onUpdatePc: (p: PaycheckConfig) => void;
  showToast: (m: string) => void;
}) {
  const [targetRent, setTargetRent] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [billName, setBillName] = useState(""); const [billAmt, setBillAmt] = useState(""); const [billDay, setBillDay] = useState("1");
  const [editSavings, setEditSavings] = useState(false); const [savingsPct, setSavingsPct] = useState(String(pc.savingsPercent));
  const [editPay, setEditPay] = useState(false); const [payInput, setPayInput] = useState(String(pc.takeHomePerCheck));

  const monthlyIncome = (pc.takeHomePerCheck * 26) / 12;
  const comfortable   = Math.round(monthlyIncome * 0.25);
  const standard      = Math.round(monthlyIncome * 0.30);
  const stretch       = Math.round(monthlyIncome * 0.35);
  const rentPct       = targetRent ? (parseFloat(targetRent) / monthlyIncome) * 100 : 0;
  const rentVerdict   = rentPct === 0 ? null
    : rentPct <= 25 ? { text: "Comfortable — you&apos;re good!", color: LIME }
    : rentPct <= 30 ? { text: "Standard — manageable.",         color: "#8A9E87" }
    : rentPct <= 35 ? { text: "Stretching it — tight but doable.", color: "#E8A87C" }
    :                 { text: "Too much — financial stress risk.",  color: RED };

  const addBill = () => {
    if (!billName || !billAmt) return;
    onUpdateBills([...bills, { id: id(), name: billName, amount: parseFloat(billAmt), dayOfMonth: parseInt(billDay) }]);
    setBillName(""); setBillAmt(""); setBillDay("1"); setShowBillForm(false);
    showToast("Bill added!");
  };

  const monthlyBills = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-5">
      {/* Paycheck editor */}
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Take-home per check</p>
          <button onClick={() => setEditPay(!editPay)}
            className="text-xs px-3 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
        </div>
        {editPay ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
              <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)}
                className="w-full rounded-xl pl-7 pr-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <button onClick={() => { onUpdatePc({ ...pc, takeHomePerCheck: parseFloat(payInput) || pc.takeHomePerCheck }); setEditPay(false); showToast("Updated!"); }}
              className="px-4 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white">{fmt$(pc.takeHomePerCheck)}<span className="text-sm font-normal ml-1" style={{ color: MUTED }}>biweekly · {fmt$(Math.round(monthlyIncome))}/mo</span></p>
        )}
      </div>

      {/* Savings rate */}
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Savings per check</p>
          <button onClick={() => setEditSavings(!editSavings)}
            className="text-xs px-3 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
        </div>
        {editSavings ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {["5","10","15","20"].map(p => (
                <button key={p} onClick={() => setSavingsPct(p)}
                  className="py-2.5 rounded-xl text-sm font-semibold"
                  style={savingsPct === p ? { background: LIME, color: "#000" } : { background: "rgba(255,255,255,0.07)", color: MUTED }}>
                  {p}%
                </button>
              ))}
            </div>
            <button onClick={() => { onUpdatePc({ ...pc, savingsPercent: parseInt(savingsPct) }); setEditSavings(false); showToast("Savings rate updated!"); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold" style={{ color: LIME }}>{fmt$(Math.round(pc.takeHomePerCheck * pc.savingsPercent / 100))}</p>
            <p className="text-sm" style={{ color: MUTED }}>per check ({pc.savingsPercent}%)</p>
          </div>
        )}
      </div>

      {/* Rent affordability */}
      <div>
        <p className="text-sm font-semibold text-white mb-3">What rent can I afford?</p>
        <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-xs mb-3" style={{ color: MUTED }}>Based on {fmt$(Math.round(monthlyIncome))}/month take-home:</p>
          <div className="space-y-2 mb-4">
            {[{ label: "Comfortable (25%)", amount: comfortable, color: LIME },
              { label: "Standard (30%)",    amount: standard,    color: "#8A9E87" },
              { label: "Max (35%)",         amount: stretch,     color: RED }].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-sm" style={{ color: MUTED }}>{r.label}</p>
                <p className="text-sm font-bold" style={{ color: r.color }}>{fmt$(r.amount)}/mo</p>
              </div>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
            <input type="number" value={targetRent} onChange={e => setTargetRent(e.target.value)} placeholder="Enter a rent to check"
              className="w-full rounded-xl pl-8 pr-4 py-3 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
          </div>
          {rentVerdict && targetRent && (
            <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-sm font-semibold" style={{ color: rentVerdict.color }}
                dangerouslySetInnerHTML={{ __html: rentVerdict.text }} />
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                That&apos;s {Math.round(rentPct)}% of your monthly take-home.
                {rentPct > 25 ? ` You&apos;d have ${fmt$(Math.round(monthlyIncome - parseFloat(targetRent)))} left for everything else each month.` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bills manager */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Recurring Bills</p>
          <button onClick={() => setShowBillForm(!showBillForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Add bill
          </button>
        </div>

        {bills.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {bills.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < bills.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                <div>
                  <p className="text-sm text-white">{b.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)} of month</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold" style={{ color: RED }}>{fmt$(b.amount)}</p>
                  <button onClick={() => { onUpdateBills(bills.filter(x => x.id !== b.id)); showToast("Removed"); }}>
                    <Trash2 size={12} style={{ color: MUTED }} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(255,255,255,0.03)", borderTop: `1px solid ${BORDER}` }}>
              <p className="text-xs font-semibold" style={{ color: MUTED }}>Monthly total</p>
              <p className="text-sm font-bold text-white">{fmt$(monthlyBills)}/mo · {fmt$(Math.round(monthlyBills / 2))}/check</p>
            </div>
          </div>
        )}

        {showBillForm && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <input value={billName} onChange={e => setBillName(e.target.value)} placeholder="Name (e.g. Rent, Phone, Hulu)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={billAmt} onChange={e => setBillAmt(e.target.value)} placeholder="Amount ($)"
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <input type="number" min="1" max="31" value={billDay} onChange={e => setBillDay(e.target.value)} placeholder="Day due (1–31)"
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              </div>
            </div>
            <button onClick={addBill} disabled={!billName || !billAmt}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>
              Add Bill
            </button>
          </div>
        )}

        {bills.length === 0 && !showBillForm && (
          <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>Add rent, subscriptions, utilities — anything that hits on the same day each month.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accounts Tab ──────────────────────────────────────────────────────────────
function AccountsTab({ accounts, loadingAccts, refreshing, onRefresh, onDisconnect, onConnected }: {
  accounts: PlaidAccount[]; loadingAccts: boolean; refreshing: boolean;
  onRefresh: () => void; onDisconnect: (itemId?: string) => void; onConnected: () => void;
}) {
  const byInstitution: Record<string, PlaidAccount[]> = {};
  for (const a of accounts) {
    const key = a.institutionName ?? "Unknown Bank";
    if (!byInstitution[key]) byInstitution[key] = [];
    byInstitution[key].push(a);
  }

  return (
    <div className="space-y-4">
      {loadingAccts && accounts.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: MUTED }}>Loading accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>Connect your bank to see live account balances.</p>
          <PlaidConnectButton onConnected={onConnected} />
        </div>
      ) : (
        <>
          {Object.entries(byInstitution).map(([inst, accts]) => (
            <div key={inst} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <p className="text-sm font-semibold text-white">{inst}</p>
                <button onClick={() => onDisconnect(accts[0].itemId)} className="p-1.5 rounded-lg" style={{ background: "rgba(218,102,123,0.1)" }}>
                  <Unlink size={12} style={{ color: RED }} />
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
                    <p className="text-sm font-semibold" style={{ color: a.type === "credit" ? RED : LIME }}>
                      {a.type === "credit" ? "-" : ""}${Math.abs(bal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={onRefresh} disabled={refreshing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm"
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
