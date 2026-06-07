"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, Plus, Trash2, Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { DashboardData, PaycheckConfig, SelfCareItem, RecurringBill, P2PTransfer, AccountTransfer, BudgetLine } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { parseISO, format, addDays, differenceInDays } from "date-fns";

const LIME   = "#C8FF00";
const BG     = "#0A0A0A";
const CARD   = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = "rgba(255,255,255,0.4)";
const RED    = "#DA667B";
const AMBER  = "#E8A87C";
const COLORS = ["#C8FF00","#DA667B","#71816D","#C9B79C","#8A9E87","#A8967E","#6B8CAE","#E8A87C"];

// ── Types ─────────────────────────────────────────────────────────────────────
interface DetectedCare {
  key: string; label: string; emoji: string; color: string;
  avgCost: number; avgFreqDays: number; lastDate: string; merchants: string[];
}
interface InsightsData {
  hasData: boolean;
  paycheck?: { amount: number; lastDate: string; nextEstimatedDate: string; frequency: string; avgGap: number };
  selfCare?: DetectedCare[];
  bills?: { name: string; amount: number; dayOfMonth: number }[];
  paycheckSplits?: { toAccount: string; amount: number; count: number }[];
}
interface CheckSlot {
  checkDate: Date;
  focusItem: SelfCareItem | null;
  pushedItem: SelfCareItem | null;   // item skipped because unaffordable
  pushedTo: Date | null;              // when pushed item will next be affordable
  canAfford: boolean;
  savings: number;
  billsTotal: number;
  budgetTotal: number;
  dueBills: RecurringBill[];
  free: number;
}
interface SavingsAlert {
  item: SelfCareItem;
  checkDate: Date;
  shortfall: number;
  savePerCheck: number;
  checksUntil: number;
}
interface PlaidAccount {
  accountId: string; name: string; mask?: string | null; type: string; subtype?: string | null;
  balances: { current?: number | null; available?: number | null; limit?: number | null };
  institutionName?: string | null; itemId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n: number) { return `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function fmtDate(d: Date) { return format(d, "MMM d"); }
function ordinal(n: number) { const s = ["th","st","nd","rd"]; const v = n % 100; return s[(v-20)%10] || s[v] || s[0]; }
function getCategoryEmoji(cat: BudgetLine["category"]) {
  const map: Record<BudgetLine["category"], string> = {
    transfer: "🏦", housing: "🏠", food: "🛒", transport: "🚗",
    savings: "💰", utilities: "💡", other: "📌",
  };
  return map[cat] ?? "📌";
}

function dueBillsInPeriod(bills: RecurringBill[], payday: Date): RecurringBill[] {
  const end = addDays(payday, 13);
  return bills.filter(b => {
    const d = new Date(payday);
    while (d <= end) { if (d.getDate() === b.dayOfMonth) return true; d.setDate(d.getDate() + 1); }
    return false;
  });
}

function buildYearPlan(
  payday: Date, takeHome: number, savingsPct: number,
  items: SelfCareItem[], bills: RecurringBill[], budgetLines: BudgetLine[] = []
): CheckSlot[] {
  const endOfYear = new Date(new Date().getFullYear(), 11, 31);
  const lastDoneMap: Record<string, string | undefined> = {};
  for (const item of items) lastDoneMap[item.id] = item.lastDone;

  const slots: CheckSlot[] = [];
  let date = new Date(payday);
  const budgetTotal = budgetLines.reduce((s, l) => s + l.amountPerCheck, 0);

  while (date <= endOfYear) {
    const savings    = Math.round(takeHome * savingsPct / 100);
    const due        = dueBillsInPeriod(bills, date);
    const billsTotal = due.reduce((s, b) => s + b.amount, 0);
    const free       = takeHome - savings - billsTotal - budgetTotal;

    // Score all items by urgency
    const scored = items.map(item => {
      const ld = lastDoneMap[item.id];
      const lastDate = ld ? parseISO(ld) : addDays(date, -(item.frequencyWeeks * 7 + 1));
      const daysSince = differenceInDays(date, lastDate);
      const urgency = daysSince / (item.frequencyWeeks * 7);
      return { item, urgency };
    }).filter(s => s.urgency >= 0.8).sort((a, b) => b.urgency - a.urgency);

    let focusItem: SelfCareItem | null = null;
    let pushedItem: SelfCareItem | null = null;
    let pushedTo: Date | null = null;

    if (scored.length > 0) {
      // Try to find most urgent affordable item
      const affordable = scored.find(s => s.item.cost <= free);
      if (affordable) {
        focusItem = affordable.item;
        // Update lastDone only when actually affordable and assigned
        lastDoneMap[focusItem.id] = format(date, "yyyy-MM-dd");
      } else {
        // Most urgent item can't be afforded — mark as pushed
        pushedItem = scored[0].item;
        // Find the first future check where it will be affordable
        let futureDate = addDays(date, 14);
        for (let attempt = 0; attempt < 26; attempt++) {
          const futureDue = dueBillsInPeriod(bills, futureDate);
          const futureBills = futureDue.reduce((s, b) => s + b.amount, 0);
          const futureFree = takeHome - Math.round(takeHome * savingsPct / 100) - futureBills - budgetTotal;
          if (pushedItem.cost <= futureFree) {
            pushedTo = new Date(futureDate);
            break;
          }
          futureDate = addDays(futureDate, 14);
        }
      }
    }

    slots.push({
      checkDate: new Date(date),
      focusItem,
      pushedItem,
      pushedTo,
      canAfford: focusItem ? focusItem.cost <= free : false,
      savings,
      billsTotal,
      budgetTotal,
      dueBills: due,
      free,
    });
    date = addDays(date, 14);
  }
  return slots;
}

function computeSavingsAlerts(slots: CheckSlot[]): SavingsAlert[] {
  const seen = new Set<string>();
  return slots.slice(1).reduce<SavingsAlert[]>((out, slot, idx) => {
    if (!slot.pushedItem || seen.has(slot.pushedItem.id)) return out;
    seen.add(slot.pushedItem.id);
    const shortfall = slot.pushedItem.cost - slot.free;
    const checksUntil = idx + 1;
    return [...out, {
      item: slot.pushedItem,
      checkDate: slot.checkDate,
      shortfall,
      savePerCheck: Math.ceil(shortfall / checksUntil),
      checksUntil,
    }];
  }, []).slice(0, 3);
}

function yearSummary(yearPlan: CheckSlot[], takeHome: number) {
  const totalChecks = yearPlan.length;
  const totalIncome = totalChecks * takeHome;
  const totalTreatments = yearPlan.reduce((s, slot) => s + (slot.focusItem?.cost ?? 0), 0);
  const totalSavings = yearPlan.reduce((s, slot) => s + slot.savings, 0);
  return { totalChecks, totalIncome, totalTreatments, totalSavings };
}

// ── Plaid Connect ─────────────────────────────────────────────────────────────
function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching]   = useState(false);
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

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props { data: DashboardData; update: (fn: (d: DashboardData) => DashboardData) => void; }

export function FinancesView({ data, update }: Props) {
  const [tab, setTab]                       = useState<"plan"|"schedule"|"accounts">("plan");
  const [toast, setToast]                   = useState<string | null>(null);
  const [insights, setInsights]             = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [accounts, setAccounts]             = useState<PlaidAccount[]>([]);
  const [loadingAccts, setLoadingAccts]     = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [showBanner, setShowBanner]         = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    fetch("/api/plaid/insights").then(r => r.json()).then((d: InsightsData) => {
      setInsights(d);
      if (!d.hasData || !d.selfCare?.length) return;
      if (!data.selfCareItems?.length) { setShowBanner(true); return; }
      const missing = data.selfCareItems.filter(i => !i.lastDone);
      if (missing.length > 0) {
        const detectedMap = new Map(d.selfCare.map(c => [c.label.toLowerCase(), c]));
        update(prev => ({
          ...prev,
          selfCareItems: (prev.selfCareItems ?? []).map(item => {
            if (item.lastDone) return item;
            const hit = detectedMap.get(item.name.toLowerCase());
            return hit ? { ...item, lastDone: hit.lastDate } : item;
          }),
        }));
      }
    }).catch(() => {}).finally(() => setInsightsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const pc              = data.paycheckConfig;
  const selfCare        = data.selfCareItems ?? [];
  const bills           = data.recurringBills ?? [];
  const budgetLines     = data.budgetLines ?? [];
  const p2pTransfers    = data.p2pTransfers ?? [];
  const accountTransfers = data.accountTransfers ?? [];

  if (!pc) {
    return (
      <SetupFlow
        insights={insights}
        insightsLoading={insightsLoading}
        onDone={(config, items, newBills) => update(d => ({
          ...d, paycheckConfig: config, selfCareItems: items, recurringBills: newBills,
          budgetCategories: [], sinkingFunds: [], affordGoals: [],
        }))}
      />
    );
  }

  const effectiveTakeHome = pc.projectedTakeHome ?? pc.takeHomePerCheck;
  const payday   = parseISO(pc.nextPayday);
  const yearPlan = buildYearPlan(payday, effectiveTakeHome, pc.savingsPercent, selfCare, bills, budgetLines);
  const savingsAlerts = computeSavingsAlerts(yearPlan);
  const summary = yearSummary(yearPlan, effectiveTakeHome);

  return (
    <div style={{ background: BG, minHeight: "100%", color: "#fff" }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: LIME, letterSpacing: "0.1em" }}>FINANCES</p>
            <h1 className="text-3xl font-bold text-white">{fmt$(effectiveTakeHome)}</h1>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              biweekly{pc.employer ? ` · ${pc.employer}` : ""} · next payday {fmtDate(payday)}
            </p>
            {pc.projectedTakeHome && (
              <p className="text-xs mt-0.5" style={{ color: AMBER }}>Using projected amount</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => update(d => ({ ...d, paycheckConfig: { ...pc, nextPayday: format(addDays(payday, 14), "yyyy-MM-dd") } }))}
              className="text-xs px-3 py-1.5 rounded-xl font-medium"
              style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
              Got paid ✓
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}` }}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: MUTED }} />
            </button>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
          {(["plan","schedule","accounts"] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all"
              style={tab === k ? { background: LIME, color: "#000" } : { color: MUTED }}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Insights banner */}
      {showBanner && insights?.selfCare && tab === "plan" && (
        <InsightsBanner
          detected={insights.selfCare}
          detectedBills={insights.bills ?? []}
          paycheckAmount={insights.paycheck?.amount}
          onAccept={(items, newBills) => {
            update(d => ({
              ...d, selfCareItems: items,
              recurringBills: [...(d.recurringBills ?? []), ...newBills],
              ...(insights.paycheck ? { paycheckConfig: { ...pc, takeHomePerCheck: insights.paycheck.amount } } : {}),
            }));
            setShowBanner(false);
            showToast("Your patterns are loaded!");
          }}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <div className="px-5 pb-16">
        {tab === "plan" && (
          <PlanTab
            yearPlan={yearPlan}
            savingsAlerts={savingsAlerts}
            summary={summary}
            pc={pc}
            effectiveTakeHome={effectiveTakeHome}
            budgetLines={budgetLines}
            p2pTransfers={p2pTransfers}
            onMarkBillPaid={(billId) => update(d => ({
              ...d, recurringBills: (d.recurringBills ?? []).map(b =>
                b.id === billId ? { ...b, lastPaidDate: format(new Date(), "yyyy-MM-dd") } : b),
            }))}
            onMarkFocusDone={(itemId) => {
              update(d => ({
                ...d,
                selfCareItems: (d.selfCareItems ?? []).map(i => i.id === itemId ? { ...i, lastDone: format(new Date(), "yyyy-MM-dd") } : i),
                paycheckConfig: { ...pc, nextPayday: format(addDays(payday, 14), "yyyy-MM-dd") },
              }));
              showToast("Done! Check advanced.");
            }}
            onUpdateSavings={(pct) => update(d => ({ ...d, paycheckConfig: { ...pc, savingsPercent: pct } }))}
            onAddP2P={(t) => update(d => ({ ...d, p2pTransfers: [t, ...(d.p2pTransfers ?? [])] }))}
            onRemoveP2P={(tid) => update(d => ({ ...d, p2pTransfers: (d.p2pTransfers ?? []).filter(t => t.id !== tid) }))}
          />
        )}
        {tab === "schedule" && (
          <ScheduleTab
            selfCare={selfCare} bills={bills} pc={pc}
            budgetLines={budgetLines}
            insights={insights}
            effectiveTakeHome={effectiveTakeHome}
            onUpdateCare={(items) => update(d => ({ ...d, selfCareItems: items }))}
            onUpdateBills={(b) => update(d => ({ ...d, recurringBills: b }))}
            onUpdateBudgetLines={(bl) => update(d => ({ ...d, budgetLines: bl }))}
            onUpdatePc={(p) => update(d => ({ ...d, paycheckConfig: p }))}
            showToast={showToast}
          />
        )}
        {tab === "accounts" && (
          <AccountsTab
            accounts={accounts} loadingAccts={loadingAccts} refreshing={refreshing}
            accountTransfers={accountTransfers}
            onRefresh={handleRefresh} onDisconnect={handleDisconnect}
            onConnected={() => fetchAccounts(true)}
            onAddTransfer={(t) => update(d => ({ ...d, accountTransfers: [t, ...(d.accountTransfers ?? [])] }))}
            onRemoveTransfer={(tid) => update(d => ({ ...d, accountTransfers: (d.accountTransfers ?? []).filter(t => t.id !== tid) }))}
          />
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

// ── Insights Banner ───────────────────────────────────────────────────────────
function InsightsBanner({ detected, detectedBills, paycheckAmount, onAccept, onDismiss }: {
  detected: DetectedCare[];
  detectedBills: { name: string; amount: number; dayOfMonth: number }[];
  paycheckAmount?: number;
  onAccept: (items: SelfCareItem[], bills: RecurringBill[]) => void;
  onDismiss: () => void;
}) {
  const [sel, setSel]   = useState<Set<string>>(new Set(detected.map(d => d.key)));
  const [bSel, setBSel] = useState<Set<string>>(new Set());

  const toggle  = (k: string) => setSel(p  => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleB = (k: string) => setBSel(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const accept = () => {
    const items = detected.filter(d => sel.has(d.key)).map((d, i) => ({
      id: id(), name: d.label, emoji: d.emoji, cost: d.avgCost,
      frequencyWeeks: Math.max(1, Math.round(d.avgFreqDays / 7)),
      color: d.color ?? COLORS[i % COLORS.length],
      lastDone: d.lastDate || undefined,
    }));
    const newBills = detectedBills.filter(b => bSel.has(b.name)).map(b => ({ id: id(), name: b.name, amount: b.amount, dayOfMonth: b.dayOfMonth }));
    onAccept(items, newBills);
  };

  return (
    <div className="mx-5 mb-5 rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(200,255,0,0.2)` }}>
      <div className="px-4 pt-4 pb-3" style={{ background: "rgba(200,255,0,0.06)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: LIME, letterSpacing: "0.08em" }}>YOUR PATTERNS, DETECTED</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          I read 6 months of transactions. Here&apos;s what I found — confirm to load into your rotation.
          {paycheckAmount ? ` Your avg paycheck: ${fmt$(paycheckAmount)}.` : ""}
        </p>
      </div>
      <div className="px-4 py-3 space-y-2" style={{ background: "rgba(200,255,0,0.03)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.06em" }}>SELF-CARE SPENDING</p>
        {detected.map(d => (
          <button key={d.key} onClick={() => toggle(d.key)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all"
            style={{ background: sel.has(d.key) ? "rgba(200,255,0,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel.has(d.key) ? "rgba(200,255,0,0.25)" : BORDER}` }}>
            <div className="flex items-center gap-2.5 text-left">
              <span className="text-base">{d.emoji}</span>
              <div>
                <p className="text-sm text-white">{d.label}</p>
                <p className="text-xs" style={{ color: MUTED }}>
                  avg {fmt$(d.avgCost)} · every ~{Math.round(d.avgFreqDays / 7)} wks · {d.merchants[0]}
                </p>
              </div>
            </div>
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: sel.has(d.key) ? LIME : "rgba(255,255,255,0.1)" }}>
              {sel.has(d.key) && <Check size={11} color="#000" />}
            </div>
          </button>
        ))}
      </div>
      {detectedBills.length > 0 && (
        <div className="px-4 py-3 space-y-2" style={{ background: "rgba(200,255,0,0.02)", borderTop: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.06em" }}>RECURRING BILLS DETECTED</p>
          {detectedBills.slice(0, 6).map(b => (
            <button key={b.name} onClick={() => toggleB(b.name)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl"
              style={{ background: bSel.has(b.name) ? "rgba(200,255,0,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${bSel.has(b.name) ? "rgba(200,255,0,0.25)" : BORDER}` }}>
              <div className="text-left">
                <p className="text-sm text-white">{b.name}</p>
                <p className="text-xs" style={{ color: MUTED }}>due {b.dayOfMonth}{ordinal(b.dayOfMonth)} · {fmt$(b.amount)}/mo</p>
              </div>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: bSel.has(b.name) ? LIME : "rgba(255,255,255,0.1)" }}>
                {bSel.has(b.name) && <Check size={11} color="#000" />}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pb-4 pt-3 flex gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={accept} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: LIME, color: "#000" }}>
          Load {sel.size} item{sel.size !== 1 ? "s" : ""} into plan
        </button>
        <button onClick={onDismiss} className="px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Skip</button>
      </div>
    </div>
  );
}

// ── Setup Flow ────────────────────────────────────────────────────────────────
function SetupFlow({ insights, insightsLoading, onDone }: {
  insights: InsightsData | null;
  insightsLoading: boolean;
  onDone: (config: PaycheckConfig, items: SelfCareItem[], bills: RecurringBill[]) => void;
}) {
  const [takeHome, setTakeHome]         = useState("");
  const [nextPayday, setNextPayday]     = useState("");
  const [savingsPct, setSavingsPct]     = useState("");
  const [employer, setEmployer]         = useState("");
  const [projectedAmt, setProjectedAmt] = useState("");

  useEffect(() => {
    if (insights?.paycheck) {
      setTakeHome(String(insights.paycheck.amount));
      setProjectedAmt(String(insights.paycheck.amount));
    }
    if (insights?.paycheck?.nextEstimatedDate) setNextPayday(insights.paycheck.nextEstimatedDate);
  }, [insights]);

  const handleStart = () => {
    const config: PaycheckConfig = {
      takeHomePerCheck: parseFloat(takeHome) || 0,
      savingsPercent: parseFloat(savingsPct) || 0,
      nextPayday,
      employer: employer.trim() || undefined,
      projectedTakeHome: projectedAmt && parseFloat(projectedAmt) !== parseFloat(takeHome) ? parseFloat(projectedAmt) : undefined,
    };
    const items: SelfCareItem[] = (insights?.selfCare ?? []).slice(0, 5).map((d, i) => ({
      id: id(), name: d.label, emoji: d.emoji, cost: d.avgCost,
      frequencyWeeks: Math.max(1, Math.round(d.avgFreqDays / 7)),
      color: d.color ?? COLORS[i % COLORS.length],
      lastDone: d.lastDate || undefined,
    }));
    const bills: RecurringBill[] = (insights?.bills ?? []).map(b => ({ id: id(), name: b.name, amount: b.amount, dayOfMonth: b.dayOfMonth }));
    onDone(config, items, bills);
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {insightsLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full border-t-white animate-spin mx-auto mb-4" />
            <p className="text-sm" style={{ color: MUTED }}>Reading your transaction history…</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold mb-1" style={{ color: LIME, letterSpacing: "0.1em" }}>BUDGET SETUP</p>
            <h1 className="text-2xl font-bold text-white mb-1">
              {insights?.paycheck ? "Found your paycheck." : "Fresh start."}
            </h1>
            <p className="text-sm mb-8" style={{ color: MUTED }}>
              {insights?.paycheck
                ? `Looks like you make about ${fmt$(insights.paycheck.amount)} ${insights.paycheck.frequency}. Confirm or edit below.`
                : "Let's set up your paycheck plan."}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Where do you work? (optional)</label>
                <input value={employer} onChange={e => setEmployer(e.target.value)} placeholder="e.g. HCA Healthcare"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm text-white outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}` }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Take-home per check (detected from Plaid)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
                  <input type="number" value={takeHome} onChange={e => setTakeHome(e.target.value)} placeholder="e.g. 1800"
                    className="w-full rounded-2xl pl-8 pr-4 py-3.5 text-sm text-white outline-none"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Projected take-home per check (your expected amount)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
                  <input type="number" value={projectedAmt} onChange={e => setProjectedAmt(e.target.value)} placeholder="Override if different"
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

            {(insights?.selfCare ?? []).length > 0 && (
              <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(200,255,0,0.05)", border: `1px solid rgba(200,255,0,0.15)` }}>
                <p className="text-xs font-semibold mb-2" style={{ color: LIME }}>Detected from your spending:</p>
                <div className="space-y-1.5">
                  {(insights!.selfCare!).map(d => (
                    <p key={d.key} className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {d.emoji} {d.label} · avg {fmt$(d.avgCost)} · every ~{Math.round(d.avgFreqDays / 7)} wks
                    </p>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: MUTED }}>These will be pre-loaded into your check rotation.</p>
              </div>
            )}

            <button onClick={handleStart} disabled={!takeHome || !nextPayday}
              className="w-full py-4 rounded-2xl text-base font-bold disabled:opacity-40 transition-all active:scale-95"
              style={{ background: LIME, color: "#000" }}>
              Build My Plan →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── AI Advisor Card ───────────────────────────────────────────────────────────
function AIAdvisorCard({ pc, currentSlot, yearChecksRemaining, totalYearTreatmentCost }: {
  pc: PaycheckConfig;
  currentSlot: CheckSlot;
  yearChecksRemaining: number;
  totalYearTreatmentCost: number;
}) {
  const [advice, setAdvice]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchAdvice = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = {
        employer: pc.employer,
        checkDate: format(currentSlot.checkDate, "MMMM d, yyyy"),
        takeHome: pc.takeHomePerCheck,
        projectedTakeHome: pc.projectedTakeHome,
        savings: currentSlot.savings,
        bills: currentSlot.billsTotal,
        focusItem: currentSlot.focusItem ? {
          name: currentSlot.focusItem.name,
          cost: currentSlot.focusItem.cost,
          lastDone: currentSlot.focusItem.lastDone,
          canAfford: currentSlot.canAfford,
        } : undefined,
        pushedItem: currentSlot.pushedItem && currentSlot.pushedTo ? {
          name: currentSlot.pushedItem.name,
          cost: currentSlot.pushedItem.cost,
          nextDate: format(currentSlot.pushedTo, "MMM d"),
        } : undefined,
        freeAfterAll: currentSlot.focusItem
          ? Math.max(0, currentSlot.free - currentSlot.focusItem.cost)
          : currentSlot.free,
        yearChecksRemaining,
        totalYearTreatmentCost,
        savingsPercent: pc.savingsPercent,
      };
      const res = await fetch("/api/ai/budget-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      const j = await res.json();
      setAdvice(j.advice || null);
    } catch {
      setAdvice(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc, currentSlot, yearChecksRemaining, totalYearTreatmentCost]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAdvice();
    }
  }, [fetchAdvice]);

  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>SMART ADVISOR</p>
        <button onClick={fetchAdvice} disabled={loading}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}` }}>
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} style={{ color: MUTED }} />
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "90%" }} />
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "70%" }} />
        </div>
      ) : advice ? (
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{advice}</p>
      ) : (
        <p className="text-sm" style={{ color: MUTED }}>Tap refresh for personalized advice.</p>
      )}
      <div className="flex justify-end mt-3">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>powered by Claude</p>
      </div>
    </div>
  );
}

// ── Plan Tab ──────────────────────────────────────────────────────────────────
function PlanTab({ yearPlan, savingsAlerts, summary, pc, effectiveTakeHome, budgetLines, p2pTransfers, onMarkBillPaid, onMarkFocusDone, onUpdateSavings, onAddP2P, onRemoveP2P }: {
  yearPlan: CheckSlot[];
  savingsAlerts: SavingsAlert[];
  summary: { totalChecks: number; totalIncome: number; totalTreatments: number; totalSavings: number };
  pc: PaycheckConfig;
  effectiveTakeHome: number;
  budgetLines: BudgetLine[];
  p2pTransfers: P2PTransfer[];
  onMarkBillPaid: (id: string) => void;
  onMarkFocusDone: (itemId: string) => void;
  onUpdateSavings: (pct: number) => void;
  onAddP2P: (t: P2PTransfer) => void;
  onRemoveP2P: (tid: string) => void;
}) {
  const [expanded, setExpanded]       = useState<number | null>(null);
  const [showAllYear, setShowAllYear] = useState(false);
  const [showP2P, setShowP2P]         = useState(false);
  const [showMidYear, setShowMidYear] = useState(true);
  const [p2pPerson, setP2pPerson]     = useState("");
  const [p2pAmount, setP2pAmount]     = useState("");
  const [p2pDir, setP2pDir]           = useState<"sent"|"received">("sent");
  const [p2pPlatform, setP2pPlatform] = useState<P2PTransfer["platform"]>("zelle");
  const [p2pNote, setP2pNote]         = useState("");

  const current   = yearPlan[0];
  const focus     = current.focusItem;
  const pushed    = current.pushedItem;
  const paydayStr = format(parseISO(pc.nextPayday), "yyyy-MM-dd");
  const isPaid    = (b: RecurringBill) => !!(b.lastPaidDate && b.lastPaidDate >= paydayStr);
  const currentMonth = new Date().getMonth(); // 0-based, June = 5
  const showMidYearCtx = currentMonth >= 5 || true; // show when June or later

  // Priority list = all slots with focusItem or pushedItem
  const prioritySlots = yearPlan.slice(1).filter(s => s.focusItem || s.pushedItem);

  // Group by month
  const byMonth: { month: string; slots: { slot: CheckSlot; idx: number }[] }[] = [];
  for (let i = 0; i < prioritySlots.length; i++) {
    const slot = prioritySlots[i];
    const month = format(slot.checkDate, "MMMM yyyy");
    const last = byMonth[byMonth.length - 1];
    if (last?.month === month) last.slots.push({ slot, idx: i });
    else byMonth.push({ month, slots: [{ slot, idx: i }] });
  }
  const visibleMonths = showAllYear ? byMonth : byMonth.slice(0, 3);

  const addP2P = () => {
    if (!p2pPerson || !p2pAmount) return;
    onAddP2P({ id: id(), date: format(new Date(), "yyyy-MM-dd"), person: p2pPerson, amount: parseFloat(p2pAmount), direction: p2pDir, platform: p2pPlatform, note: p2pNote || undefined });
    setP2pPerson(""); setP2pAmount(""); setP2pNote(""); setShowP2P(false);
  };

  return (
    <div className="space-y-5">
      {/* Mid-year context card */}
      {showMidYearCtx && showMidYear && (
        <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(232,168,124,0.08)", border: `1px solid rgba(232,168,124,0.2)` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: AMBER, letterSpacing: "0.08em" }}>
                STARTING MID-YEAR · {new Date().getFullYear()}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                {summary.totalChecks} checks left · {fmt$(summary.totalIncome)} projected income · {fmt$(summary.totalTreatments)} in treatments planned
              </p>
            </div>
            <button onClick={() => setShowMidYear(false)} className="text-xs px-2 py-1 rounded-lg ml-3 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* THIS CHECK hero card */}
      <div className="rounded-3xl p-6" style={{
        background: focus
          ? (current.canAfford ? "rgba(200,255,0,0.04)" : "rgba(218,102,123,0.04)")
          : CARD,
        border: `1px solid ${focus ? (current.canAfford ? "rgba(200,255,0,0.2)" : "rgba(218,102,123,0.2)") : BORDER}`,
      }}>
        <p className="text-xs font-semibold mb-4" style={{ color: MUTED, letterSpacing: "0.1em" }}>
          THIS CHECK · {fmtDate(current.checkDate).toUpperCase()}
          {pc.employer ? ` · ${pc.employer.toUpperCase()}` : ""}
        </p>

        {focus ? (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-5xl mb-2">{focus.emoji}</p>
                <h2 className="text-2xl font-bold text-white">{focus.name}</h2>
                <p className="text-sm mt-1 font-semibold" style={{ color: current.canAfford ? LIME : RED }}>
                  {fmt$(focus.cost)} · {current.canAfford ? "you can swing it" : "tight this check"}
                </p>
              </div>
              <button onClick={() => onMarkFocusDone(focus.id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(200,255,0,0.12)", color: LIME, border: `1px solid rgba(200,255,0,0.3)` }}>
                Done ✓
              </button>
            </div>
            <div className="space-y-2 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Savings",    amount: current.savings,      color: "#6B8CAE" },
                ...budgetLines.map(l => ({ label: `${getCategoryEmoji(l.category)} ${l.label}`, amount: l.amountPerCheck, color: AMBER })),
                { label: "Bills",      amount: current.billsTotal,   color: AMBER },
                { label: focus.name,   amount: focus.cost,           color: current.canAfford ? LIME : RED },
              ].filter(r => r.amount > 0).map(r => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span style={{ color: MUTED }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: r.color }}>{fmt$(r.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="text-sm" style={{ color: MUTED }}>Yours after</span>
                <span className="text-2xl font-bold" style={{ color: current.free - focus.cost >= 0 ? "#fff" : RED }}>
                  {fmt$(Math.max(0, current.free - focus.cost))}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div>
            <p className="text-4xl font-bold text-white mb-2">{fmt$(current.free)}</p>
            <p className="text-sm" style={{ color: MUTED }}>free this check — after savings &amp; bills</p>
            {current.savings > 0 && (
              <p className="text-xs mt-3" style={{ color: MUTED }}>Transfer {fmt$(current.savings)} to savings first.</p>
            )}
            {!focus && <p className="text-xs mt-2" style={{ color: MUTED }}>Add self-care items in Schedule to see your rotation.</p>}
          </div>
        )}
      </div>

      {/* Pushed item card */}
      {pushed && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(232,168,124,0.07)", border: `1px solid rgba(232,168,124,0.2)` }}>
          <span className="text-xl flex-shrink-0">{pushed.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">{pushed.name} is pushed</p>
            <p className="text-xs" style={{ color: AMBER }}>
              {fmt$(pushed.cost)} — affordable on {current.pushedTo ? fmtDate(current.pushedTo) : "a future check"}
            </p>
          </div>
        </div>
      )}

      {/* AI Advisor */}
      <AIAdvisorCard
        pc={pc}
        currentSlot={current}
        yearChecksRemaining={yearPlan.length}
        totalYearTreatmentCost={yearPlan.reduce((s, slot) => s + (slot.focusItem?.cost ?? 0), 0)}
      />

      {/* Priority List — REST OF YEAR */}
      {prioritySlots.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>
                PRIORITY LIST — REST OF {new Date().getFullYear()}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                {yearPlan.length - 1} CHECKS LEFT · {fmt$(summary.totalIncome - effectiveTakeHome)} INCOME · {fmt$(summary.totalTreatments)} PLANNED
              </p>
            </div>
            {byMonth.length > 3 && (
              <button onClick={() => setShowAllYear(!showAllYear)}
                className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: MUTED }}>
                {showAllYear ? "Show less" : "Show all"}
                {showAllYear ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {visibleMonths.map(({ month, slots: monthSlots }) => (
              <div key={month}>
                <p className="text-xs font-semibold mb-2 px-1" style={{ color: MUTED, letterSpacing: "0.06em" }}>
                  {month.toUpperCase()}
                </p>
                <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {monthSlots.map(({ slot, idx }, si) => {
                    const open = expanded === idx;
                    const item = slot.focusItem ?? slot.pushedItem;
                    const isAffordable = slot.focusItem ? slot.canAfford : false;
                    const isPushed = !slot.focusItem && !!slot.pushedItem;
                    const pillColor = isAffordable ? LIME : isPushed ? AMBER : RED;
                    const pillBg   = isAffordable ? "rgba(200,255,0,0.1)" : isPushed ? "rgba(232,168,124,0.1)" : "rgba(218,102,123,0.1)";

                    return (
                      <div key={idx} style={{ borderBottom: si < monthSlots.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                        <button className="w-full flex items-center justify-between px-4 py-3"
                          onClick={() => setExpanded(open ? null : idx)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 text-center">
                              <p className="text-base leading-none">{item?.emoji ?? "·"}</p>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">
                                {item?.name ?? "Free check"}
                                {isPushed && <span className="ml-1.5 text-xs" style={{ color: AMBER }}>pushed</span>}
                              </p>
                              <p className="text-xs" style={{ color: MUTED }}>{format(slot.checkDate, "EEE, MMM d")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {item ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: pillBg, color: pillColor }}>
                                {fmt$(item.cost)}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: MUTED }}>{fmt$(slot.free)} free</span>
                            )}
                            {open ? <ChevronUp size={12} style={{ color: MUTED }} /> : <ChevronDown size={12} style={{ color: MUTED }} />}
                          </div>
                        </button>
                        {open && (
                          <div className="px-4 pb-3 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                            {[
                              { label: "Take-home", amount: effectiveTakeHome,  color: "#fff" },
                              { label: "Savings",   amount: slot.savings,       color: "#6B8CAE" },
                              { label: "Bills",     amount: slot.billsTotal,    color: AMBER },
                              ...(slot.focusItem ? [{ label: slot.focusItem.name, amount: slot.focusItem.cost, color: LIME }] : []),
                              ...(slot.pushedItem ? [{ label: `${slot.pushedItem.name} (pushed)`, amount: slot.pushedItem.cost, color: AMBER }] : []),
                              { label: "Yours after", amount: slot.focusItem ? slot.free - slot.focusItem.cost : slot.free, color: "#fff" },
                            ].map(r => (
                              <div key={r.label} className="flex justify-between text-xs">
                                <span style={{ color: MUTED }}>{r.label}</span>
                                <span style={{ color: r.color }}>{fmt$(r.amount)}</span>
                              </div>
                            ))}
                            {slot.dueBills.length > 0 && (
                              <p className="text-xs pt-1" style={{ color: MUTED }}>Bills: {slot.dueBills.map(b => b.name).join(", ")}</p>
                            )}
                            {isPushed && slot.pushedTo && (
                              <p className="text-xs pt-1" style={{ color: AMBER }}>
                                Pushed → affordable on {fmtDate(slot.pushedTo)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick savings adjustment */}
      <div className="rounded-2xl px-4 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-semibold mb-2" style={{ color: MUTED, letterSpacing: "0.08em" }}>SAVINGS RATE</p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-white">
            Saving <span style={{ color: LIME }}>{pc.savingsPercent}%</span> · {fmt$(Math.round(effectiveTakeHome * pc.savingsPercent / 100))}/check
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateSavings(Math.max(0, pc.savingsPercent - 5))}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "rgba(255,255,255,0.07)", color: MUTED, border: `1px solid ${BORDER}` }}>
              -5%
            </button>
            <button
              onClick={() => onUpdateSavings(Math.min(50, pc.savingsPercent + 5))}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
              +5%
            </button>
          </div>
        </div>
      </div>

      {/* Savings alerts */}
      {savingsAlerts.length > 0 && (
        <div className="space-y-2">
          {savingsAlerts.map(a => (
            <div key={a.item.id} className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(232,168,124,0.08)", border: `1px solid rgba(232,168,124,0.25)` }}>
              <div>
                <p className="text-sm font-semibold text-white">
                  {a.item.emoji} {a.item.name} — {fmtDate(a.checkDate)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: AMBER }}>
                  {fmt$(a.shortfall)} short · set aside {fmt$(a.savePerCheck)}/check for {a.checksUntil} check{a.checksUntil !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-lg font-bold" style={{ color: AMBER }}>{fmt$(a.savePerCheck)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bills this period */}
      {current.dueBills.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>BILLS THIS PERIOD</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {current.dueBills.map((b, i) => {
              const paid = isPaid(b);
              return (
                <div key={b.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: i < current.dueBills.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div>
                    <p className="text-sm" style={{ color: paid ? MUTED : "#fff", textDecoration: paid ? "line-through" : "none" }}>{b.name}</p>
                    <p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold" style={{ color: paid ? MUTED : RED }}>{fmt$(b.amount)}</p>
                    <button onClick={() => !paid && onMarkBillPaid(b.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: paid ? "rgba(200,255,0,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${paid ? "rgba(200,255,0,0.3)" : BORDER}` }}>
                      {paid ? <Check size={13} style={{ color: LIME }} /> : <span style={{ fontSize: 11, color: MUTED }}>✓</span>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* P2P Transfers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>ZELLE · VENMO · CASHAPP</p>
          <button onClick={() => setShowP2P(!showP2P)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Log
          </button>
        </div>
        {showP2P && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setP2pDir("sent")} className="py-2.5 rounded-xl text-sm font-semibold"
                  style={p2pDir === "sent" ? { background: RED, color: "#fff" } : { background: "rgba(255,255,255,0.07)", color: MUTED }}>↑ Sent</button>
                <button onClick={() => setP2pDir("received")} className="py-2.5 rounded-xl text-sm font-semibold"
                  style={p2pDir === "received" ? { background: LIME, color: "#000" } : { background: "rgba(255,255,255,0.07)", color: MUTED }}>↓ Received</button>
              </div>
              <input value={p2pPerson} onChange={e => setP2pPerson(e.target.value)} placeholder="Person"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={p2pAmount} onChange={e => setP2pAmount(e.target.value)} placeholder="Amount ($)"
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <select value={p2pPlatform} onChange={e => setP2pPlatform(e.target.value as P2PTransfer["platform"])}
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                  <option value="zelle">Zelle</option><option value="venmo">Venmo</option>
                  <option value="cashapp">CashApp</option><option value="cash">Cash</option><option value="other">Other</option>
                </select>
              </div>
              <input value={p2pNote} onChange={e => setP2pNote(e.target.value)} placeholder="Note (optional)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <button onClick={addP2P} disabled={!p2pPerson || !p2pAmount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>Log It</button>
          </div>
        )}
        {p2pTransfers.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {p2pTransfers.slice(0, 10).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < Math.min(p2pTransfers.length, 10) - 1 ? `1px solid ${BORDER}` : undefined }}>
                <div>
                  <p className="text-sm text-white">{t.direction === "sent" ? "↑" : "↓"} {t.person}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{t.platform} · {t.date}{t.note ? ` · ${t.note}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: t.direction === "sent" ? RED : LIME }}>
                    {t.direction === "sent" ? "-" : "+"}{fmt$(t.amount)}
                  </p>
                  <button onClick={() => onRemoveP2P(t.id)}><Trash2 size={11} style={{ color: MUTED }} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {p2pTransfers.length === 0 && !showP2P && (
          <p className="text-xs text-center py-2" style={{ color: MUTED }}>No transfers logged yet</p>
        )}
      </div>
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab({ selfCare, bills, pc, budgetLines, effectiveTakeHome, insights, onUpdateCare, onUpdateBills, onUpdateBudgetLines, onUpdatePc, showToast }: {
  selfCare: SelfCareItem[]; bills: RecurringBill[]; pc: PaycheckConfig;
  budgetLines: BudgetLine[]; effectiveTakeHome: number;
  insights: InsightsData | null;
  onUpdateCare: (i: SelfCareItem[]) => void; onUpdateBills: (b: RecurringBill[]) => void;
  onUpdateBudgetLines: (bl: BudgetLine[]) => void;
  onUpdatePc: (p: PaycheckConfig) => void; showToast: (m: string) => void;
}) {
  const [showCareForm, setShowCareForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [name, setName]                 = useState("");
  const [emoji, setEmoji]               = useState("💄");
  const [cost, setCost]                 = useState("");
  const [freqWeeks, setFreqWeeks]       = useState("4");
  const [billName, setBillName]         = useState("");
  const [billAmt, setBillAmt]           = useState("");
  const [billDay, setBillDay]           = useState("1");
  const [editPay, setEditPay]           = useState(false);
  const [payInput, setPayInput]         = useState(String(pc.takeHomePerCheck));
  const [editSavings, setEditSavings]   = useState(false);
  const [savingsPct, setSavingsPct]     = useState(String(pc.savingsPercent));
  const [editEmployer, setEditEmployer] = useState(false);
  const [employerInput, setEmployerInput] = useState(pc.employer ?? "");
  const [editProjected, setEditProjected] = useState(false);
  const [projectedInput, setProjectedInput] = useState(String(pc.projectedTakeHome ?? pc.takeHomePerCheck));
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetLabel, setBudgetLabel]   = useState("");
  const [budgetAmt, setBudgetAmt]       = useState("");
  const [budgetCat, setBudgetCat]       = useState<BudgetLine["category"]>("other");
  const [budgetToAcct, setBudgetToAcct] = useState("");

  const addBudgetLine = () => {
    if (!budgetLabel || !budgetAmt) return;
    onUpdateBudgetLines([...budgetLines, {
      id: id(), label: budgetLabel, amountPerCheck: parseFloat(budgetAmt),
      category: budgetCat, toAccount: budgetToAcct || undefined,
    }]);
    setBudgetLabel(""); setBudgetAmt(""); setBudgetToAcct(""); setShowBudgetForm(false);
    showToast("Added to paycheck breakdown!");
  };

  const addDetectedSplit = (split: { toAccount: string; amount: number }) => {
    onUpdateBudgetLines([...budgetLines, {
      id: id(), label: split.toAccount + " Transfer", amountPerCheck: split.amount,
      category: "transfer", toAccount: split.toAccount, isDetected: true,
    }]);
    showToast("Added: " + split.toAccount);
  };

  const markDone = (item: SelfCareItem) => {
    onUpdateCare(selfCare.map(i => i.id === item.id ? { ...i, lastDone: format(new Date(), "yyyy-MM-dd") } : i));
    showToast(`${item.name} — marked done!`);
  };

  const addCare = () => {
    if (!name || !cost) return;
    onUpdateCare([...selfCare, { id: id(), name, emoji, cost: parseFloat(cost), frequencyWeeks: parseInt(freqWeeks), color: COLORS[selfCare.length % COLORS.length] }]);
    setName(""); setCost(""); setFreqWeeks("4"); setEmoji("💄"); setShowCareForm(false);
    showToast("Added!");
  };

  const addBill = () => {
    if (!billName || !billAmt) return;
    onUpdateBills([...bills, { id: id(), name: billName, amount: parseFloat(billAmt), dayOfMonth: parseInt(billDay) }]);
    setBillName(""); setBillAmt(""); setBillDay("1"); setShowBillForm(false);
    showToast("Bill added!");
  };

  const monthlyBills = bills.reduce((s, b) => s + b.amount, 0);
  const detectedAmount = insights?.paycheck?.amount;

  return (
    <div className="space-y-6">
      {/* Income section */}
      <div>
        <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>YOUR INCOME</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {/* Employer */}
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white flex-shrink-0">Employer</p>
              {editEmployer ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input value={employerInput} onChange={e => setEmployerInput(e.target.value)}
                    placeholder="e.g. HCA Healthcare"
                    className="rounded-lg px-3 py-1.5 text-sm text-white outline-none w-40"
                    style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                  <button onClick={() => {
                    onUpdatePc({ ...pc, employer: employerInput.trim() || undefined });
                    setEditEmployer(false); showToast("Updated!");
                  }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{pc.employer || <span style={{ color: MUTED }}>Not set</span>}</p>
                  <button onClick={() => setEditEmployer(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
          </div>

          {/* Detected amount */}
          {detectedAmount && (
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: MUTED }}>Detected (Plaid)</p>
                <p className="text-sm font-semibold text-white">{fmt$(detectedAmount)}</p>
              </div>
            </div>
          )}

          {/* This check (detected) */}
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white flex-shrink-0">This check</p>
              {editPay ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white">$</span>
                    <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)}
                      className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                  </div>
                  <button onClick={() => { onUpdatePc({ ...pc, takeHomePerCheck: parseFloat(payInput) || pc.takeHomePerCheck }); setEditPay(false); showToast("Updated!"); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">
                    {fmt$(pc.takeHomePerCheck)}
                    {detectedAmount && <span className="ml-1 text-xs font-normal" style={{ color: MUTED }}>(detected)</span>}
                  </p>
                  <button onClick={() => setEditPay(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
          </div>

          {/* Projected take-home */}
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-white flex-shrink-0">Projected</p>
                {pc.projectedTakeHome && (
                  <p className="text-xs" style={{ color: AMBER }}>Used for calculations</p>
                )}
              </div>
              {editProjected ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white">$</span>
                    <input type="number" value={projectedInput} onChange={e => setProjectedInput(e.target.value)}
                      placeholder="Expected amount"
                      className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                  </div>
                  <button onClick={() => {
                    const val = parseFloat(projectedInput);
                    onUpdatePc({ ...pc, projectedTakeHome: val && val !== pc.takeHomePerCheck ? val : undefined });
                    setEditProjected(false); showToast("Updated!");
                  }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">
                    {pc.projectedTakeHome ? fmt$(pc.projectedTakeHome) : <span style={{ color: MUTED }}>Not set</span>}
                  </p>
                  <button onClick={() => setEditProjected(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>
                    {pc.projectedTakeHome ? "Edit" : "Set"}
                  </button>
                  {pc.projectedTakeHome && (
                    <button onClick={() => { onUpdatePc({ ...pc, projectedTakeHome: undefined }); showToast("Cleared."); }}
                      className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(218,102,123,0.1)", color: RED }}>
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Savings */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white flex-shrink-0">Savings</p>
              {editSavings ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {["5","10","15","20"].map(p => (
                      <button key={p} onClick={() => setSavingsPct(p)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={savingsPct === p ? { background: LIME, color: "#000" } : { background: "rgba(255,255,255,0.07)", color: MUTED }}>{p}%</button>
                    ))}
                  </div>
                  <button onClick={() => { onUpdatePc({ ...pc, savingsPercent: parseInt(savingsPct) }); setEditSavings(false); showToast("Updated!"); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{pc.savingsPercent}% · {fmt$(Math.round(pc.takeHomePerCheck * pc.savingsPercent / 100))}</p>
                  <button onClick={() => setEditSavings(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <RentAfford pc={pc} />
      </div>

      {/* Paycheck Breakdown (budget lines waterfall) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>PAYCHECK BREAKDOWN</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Where your check goes each pay period</p>
          </div>
          <button onClick={() => setShowBudgetForm(!showBudgetForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Add
          </button>
        </div>

        {/* Detected BofA / transfer splits */}
        {(insights?.paycheckSplits ?? []).filter(s => !budgetLines.some(l => l.isDetected && l.toAccount === s.toAccount)).length > 0 && (
          <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: "rgba(200,255,0,0.04)", border: `1px solid rgba(200,255,0,0.15)` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: LIME }}>Detected recurring transfer{(insights!.paycheckSplits!.length > 1) ? "s" : ""}:</p>
            {(insights!.paycheckSplits!).filter(s => !budgetLines.some(l => l.isDetected && l.toAccount === s.toAccount)).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm text-white">🏦 {s.toAccount}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{fmt$(s.amount)}/check · detected {s.count}x</p>
                </div>
                <button onClick={() => addDetectedSplit(s)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: LIME, color: "#000" }}>
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Waterfall card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {/* Paycheck row */}
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <p className="text-sm font-semibold text-white">💵 Paycheck</p>
            <p className="text-sm font-bold text-white">{fmt$(effectiveTakeHome)}</p>
          </div>

          {/* Savings row */}
          {pc.savingsPercent > 0 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-sm" style={{ color: "#6B8CAE" }}>💰 Savings ({pc.savingsPercent}%)</p>
              <p className="text-sm font-semibold" style={{ color: "#6B8CAE" }}>−{fmt$(Math.round(effectiveTakeHome * pc.savingsPercent / 100))}</p>
            </div>
          )}

          {/* Budget lines */}
          {budgetLines.map((line) => (
            <div key={line.id} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm text-white truncate">
                  {getCategoryEmoji(line.category)} {line.label}
                </p>
                {line.isDetected && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(200,255,0,0.1)", color: LIME }}>auto</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: RED }}>−{fmt$(line.amountPerCheck)}</p>
                <button onClick={() => { onUpdateBudgetLines(budgetLines.filter(l => l.id !== line.id)); showToast("Removed"); }}>
                  <Trash2 size={11} style={{ color: MUTED }} />
                </button>
              </div>
            </div>
          ))}

          {budgetLines.length === 0 && pc.savingsPercent === 0 && (
            <div className="px-4 py-3 text-center" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Add allocations like rent, BofA transfer, groceries…</p>
            </div>
          )}

          {/* Free to spend */}
          <div className="flex items-center justify-between px-4 py-3.5" style={{ background: "rgba(200,255,0,0.03)" }}>
            <p className="text-sm font-semibold" style={{ color: LIME }}>Yours to spend</p>
            <p className="text-lg font-bold" style={{ color: LIME }}>
              {fmt$(Math.max(0, effectiveTakeHome
                - Math.round(effectiveTakeHome * pc.savingsPercent / 100)
                - budgetLines.reduce((s, l) => s + l.amountPerCheck, 0)))}
            </p>
          </div>
        </div>

        {/* Add budget line form */}
        {showBudgetForm && (
          <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <input value={budgetLabel} onChange={e => setBudgetLabel(e.target.value)} placeholder="Label (e.g. Rent, BofA Transfer)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={budgetAmt} onChange={e => setBudgetAmt(e.target.value)} placeholder="Per check ($)"
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <select value={budgetCat} onChange={e => setBudgetCat(e.target.value as BudgetLine["category"])}
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                  <option value="housing">🏠 Housing</option>
                  <option value="transfer">🏦 Bank Transfer</option>
                  <option value="food">🛒 Food</option>
                  <option value="transport">🚗 Transport</option>
                  <option value="utilities">💡 Utilities</option>
                  <option value="savings">💰 Savings</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>
              <input value={budgetToAcct} onChange={e => setBudgetToAcct(e.target.value)} placeholder="To account (optional, e.g. Bank of America)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <button onClick={addBudgetLine} disabled={!budgetLabel || !budgetAmt}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>Add to Breakdown</button>
          </div>
        )}
      </div>

      {/* Self-care rotation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>SELF-CARE ROTATION</p>
          <button onClick={() => setShowCareForm(!showCareForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Add
          </button>
        </div>

        {selfCare.length === 0 && !showCareForm && (
          <div className="rounded-2xl p-5 text-center mb-3" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>Add hair, nails, facials — anything you do on a schedule. Each check gets one focus item.</p>
          </div>
        )}

        <div className="space-y-2">
          {selfCare.map(item => {
            const isEditing = editId === item.id;
            return (
              <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>
                        {fmt$(item.cost)} · every {item.frequencyWeeks} wk{item.frequencyWeeks !== 1 ? "s" : ""}
                        {item.lastDone ? ` · last done ${format(parseISO(item.lastDone), "MMM d")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => markDone(item)} className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(200,255,0,0.1)", color: LIME }}>Done</button>
                    <button onClick={() => setEditId(isEditing ? null : item.id)} className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.07)", color: MUTED }}>Edit</button>
                    <button onClick={() => onUpdateCare(selfCare.filter(i => i.id !== item.id))}>
                      <Trash2 size={13} style={{ color: MUTED }} />
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <div className="px-4 pb-3 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: MUTED }}>Cost ($)</label>
                        <input type="number" defaultValue={item.cost} id={`cost-${item.id}`}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: MUTED }}>Every N weeks</label>
                        <input type="number" defaultValue={item.frequencyWeeks} id={`freq-${item.id}`}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                      </div>
                    </div>
                    <button onClick={() => {
                      const c = parseFloat((document.getElementById(`cost-${item.id}`) as HTMLInputElement)?.value) || item.cost;
                      const f = parseInt((document.getElementById(`freq-${item.id}`) as HTMLInputElement)?.value) || item.frequencyWeeks;
                      onUpdateCare(selfCare.map(i => i.id === item.id ? { ...i, cost: c, frequencyWeeks: f } : i));
                      setEditId(null); showToast("Updated!");
                    }} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#000" }}>Save</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showCareForm && (
          <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
                  className="w-14 rounded-xl px-2 py-3 text-xl text-center text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Waxing, Lashes"
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
                  {[["1","Weekly"],["2","Every 2 wks"],["3","Every 3 wks"],["4","Every 4 wks"],["6","Every 6 wks"],["8","Every 8 wks"],["12","Every 12 wks"]].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={addCare} disabled={!name || !cost}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>Add to Rotation</button>
          </div>
        )}
      </div>

      {/* Bills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>RECURRING BILLS</p>
          <button onClick={() => setShowBillForm(!showBillForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Add
          </button>
        </div>
        {bills.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {bills.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < bills.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                <div>
                  <p className="text-sm text-white">{b.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)}</p>
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
              style={{ background: "rgba(255,255,255,0.02)", borderTop: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Monthly total</p>
              <p className="text-sm font-bold text-white">{fmt$(monthlyBills)}/mo</p>
            </div>
          </div>
        )}
        {bills.length === 0 && !showBillForm && (
          <div className="rounded-2xl p-5 text-center mb-2" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>Add rent, subscriptions, utilities — anything due monthly.</p>
          </div>
        )}
        {showBillForm && (
          <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <input value={billName} onChange={e => setBillName(e.target.value)} placeholder="Name (e.g. Rent, Phone)"
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
              style={{ background: LIME, color: "#000" }}>Add Bill</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rent Affordability ────────────────────────────────────────────────────────
function RentAfford({ pc }: { pc: PaycheckConfig }) {
  const [targetRent, setTargetRent] = useState("");
  const effectiveTakeHome = pc.projectedTakeHome ?? pc.takeHomePerCheck;
  const monthlyIncome = (effectiveTakeHome * 26) / 12;
  const rentPct = targetRent ? (parseFloat(targetRent) / monthlyIncome) * 100 : 0;
  const verdict = rentPct === 0 ? null
    : rentPct <= 25 ? { text: "Comfortable", color: LIME }
    : rentPct <= 30 ? { text: "Manageable", color: "#8A9E87" }
    : rentPct <= 35 ? { text: "Stretching it", color: AMBER }
    :                 { text: "Too much", color: RED };

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>RENT AFFORDABILITY</p>
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-xs mb-3" style={{ color: MUTED }}>Based on {fmt$(Math.round(monthlyIncome))}/month take-home:</p>
        <div className="space-y-1.5 mb-4">
          {[
            { label: "Comfortable (25%)", amount: Math.round(monthlyIncome * 0.25), color: LIME },
            { label: "Standard (30%)",    amount: Math.round(monthlyIncome * 0.30), color: "#8A9E87" },
            { label: "Max (35%)",         amount: Math.round(monthlyIncome * 0.35), color: RED },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
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
        {verdict && targetRent && (
          <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-sm font-semibold" style={{ color: verdict.color }}>
              {verdict.text} — {Math.round(rentPct)}% of take-home
            </p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              {fmt$(Math.round(monthlyIncome - parseFloat(targetRent)))} left after rent each month.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accounts Tab ──────────────────────────────────────────────────────────────
function AccountsTab({ accounts, loadingAccts, refreshing, accountTransfers, onRefresh, onDisconnect, onConnected, onAddTransfer, onRemoveTransfer }: {
  accounts: PlaidAccount[]; loadingAccts: boolean; refreshing: boolean;
  accountTransfers: AccountTransfer[];
  onRefresh: () => void; onDisconnect: (itemId?: string) => void; onConnected: () => void;
  onAddTransfer: (t: AccountTransfer) => void; onRemoveTransfer: (tid: string) => void;
}) {
  const [showForm, setShowForm]   = useState(false);
  const [fromAcct, setFromAcct]   = useState("Checking");
  const [toAcct, setToAcct]       = useState("Savings");
  const [amount, setAmount]       = useState("");
  const [purpose, setPurpose]     = useState("");

  const knownAccounts = Array.from(new Set(["Checking","Savings","Emergency Fund",...accounts.map(a => a.name)]));

  const addTransfer = () => {
    if (!amount) return;
    onAddTransfer({ id: id(), date: format(new Date(), "yyyy-MM-dd"), fromAccount: fromAcct, toAccount: toAcct, amount: parseFloat(amount), purpose: purpose || undefined });
    setAmount(""); setPurpose(""); setShowForm(false);
  };

  const byInst: Record<string, PlaidAccount[]> = {};
  for (const a of accounts) { const k = a.institutionName ?? "Unknown Bank"; (byInst[k] ??= []).push(a); }

  return (
    <div className="space-y-4">
      {loadingAccts && accounts.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: MUTED }}>Loading accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: MUTED }}>Connect your bank to see live balances.</p>
          <PlaidConnectButton onConnected={onConnected} />
        </div>
      ) : (
        <>
          {Object.entries(byInst).map(([inst, accts]) => (
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
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <div className="flex-1"><PlaidConnectButton onConnected={onConnected} /></div>
          </div>
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>ACCOUNT TRANSFERS</p>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            <Plus size={12} /> Log move
          </button>
        </div>
        {showForm && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>From</label>
                  <select value={fromAcct} onChange={e => setFromAcct(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                    {knownAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>To</label>
                  <select value={toAcct} onChange={e => setToAcct(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }}>
                    {knownAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount ($)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
              <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose (optional)"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <button onClick={addTransfer} disabled={!amount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#000" }}>Log Transfer</button>
          </div>
        )}
        {accountTransfers.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {accountTransfers.slice(0, 15).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < Math.min(accountTransfers.length, 15) - 1 ? `1px solid ${BORDER}` : undefined }}>
                <div>
                  <p className="text-sm text-white">{t.fromAccount} → {t.toAccount}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{t.date}{t.purpose ? ` · ${t.purpose}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: LIME }}>{fmt$(t.amount)}</p>
                  <button onClick={() => onRemoveTransfer(t.id)}><Trash2 size={11} style={{ color: MUTED }} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {accountTransfers.length === 0 && !showForm && (
          <p className="text-xs text-center py-2" style={{ color: MUTED }}>No account transfers logged</p>
        )}
      </div>
    </div>
  );
}
