"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, Plus, Trash2, Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { DashboardData, PaycheckConfig, SelfCareItem, RecurringBill, P2PTransfer, AccountTransfer, BudgetLine, CreditScoreEntry } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { parseISO, format, addDays, differenceInDays } from "date-fns";

const LIME   = "#7C5CFC";   // purple primary (was lime)
const BG     = "#F4F0FE";   // light lavender bg
const CARD   = "#FFFFFF";   // white card
const BORDER = "rgba(124,92,252,0.12)";
const MUTED  = "rgba(30,19,64,0.45)";
const RED    = "#EF4444";
const AMBER  = "#F59E0B";
const COLORS = ["#7C5CFC","#EF4444","#E879F9","#FB923C","#10B981","#F59E0B","#6366F1","#EC4899"];

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
interface CreditCardLiability {
  accountId: string; name: string; balance: number; creditLimit: number | null;
  utilization: number | null; minimumPayment: number | null; nextDueDate: string | null;
  purchaseApr: number | null; isOverdue: boolean;
}
interface StudentLoanLiability {
  accountId: string; name: string; outstandingBalance: number; interestRate: number | null;
  minimumPayment: number | null; nextDueDate: string | null; expectedPayoffDate: string | null;
  isOverdue: boolean;
}
interface LiabilitiesData {
  hasData: boolean;
  creditCards: CreditCardLiability[];
  studentLoans: StudentLoanLiability[];
  totalDebt: number;
  totalMinPayments: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FREQ_OPTIONS: [string, string][] = [
  ["1",  "Weekly"],
  ["2",  "Bi-weekly"],
  ["3",  "Every 3 wks"],
  ["4",  "Every 4 wks / Monthly"],
  ["6",  "Every 6 wks"],
  ["8",  "Every 8 wks"],
  ["13", "Quarterly"],
  ["26", "Semi-annual"],
  ["52", "Annual"],
];

function freqLabel(weeks: number, label?: string): string {
  if (label) return label;
  if (weeks === 1) return "weekly";
  if (weeks === 2) return "bi-weekly";
  if (weeks === 4) return "monthly";
  if (weeks === 13) return "quarterly";
  if (weeks === 26) return "semi-annual";
  if (weeks === 52) return "annual";
  return `every ${weeks} wks`;
}

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
    }).filter(s => s.urgency >= 0.8).sort((a, b) => {
      const urgencyDiff = b.urgency - a.urgency;
      if (Math.abs(urgencyDiff) > 0.05) return urgencyDiff;
      return (a.item.priority ?? 999) - (b.item.priority ?? 999);
    });

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

// Normalize a stored nextPayday to the nearest upcoming payday from today.
// Walks the 14-day cycle backward if the stored date is far in the future,
// or forward if it's in the past, so it always lands within 0-14 days ahead.
function getEffectivePayday(nextPayday: string): Date {
  const anchor = parseISO(nextPayday);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  let d = new Date(anchor.getTime());
  // Step backward while more than 14 days ahead of today
  while (differenceInDays(d, today) > 14) d = addDays(d, -14);
  // Step forward while still in the past
  while (differenceInDays(d, today) < 0)  d = addDays(d, 14);
  return d;
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

function calcHealthGrade(
  pc: PaycheckConfig,
  liabilities: LiabilitiesData | null,
  creditScores: CreditScoreEntry[],
  budgetLines: BudgetLine[]
) {
  const annualIncome = (pc.projectedTakeHome ?? pc.takeHomePerCheck) * 26;
  const savingsScore  = Math.min(100, (pc.savingsPercent / 20) * 100);
  const totalDebt     = liabilities?.totalDebt ?? 0;
  const dti           = annualIncome > 0 ? totalDebt / annualIncome : 0;
  const dtiScore      = totalDebt === 0 ? 100 : Math.max(0, Math.round(100 - dti * 100));
  const cards         = liabilities?.creditCards ?? [];
  const avgUtil       = cards.length > 0 ? cards.reduce((s, c) => s + (c.utilization ?? 50), 0) / cards.length : null;
  const utilScore     = avgUtil === null ? 60 : Math.max(0, Math.round(100 - avgUtil * 1.5));
  const sortedScores  = [...creditScores].sort((a, b) => b.date.localeCompare(a.date));
  const latestScore   = sortedScores[0]?.score ?? null;
  const creditNorm    = latestScore === null ? 60 : Math.round(((latestScore - 300) / 550) * 100);
  const setupScore    = Math.min(100, (budgetLines.length > 0 ? 50 : 0) + (creditScores.length > 0 ? 30 : 0) + 20);
  const total         = Math.round(savingsScore * 0.25 + dtiScore * 0.25 + utilScore * 0.20 + creditNorm * 0.20 + setupScore * 0.10);
  const grade = total >= 93 ? "A+" : total >= 87 ? "A" : total >= 80 ? "A−" :
                total >= 77 ? "B+" : total >= 73 ? "B" : total >= 70 ? "B−" :
                total >= 67 ? "C+" : total >= 63 ? "C" : total >= 60 ? "C−" :
                total >= 57 ? "D+" : total >= 53 ? "D" : "F";
  const gradeColor = total >= 80 ? LIME : total >= 65 ? "#8A9E87" : total >= 50 ? AMBER : RED;
  return {
    grade, total, gradeColor,
    factors: [
      { label: "Savings Rate",       score: Math.round(savingsScore), detail: `${pc.savingsPercent}%/check` },
      { label: "Debt-to-Income",     score: dtiScore,                 detail: totalDebt === 0 ? "No debt" : `${Math.round(dti * 100)}% ratio` },
      { label: "Credit Utilization", score: utilScore,                detail: avgUtil === null ? "No data" : `${Math.round(avgUtil)}% avg` },
      { label: "Credit Score",       score: creditNorm,               detail: latestScore === null ? "Not logged" : String(latestScore) },
      { label: "Budget Setup",       score: Math.round(setupScore),   detail: `${budgetLines.length} allocations` },
    ],
  };
}

// ── Health Grade Ring ─────────────────────────────────────────────────────────
function HealthGradeRing({ grade, score, color, size = 96 }: { grade: string; score: number; color: string; size?: number }) {
  const cx = size / 2, cy = size / 2, r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const offset = circ * 0.25;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(124,92,252,0.15)" strokeWidth={7} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={grade.length > 2 ? 15 : 20} fontWeight="bold" fontFamily="system-ui, sans-serif">
        {grade}
      </text>
    </svg>
  );
}

// ── Year Calendar ─────────────────────────────────────────────────────────────
function YearCalendar({ yearPlan, effectiveTakeHome, budgetLines, pc }: {
  yearPlan: CheckSlot[];
  effectiveTakeHome: number;
  budgetLines: BudgetLine[];
  pc: PaycheckConfig;
}) {
  const today      = new Date();
  const currentYear = today.getFullYear();
  const [selMonth, setSelMonth]   = useState(today.getMonth());
  const [selSlot,  setSelSlot]    = useState<CheckSlot | null>(null);

  const months = Array.from({ length: 12 - today.getMonth() }, (_, i) => today.getMonth() + i);

  const checkMap = new Map<string, CheckSlot>();
  for (const slot of yearPlan) checkMap.set(format(slot.checkDate, "yyyy-MM-dd"), slot);

  const firstDay  = new Date(currentYear, selMonth, 1);
  const lastDay   = new Date(currentYear, selMonth + 1, 0);
  const startDow  = firstDay.getDay();
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    const dateStr = format(new Date(currentYear, selMonth, dayNum), "yyyy-MM-dd");
    return { dayNum, dateStr, slot: checkMap.get(dateStr) ?? null };
  });

  return (
    <div>
      {/* Month pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
        {months.map(m => (
          <button key={m} onClick={() => { setSelMonth(m); setSelSlot(null); }}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold"
            style={selMonth === m ? { background: LIME, color: "#fff"} : { background: "rgba(124,92,252,0.07)", color: MUTED }}>
            {format(new Date(currentYear, m, 1), "MMM")}
          </button>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-xs py-1 font-semibold" style={{ color: MUTED }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />;
          const { dayNum, dateStr, slot } = cell;
          const isToday   = dateStr === format(today, "yyyy-MM-dd");
          const isPast    = new Date(dateStr) < today;
          const item      = slot?.focusItem ?? slot?.pushedItem;
          const isPushed  = slot && !slot.focusItem && !!slot.pushedItem;
          const dotColor  = slot ? (slot.canAfford ? LIME : isPushed ? AMBER : RED) : null;
          const isSel     = selSlot ? format(selSlot.checkDate, "yyyy-MM-dd") === dateStr : false;
          return (
            <button key={i} onClick={() => slot && setSelSlot(isSel ? null : slot)} disabled={!slot}
              className="aspect-square flex flex-col items-center justify-center rounded-lg transition-all"
              style={{
                background: isSel ? "rgba(124,92,252,0.15)" : slot ? "rgba(124,92,252,0.05)" : "transparent",
                border: isSel ? `1px solid rgba(124,92,252,0.45)` : isToday ? `1px solid rgba(124,92,252,0.35)` : "1px solid transparent",
                opacity: isPast && !slot ? 0.35 : 1,
              }}>
              <span className="text-xs leading-none" style={{ color: isToday ? LIME : "var(--text)", fontWeight: slot ? 700 : 400 }}>{dayNum}</span>
              {item   && <span className="text-xs leading-none mt-0.5">{item.emoji}</span>}
              {!item && dotColor && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: dotColor }} />}
            </button>
          );
        })}
      </div>

      {/* Waterfall detail */}
      {selSlot && (
        <div className="mt-3 rounded-2xl p-4" style={{ background: "rgba(124,92,252,0.05)", border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold mb-3" style={{ color: LIME, letterSpacing: "0.08em" }}>
            {format(selSlot.checkDate, "MMM d").toUpperCase()}
            {pc.employer ? ` · ${pc.employer.toUpperCase()}` : ""}
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span style={{ color: MUTED }}>💵 Paycheck</span><span className="font-bold">{fmt$(effectiveTakeHome)}</span></div>
            {selSlot.savings > 0 && (
              <div className="flex justify-between"><span style={{ color: "#9B7FFF" }}>💰 Savings ({pc.savingsPercent}%)</span><span className="font-semibold" style={{ color: "#9B7FFF" }}>−{fmt$(selSlot.savings)}</span></div>
            )}
            {budgetLines.map(l => (
              <div key={l.id} className="flex justify-between"><span style={{ color: MUTED }}>{getCategoryEmoji(l.category)} {l.label}</span><span className="font-semibold" style={{ color: AMBER }}>−{fmt$(l.amountPerCheck)}</span></div>
            ))}
            {selSlot.billsTotal > 0 && (
              <div className="flex justify-between"><span style={{ color: MUTED }}>🧾 Bills</span><span className="font-semibold" style={{ color: AMBER }}>−{fmt$(selSlot.billsTotal)}</span></div>
            )}
            <div className="border-t pt-2" style={{ borderColor: BORDER }}>
              <div className="flex justify-between"><span style={{ color: MUTED }}>Available</span><span className="font-bold">{fmt$(selSlot.free)}</span></div>
            </div>
            {selSlot.focusItem && (
              <>
                <div className="flex justify-between">
                  <span style={{ color: selSlot.canAfford ? LIME : RED }}>{selSlot.focusItem.emoji} {selSlot.focusItem.name}</span>
                  <span className="font-semibold" style={{ color: selSlot.canAfford ? LIME : RED }}>−{fmt$(selSlot.focusItem.cost)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor: BORDER }}>
                  <span style={{ color: MUTED }}>Yours after</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold" style={{ color: selSlot.canAfford ? LIME : RED }}>{fmt$(Math.max(0, selSlot.free - selSlot.focusItem.cost))}</span>
                    {selSlot.canAfford && <span>✅</span>}
                    {!selSlot.canAfford && <span style={{ color: RED }}>⚠️</span>}
                  </div>
                </div>
              </>
            )}
            {selSlot.pushedItem && !selSlot.focusItem && (
              <div className="pt-1 space-y-1.5">
                <p className="text-xs" style={{ color: AMBER }}>{selSlot.pushedItem.emoji} {selSlot.pushedItem.name} pushed{selSlot.pushedTo ? ` → ${fmtDate(selSlot.pushedTo)}` : ""}</p>
                <div className="flex justify-between"><span style={{ color: MUTED }}>Yours after</span><span className="text-lg font-bold">{fmt$(selSlot.free)}</span></div>
              </div>
            )}
            {!selSlot.focusItem && !selSlot.pushedItem && (
              <div className="flex justify-between pt-1"><span style={{ color: MUTED }}>Yours after</span><span className="text-lg font-bold">{fmt$(selSlot.free)}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function AIChat({ pc, yearPlan, budgetLines, liabilities, creditScores }: {
  pc: PaycheckConfig;
  yearPlan: CheckSlot[];
  budgetLines: BudgetLine[];
  liabilities: LiabilitiesData | null;
  creditScores: CreditScoreEntry[];
}) {
  const [q,    setQ]    = useState("");
  const [msgs, setMsgs] = useState<{ role: "user"|"ai"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const effectiveTakeHome = pc.projectedTakeHome ?? pc.takeHomePerCheck;
  const slot0 = yearPlan[0];
  const latestScore = [...creditScores].sort((a, b) => b.date.localeCompare(a.date))[0]?.score;

  const ask = async () => {
    if (!q.trim() || busy) return;
    const question = q.trim(); setQ("");
    setMsgs(m => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const ctx = {
        question,
        takeHome: effectiveTakeHome,
        freeCash: slot0?.free ?? 0,
        savings: slot0?.savings ?? 0,
        billsTotal: slot0?.billsTotal ?? 0,
        budgetLines: budgetLines.map(l => ({ label: l.label, amount: l.amountPerCheck })),
        upcomingServices: yearPlan.slice(0, 6).filter(s => s.focusItem).map(s => ({
          name: s.focusItem!.name, cost: s.focusItem!.cost,
          date: format(s.checkDate, "MMM d"), canAfford: s.canAfford,
        })),
        totalDebt: liabilities?.totalDebt ?? 0,
        creditScore: latestScore,
        employer: pc.employer,
      };
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ctx) });
      const j = await res.json();
      setMsgs(m => [...m, { role: "ai", text: j.answer ?? "Couldn't answer that." }]);
    } catch {
      setMsgs(m => [...m, { role: "ai", text: "Something went wrong — try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>ASK YOUR MONEY</p>
        {msgs.length === 0 && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-light)" }}>
            &ldquo;Can I afford a $200 massage?&rdquo; · &ldquo;When can I get lashes?&rdquo;
          </p>
        )}
      </div>
      {msgs.length > 0 && (
        <div className="px-4 pb-2 space-y-2 max-h-44 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[88%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                style={m.role === "user"
                  ? { background: "rgba(124,92,252,0.12)", color: LIME }
                  : { background: "rgba(124,92,252,0.07)", color: "var(--text)" }}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="px-3 py-2.5 rounded-xl flex gap-1" style={{ background: "rgba(124,92,252,0.07)" }}>
                {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: MUTED, animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}
      <div className="px-3 pb-3 flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="Ask anything about your budget…"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
        <button onClick={ask} disabled={!q.trim() || busy}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: LIME, color: "#fff"}}>Ask</button>
      </div>
      <p className="text-xs text-right px-4 pb-2.5" style={{ color: "var(--text-light)" }}>powered by Claude</p>
    </div>
  );
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
      style={{ background: LIME, color: "#fff"}}>
      {fetching ? "Preparing…" : "+ Connect Bank Account"}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props { data: DashboardData; update: (fn: (d: DashboardData) => DashboardData) => void; }

export function FinancesView({ data, update }: Props) {
  const [tab, setTab]                       = useState<"health"|"flow"|"credit"|"debt">("flow");
  const [toast, setToast]                   = useState<string | null>(null);
  const [insights, setInsights]             = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [accounts, setAccounts]             = useState<PlaidAccount[]>([]);
  const [loadingAccts, setLoadingAccts]     = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [showBanner, setShowBanner]         = useState(false);
  const [liabilities, setLiabilities]       = useState<LiabilitiesData | null>(null);
  const [liabilitiesLoading, setLiabilitiesLoading] = useState(true);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Auto-correct a stale nextPayday on mount so the dashboard always
  // anchors to the current pay cycle, not some far-future stored date.
  useEffect(() => {
    if (!pc) return;
    const effectiveStr = format(getEffectivePayday(pc.nextPayday), "yyyy-MM-dd");
    if (effectiveStr !== pc.nextPayday) {
      update(d => d.paycheckConfig
        ? { ...d, paycheckConfig: { ...d.paycheckConfig, nextPayday: effectiveStr } }
        : d
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    fetch("/api/plaid/liabilities").then(r => r.json()).then((d: LiabilitiesData) => {
      setLiabilities(d);
    }).catch(() => {}).finally(() => setLiabilitiesLoading(false));
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
  const payday   = getEffectivePayday(pc.nextPayday);
  const yearPlan      = buildYearPlan(payday, effectiveTakeHome, pc.savingsPercent, selfCare, bills, budgetLines);
  const savingsAlerts = computeSavingsAlerts(yearPlan);
  const health        = calcHealthGrade(pc, liabilities, data.creditScores ?? [], budgetLines);

  const TAB_LABELS: Record<typeof tab, string> = { health: "Health", flow: "Flow", credit: "Credit", debt: "Debt" };

  return (
    <div style={{ background: BG, minHeight: "100%" }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: LIME, letterSpacing: "0.1em" }}>FINANCES</p>
            <h1 className="text-3xl font-bold">{fmt$(effectiveTakeHome)}</h1>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              biweekly{pc.employer ? ` · ${pc.employer}` : ""} · next {fmtDate(payday)}
            </p>
            {pc.projectedTakeHome && <p className="text-xs mt-0.5" style={{ color: AMBER }}>Using projected amount</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <HealthGradeRing grade={health.grade} score={health.total} color={health.gradeColor} size={44} />
              <div className="flex gap-2">
                <button
                  onClick={() => update(d => ({ ...d, paycheckConfig: { ...pc, nextPayday: format(addDays(payday, 14), "yyyy-MM-dd") } }))}
                  className="text-xs px-3 py-1.5 rounded-xl font-medium"
                  style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
                  Got paid ✓
                </button>
                <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-xl"
                  style={{ background: "rgba(124,92,252,0.06)", border: `1px solid ${BORDER}` }}>
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: MUTED }} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(124,92,252,0.05)", border: `1px solid ${BORDER}` }}>
          {(["health","flow","credit","debt"] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={tab === k ? { background: LIME, color: "#fff"} : { color: MUTED }}>
              {TAB_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Insights banner */}
      {showBanner && insights?.selfCare && tab === "flow" && (
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
        {tab === "health" && (
          <HealthTab
            health={health}
            accounts={accounts} loadingAccts={loadingAccts} refreshing={refreshing}
            accountTransfers={accountTransfers}
            yearPlan={yearPlan} effectiveTakeHome={effectiveTakeHome} pc={pc}
            onRefresh={handleRefresh} onDisconnect={handleDisconnect}
            onConnected={() => fetchAccounts(true)}
            onAddTransfer={(t) => update(d => ({ ...d, accountTransfers: [t, ...(d.accountTransfers ?? [])] }))}
            onRemoveTransfer={(tid) => update(d => ({ ...d, accountTransfers: (d.accountTransfers ?? []).filter(t => t.id !== tid) }))}
          />
        )}
        {tab === "flow" && (
          <FlowTab
            yearPlan={yearPlan} savingsAlerts={savingsAlerts}
            pc={pc} effectiveTakeHome={effectiveTakeHome}
            paydayStr={format(payday, "yyyy-MM-dd")}
            budgetLines={budgetLines} bills={bills} selfCare={selfCare}
            insights={insights} p2pTransfers={p2pTransfers}
            liabilities={liabilities} creditScores={data.creditScores ?? []}
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

            onAddP2P={(t) => update(d => ({ ...d, p2pTransfers: [t, ...(d.p2pTransfers ?? [])] }))}
            onRemoveP2P={(tid) => update(d => ({ ...d, p2pTransfers: (d.p2pTransfers ?? []).filter(t => t.id !== tid) }))}
            onUpdateCare={(items) => update(d => ({ ...d, selfCareItems: items }))}
            onUpdateBills={(b) => update(d => ({ ...d, recurringBills: b }))}
            onUpdateBudgetLines={(bl) => update(d => ({ ...d, budgetLines: bl }))}
            onUpdatePc={(p) => update(d => ({ ...d, paycheckConfig: p }))}
            showToast={showToast}
          />
        )}
        {tab === "credit" && (
          <CreditTab
            liabilities={liabilities}
            liabilitiesLoading={liabilitiesLoading}
            creditScores={data.creditScores ?? []}
            effectiveTakeHome={effectiveTakeHome}
            freeCash={yearPlan[0]?.free ?? 0}
            onUpdateScores={(scores) => update(d => ({ ...d, creditScores: scores }))}
          />
        )}
        {tab === "debt" && (
          <DebtTab
            liabilities={liabilities}
            liabilitiesLoading={liabilitiesLoading}
            effectiveTakeHome={effectiveTakeHome}
            freeCash={yearPlan[0]?.free ?? 0}
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

// ── Health Tab ────────────────────────────────────────────────────────────────
function HealthTab({ health, accounts, loadingAccts, refreshing, accountTransfers, yearPlan, effectiveTakeHome, pc, onRefresh, onDisconnect, onConnected, onAddTransfer, onRemoveTransfer }: {
  health: ReturnType<typeof calcHealthGrade>;
  accounts: PlaidAccount[]; loadingAccts: boolean; refreshing: boolean;
  accountTransfers: AccountTransfer[]; yearPlan: CheckSlot[];
  effectiveTakeHome: number; pc: PaycheckConfig;
  onRefresh: () => void; onDisconnect: (itemId?: string) => void; onConnected: () => void;
  onAddTransfer: (t: AccountTransfer) => void; onRemoveTransfer: (tid: string) => void;
}) {
  const summary = yearSummary(yearPlan, effectiveTakeHome);
  return (
    <div className="space-y-5">
      {/* Grade ring */}
      <div className="rounded-3xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-semibold mb-4" style={{ color: MUTED, letterSpacing: "0.1em" }}>FINANCIAL HEALTH</p>
        <div className="flex items-center gap-5 mb-5">
          <HealthGradeRing grade={health.grade} score={health.total} color={health.gradeColor} size={96} />
          <div>
            <p className="text-4xl font-bold" style={{ color: health.gradeColor }}>{health.grade}</p>
            <p className="text-sm font-semibold text-white mt-0.5">{health.total}/100</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Based on your real numbers</p>
          </div>
        </div>
        <div className="space-y-3">
          {health.factors.map(f => (
            <div key={f.label}>
              <div className="flex justify-between mb-1">
                <p className="text-xs" style={{ color: MUTED }}>{f.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs" style={{ color: MUTED }}>{f.detail}</p>
                  <p className="text-xs font-bold w-6 text-right" style={{ color: f.score >= 70 ? LIME : f.score >= 50 ? AMBER : RED }}>{f.score}</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.07)" }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${f.score}%`, background: f.score >= 70 ? LIME : f.score >= 50 ? AMBER : RED }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Year stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Checks Left",     value: String(summary.totalChecks),          sub: "this year" },
          { label: "Income Remaining",value: fmt$(summary.totalIncome),             sub: "projected" },
          { label: "Self-care Planned",value: fmt$(summary.totalTreatments),       sub: "scheduled" },
          { label: "Savings Planned", value: fmt$(summary.totalSavings),           sub: "rest of year" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-xs mb-1" style={{ color: MUTED }}>{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs" style={{ color: MUTED }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <RentAfford pc={pc} />

      <AccountsTab accounts={accounts} loadingAccts={loadingAccts} refreshing={refreshing}
        accountTransfers={accountTransfers} onRefresh={onRefresh} onDisconnect={onDisconnect}
        onConnected={onConnected} onAddTransfer={onAddTransfer} onRemoveTransfer={onRemoveTransfer} />
    </div>
  );
}

// ── Edit Care Inline ──────────────────────────────────────────────────────────
function EditCareInline({ item, onSave }: { item: SelfCareItem; onSave: (cost: number, freqWeeks: number, freqLabel: string) => void }) {
  const [cost, setCost]   = useState(String(item.cost));
  const opt = FREQ_OPTIONS.find(([v]) => v === String(item.frequencyWeeks));
  const [freqW, setFreqW] = useState(opt ? opt[0] : "4");
  return (
    <div className="px-4 pb-3 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs mb-1 block" style={{ color: MUTED }}>Cost ($)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: MUTED }}>Frequency</label>
          <select value={freqW} onChange={e => setFreqW(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
            {FREQ_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <button onClick={() => {
        const c = parseFloat(cost) || item.cost;
        const fw = parseInt(freqW) || item.frequencyWeeks;
        const fl = FREQ_OPTIONS.find(([v]) => v === freqW)?.[1] ?? freqLabel(fw);
        onSave(c, fw, fl);
      }} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
    </div>
  );
}

// ── Flow Tab ──────────────────────────────────────────────────────────────────
function FlowTab({ yearPlan, savingsAlerts, pc, effectiveTakeHome, paydayStr, budgetLines, bills, selfCare, insights, p2pTransfers, liabilities, creditScores, onMarkBillPaid, onMarkFocusDone, onAddP2P, onRemoveP2P, onUpdateCare, onUpdateBills, onUpdateBudgetLines, onUpdatePc, showToast }: {
  yearPlan: CheckSlot[]; savingsAlerts: SavingsAlert[];
  pc: PaycheckConfig; effectiveTakeHome: number; paydayStr: string;
  budgetLines: BudgetLine[]; bills: RecurringBill[]; selfCare: SelfCareItem[];
  insights: InsightsData | null; p2pTransfers: P2PTransfer[];
  liabilities: LiabilitiesData | null; creditScores: CreditScoreEntry[];
  onMarkBillPaid: (id: string) => void; onMarkFocusDone: (id: string) => void;
  onAddP2P: (t: P2PTransfer) => void; onRemoveP2P: (tid: string) => void;
  onUpdateCare: (i: SelfCareItem[]) => void; onUpdateBills: (b: RecurringBill[]) => void;
  onUpdateBudgetLines: (bl: BudgetLine[]) => void; onUpdatePc: (p: PaycheckConfig) => void;
  showToast: (m: string) => void;
}) {
  const [expanded,       setExpanded]       = useState<number | null>(null);
  const [showAllYear,    setShowAllYear]    = useState(false);
  const [showP2P,        setShowP2P]        = useState(false);
  const [showCareForm,   setShowCareForm]   = useState(false);
  const [showBillForm,   setShowBillForm]   = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editId,         setEditId]         = useState<string | null>(null);
  const [editPay,        setEditPay]        = useState(false);
  const [editSavings,    setEditSavings]    = useState(false);
  const [editProjected,  setEditProjected]  = useState(false);

  const [name, setName]         = useState(""); const [emoji,   setEmoji]   = useState("💄");
  const [cost, setCost]         = useState(""); const [freqWeeks,setFreqWeeks]= useState("4");
  const [billName, setBillName] = useState(""); const [billAmt, setBillAmt] = useState(""); const [billDay, setBillDay] = useState("1");
  const [budgetLabel, setBudgetLabel] = useState(""); const [budgetAmt, setBudgetAmt] = useState("");
  const [budgetCat,   setBudgetCat]   = useState<BudgetLine["category"]>("other");
  const [budgetToAcct,setBudgetToAcct]= useState("");
  const [p2pPerson,  setP2pPerson]  = useState(""); const [p2pAmount,   setP2pAmount]   = useState("");
  const [p2pDir,     setP2pDir]     = useState<"sent"|"received">("sent");
  const [p2pPlatform,setP2pPlatform]= useState<P2PTransfer["platform"]>("zelle");
  const [p2pNote,    setP2pNote]    = useState("");
  const [payInput,   setPayInput]   = useState(String(pc.takeHomePerCheck));
  const [savingsPct, setSavingsPct] = useState(String(pc.savingsPercent));
  const [projInput,  setProjInput]  = useState(String(pc.projectedTakeHome ?? pc.takeHomePerCheck));

  const current      = yearPlan[0];
  const focus        = current.focusItem;
  const pushed       = current.pushedItem;
  const isPaid       = (b: RecurringBill) => !!(b.lastPaidDate && b.lastPaidDate >= paydayStr);
  const prioritySlots = yearPlan.slice(1).filter(s => s.focusItem || s.pushedItem);
  const byMonth: { month: string; slots: { slot: CheckSlot; idx: number }[] }[] = [];
  for (let i = 0; i < prioritySlots.length; i++) {
    const slot  = prioritySlots[i];
    const month = format(slot.checkDate, "MMMM yyyy");
    const last  = byMonth[byMonth.length - 1];
    if (last?.month === month) last.slots.push({ slot, idx: i });
    else byMonth.push({ month, slots: [{ slot, idx: i }] });
  }
  const visibleMonths = showAllYear ? byMonth : byMonth.slice(0, 3);

  const addCare = () => {
    if (!name || !cost) return;
    const fwOpt = FREQ_OPTIONS.find(([v]) => v === freqWeeks);
    const fl = fwOpt ? fwOpt[1] : undefined;
    onUpdateCare([...selfCare, { id: id(), name, emoji, cost: parseFloat(cost), frequencyWeeks: parseInt(freqWeeks), frequencyLabel: fl, color: COLORS[selfCare.length % COLORS.length], priority: selfCare.length }]);
    setName(""); setCost(""); setFreqWeeks("4"); setEmoji("💄"); setShowCareForm(false); showToast("Added!");
  };

  const moveCare = (itemId: string, dir: -1 | 1) => {
    const sorted = [...selfCare].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    const idx = sorted.findIndex(i => i.id === itemId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const updated = sorted.map((item, i) => {
      if (i === idx) return { ...item, priority: newIdx };
      if (i === newIdx) return { ...item, priority: idx };
      return item;
    });
    onUpdateCare(updated);
  };
  const addBill = () => {
    if (!billName || !billAmt) return;
    onUpdateBills([...bills, { id: id(), name: billName, amount: parseFloat(billAmt), dayOfMonth: parseInt(billDay) }]);
    setBillName(""); setBillAmt(""); setBillDay("1"); setShowBillForm(false); showToast("Bill added!");
  };
  const addBudgetLine = () => {
    if (!budgetLabel || !budgetAmt) return;
    onUpdateBudgetLines([...budgetLines, { id: id(), label: budgetLabel, amountPerCheck: parseFloat(budgetAmt), category: budgetCat, toAccount: budgetToAcct || undefined }]);
    setBudgetLabel(""); setBudgetAmt(""); setBudgetToAcct(""); setShowBudgetForm(false); showToast("Added to breakdown!");
  };
  const addDetectedSplit = (split: { toAccount: string; amount: number }) => {
    onUpdateBudgetLines([...budgetLines, { id: id(), label: split.toAccount + " Transfer", amountPerCheck: split.amount, category: "transfer", toAccount: split.toAccount, isDetected: true }]);
    showToast("Added: " + split.toAccount);
  };
  const addP2P = () => {
    if (!p2pPerson || !p2pAmount) return;
    onAddP2P({ id: id(), date: format(new Date(), "yyyy-MM-dd"), person: p2pPerson, amount: parseFloat(p2pAmount), direction: p2pDir, platform: p2pPlatform, note: p2pNote || undefined });
    setP2pPerson(""); setP2pAmount(""); setP2pNote(""); setShowP2P(false);
  };

  return (
    <div className="space-y-5">
      {/* ── YEAR CALENDAR ── */}
      <div>
        <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>YEAR CALENDAR</p>
        <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <YearCalendar yearPlan={yearPlan} effectiveTakeHome={effectiveTakeHome} budgetLines={budgetLines} pc={pc} />
        </div>
      </div>

      {/* ── AI CHAT ── */}
      <AIChat pc={pc} yearPlan={yearPlan} budgetLines={budgetLines} liabilities={liabilities} creditScores={creditScores} />

      {/* ── THIS CHECK hero ── */}
      <div className="rounded-3xl p-5" style={{
        background: focus ? (current.canAfford ? "rgba(200,255,0,0.04)" : "rgba(218,102,123,0.04)") : CARD,
        border: `1px solid ${focus ? (current.canAfford ? "rgba(200,255,0,0.2)" : "rgba(218,102,123,0.2)") : BORDER}`,
      }}>
        <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.1em" }}>
          WHAT YOU&apos;RE BUYING THIS PAYCHECK
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--text-light)" }}>
          {fmtDate(current.checkDate)}{pc.employer ? ` · ${pc.employer}` : ""}
        </p>
        {focus ? (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-5xl mb-2">{focus.emoji}</p>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>{focus.name}</h2>
                <p className="text-sm mt-1 font-semibold" style={{ color: current.canAfford ? LIME : RED }}>
                  {fmt$(focus.cost)} · {current.canAfford ? "you can swing it ✓" : "tight this check ⚠️"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {freqLabel(focus.frequencyWeeks, focus.frequencyLabel)}{focus.lastDone ? ` · last ${format(parseISO(focus.lastDone), "MMM d")}` : ""}
                </p>
              </div>
              <button onClick={() => onMarkFocusDone(focus.id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(124,92,252,0.12)", color: LIME, border: `1px solid rgba(124,92,252,0.3)` }}>Done ✓</button>
            </div>
            <div className="space-y-2 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "💵 Paycheck",  amount: effectiveTakeHome, color: "var(--text)" },
                { label: "💰 Savings",   amount: current.savings,   color: "#9B7FFF" },
                ...budgetLines.map(l => ({ label: `${getCategoryEmoji(l.category)} ${l.label}`, amount: l.amountPerCheck, color: AMBER })),
                { label: "🧾 Bills",     amount: current.billsTotal, color: AMBER },
                { label: `${focus.emoji} ${focus.name}`, amount: focus.cost, color: current.canAfford ? LIME : RED },
              ].filter(r => r.amount > 0).map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span style={{ color: MUTED }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: r.color }}>{r.label === "💵 Paycheck" ? fmt$(r.amount) : `−${fmt$(r.amount)}`}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="text-sm" style={{ color: MUTED }}>Yours after</span>
                <span className="text-2xl font-bold" style={{ color: current.free - focus.cost >= 0 ? LIME : RED }}>
                  {fmt$(Math.max(0, current.free - focus.cost))}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs mb-3" style={{ color: MUTED }}>No self-care scheduled — free cash after savings &amp; bills</p>
            <p className="text-4xl font-bold mb-2" style={{ color: LIME }}>{fmt$(current.free)}</p>
            <p className="text-sm" style={{ color: MUTED }}>yours to keep this check</p>
            {!focus && selfCare.length === 0 && <p className="text-xs mt-2" style={{ color: "var(--text-light)" }}>Add self-care items below to see your rotation.</p>}
          </div>
        )}
      </div>

      {/* Pushed item */}
      {pushed && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(232,168,124,0.07)", border: `1px solid rgba(232,168,124,0.2)` }}>
          <span className="text-xl flex-shrink-0">{pushed.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">{pushed.name} is pushed</p>
            <p className="text-xs" style={{ color: AMBER }}>{fmt$(pushed.cost)} — affordable on {current.pushedTo ? fmtDate(current.pushedTo) : "a future check"}</p>
          </div>
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
                    <p className="text-sm" style={{ color: paid ? MUTED : "var(--text)", textDecoration: paid ? "line-through" : "none" }}>{b.name}</p>
                    <p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold" style={{ color: paid ? MUTED : RED }}>{fmt$(b.amount)}</p>
                    <button onClick={() => !paid && onMarkBillPaid(b.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: paid ? "rgba(124,92,252,0.15)" : "rgba(124,92,252,0.07)", border: `1px solid ${paid ? "rgba(124,92,252,0.3)" : BORDER}` }}>
                      {paid ? <Check size={13} style={{ color: LIME }} /> : <span style={{ fontSize: 11, color: MUTED }}>✓</span>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Advisor */}
      <AIAdvisorCard pc={pc} currentSlot={current}
        yearChecksRemaining={yearPlan.length}
        totalYearTreatmentCost={yearPlan.reduce((s, slot) => s + (slot.focusItem?.cost ?? 0), 0)} />

      {/* Savings alerts */}
      {savingsAlerts.length > 0 && (
        <div className="space-y-2">
          {savingsAlerts.map(a => (
            <div key={a.item.id} className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(232,168,124,0.08)", border: `1px solid rgba(232,168,124,0.25)` }}>
              <div>
                <p className="text-sm font-semibold text-white">{a.item.emoji} {a.item.name} — {fmtDate(a.checkDate)}</p>
                <p className="text-xs mt-0.5" style={{ color: AMBER }}>{fmt$(a.shortfall)} short · set aside {fmt$(a.savePerCheck)}/check for {a.checksUntil} check{a.checksUntil !== 1 ? "s" : ""}</p>
              </div>
              <p className="text-lg font-bold" style={{ color: AMBER }}>{fmt$(a.savePerCheck)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Priority list */}
      {prioritySlots.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>PRIORITY LIST — REST OF YEAR</p>
            {byMonth.length > 3 && (
              <button onClick={() => setShowAllYear(!showAllYear)} className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: MUTED }}>
                {showAllYear ? "Show less" : "Show all"}{showAllYear ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {visibleMonths.map(({ month, slots: ms }) => (
              <div key={month}>
                <p className="text-xs font-semibold mb-2 px-1" style={{ color: MUTED, letterSpacing: "0.06em" }}>{month.toUpperCase()}</p>
                <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {ms.map(({ slot, idx }, si) => {
                    const open = expanded === idx;
                    const item = slot.focusItem ?? slot.pushedItem;
                    const affordable = slot.focusItem ? slot.canAfford : false;
                    const isPushedSlot = !slot.focusItem && !!slot.pushedItem;
                    const pillColor = affordable ? LIME : isPushedSlot ? AMBER : RED;
                    const pillBg    = affordable ? "rgba(200,255,0,0.1)" : isPushedSlot ? "rgba(232,168,124,0.1)" : "rgba(218,102,123,0.1)";
                    return (
                      <div key={idx} style={{ borderBottom: si < ms.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                        <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => setExpanded(open ? null : idx)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 text-center"><p className="text-base leading-none">{item?.emoji ?? "·"}</p></div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">{item?.name ?? "Free check"}{isPushedSlot && <span className="ml-1.5 text-xs" style={{ color: AMBER }}>pushed</span>}</p>
                              <p className="text-xs" style={{ color: MUTED }}>{format(slot.checkDate, "EEE, MMM d")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {item ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: pillBg, color: pillColor }}>{fmt$(item.cost)}</span>
                                  : <span className="text-xs" style={{ color: MUTED }}>{fmt$(slot.free)} free</span>}
                            {open ? <ChevronUp size={12} style={{ color: MUTED }} /> : <ChevronDown size={12} style={{ color: MUTED }} />}
                          </div>
                        </button>
                        {open && (
                          <div className="px-4 pb-3 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                            {[
                              { label: "💵 Paycheck",  amount: effectiveTakeHome,       color: "var(--text)", prefix: "" },
                              { label: "💰 Savings",   amount: slot.savings,            color: "#9B7FFF",prefix: "−" },
                              { label: "🧾 Bills",     amount: slot.billsTotal,         color: AMBER,    prefix: "−" },
                              ...(slot.focusItem  ? [{ label: `${slot.focusItem.emoji} ${slot.focusItem.name}`, amount: slot.focusItem.cost, color: LIME, prefix: "−" }] : []),
                              ...(slot.pushedItem ? [{ label: `${slot.pushedItem.emoji} ${slot.pushedItem.name} (pushed)`, amount: slot.pushedItem.cost, color: AMBER, prefix: "" }] : []),
                            ].filter(r => r.amount > 0).map(r => (
                              <div key={r.label} className="flex justify-between text-xs">
                                <span style={{ color: MUTED }}>{r.label}</span>
                                <span style={{ color: r.color }}>{r.prefix}{fmt$(r.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm pt-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                              <span style={{ color: MUTED }}>Yours after</span>
                              <span className="font-bold">{fmt$(slot.focusItem ? slot.free - slot.focusItem.cost : slot.free)}</span>
                            </div>
                            {isPushedSlot && slot.pushedTo && <p className="text-xs" style={{ color: AMBER }}>Pushed → {fmtDate(slot.pushedTo)}</p>}
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

      {/* ── MANAGE ── */}
      <div className="pt-2">
        <p className="text-xs font-semibold mb-4" style={{ color: LIME, letterSpacing: "0.12em" }}>── MANAGE YOUR PLAN ──────────</p>

        {/* Income settings */}
        <div className="mb-5">
          <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>YOUR INCOME</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-sm text-white">This check</p>
              {editPay ? (
                <div className="flex items-center gap-2">
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white">$</span>
                    <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)} className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} /></div>
                  <button onClick={() => { onUpdatePc({ ...pc, takeHomePerCheck: parseFloat(payInput) || pc.takeHomePerCheck }); setEditPay(false); showToast("Updated!"); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{fmt$(pc.takeHomePerCheck)}</p>
                  <button onClick={() => setEditPay(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div><p className="text-sm text-white">Projected</p>{pc.projectedTakeHome && <p className="text-xs" style={{ color: AMBER }}>Used for math</p>}</div>
              {editProjected ? (
                <div className="flex items-center gap-2">
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white">$</span>
                    <input type="number" value={projInput} onChange={e => setProjInput(e.target.value)} className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} /></div>
                  <button onClick={() => { const v = parseFloat(projInput); onUpdatePc({ ...pc, projectedTakeHome: v && v !== pc.takeHomePerCheck ? v : undefined }); setEditProjected(false); showToast("Updated!"); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{pc.projectedTakeHome ? fmt$(pc.projectedTakeHome) : <span style={{ color: MUTED }}>Not set</span>}</p>
                  <button onClick={() => setEditProjected(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>{pc.projectedTakeHome ? "Edit" : "Set"}</button>
                  {pc.projectedTakeHome && <button onClick={() => { onUpdatePc({ ...pc, projectedTakeHome: undefined }); showToast("Cleared."); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(218,102,123,0.1)", color: RED }}>Clear</button>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-white">Savings</p>
              {editSavings ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">{["5","10","15","20"].map(p => <button key={p} onClick={() => setSavingsPct(p)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={savingsPct === p ? { background: LIME, color: "#fff"} : { background: "rgba(124,92,252,0.07)", color: MUTED }}>{p}%</button>)}</div>
                  <button onClick={() => { onUpdatePc({ ...pc, savingsPercent: parseInt(savingsPct) }); setEditSavings(false); showToast("Updated!"); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{pc.savingsPercent}% · {fmt$(Math.round(pc.takeHomePerCheck * pc.savingsPercent / 100))}</p>
                  <button onClick={() => setEditSavings(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Paycheck Breakdown */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>PAYCHECK BREAKDOWN</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-light)" }}>Where your check goes each pay period</p>
            </div>
            <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}><Plus size={12} /> Add</button>
          </div>
          {(insights?.paycheckSplits ?? []).filter(s => !budgetLines.some(l => l.isDetected && l.toAccount === s.toAccount)).length > 0 && (
            <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: "rgba(200,255,0,0.04)", border: `1px solid rgba(200,255,0,0.15)` }}>
              <p className="text-xs font-semibold mb-2" style={{ color: LIME }}>Detected recurring transfers:</p>
              {(insights!.paycheckSplits!).filter(s => !budgetLines.some(l => l.isDetected && l.toAccount === s.toAccount)).map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div><p className="text-sm text-white">🏦 {s.toAccount}</p><p className="text-xs" style={{ color: MUTED }}>{fmt$(s.amount)}/check · detected {s.count}x</p></div>
                  <button onClick={() => addDetectedSplit(s)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Add</button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-sm font-semibold text-white">💵 Paycheck</p>
              <p className="text-sm font-bold text-white">{fmt$(effectiveTakeHome)}</p>
            </div>
            {pc.savingsPercent > 0 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <p className="text-sm" style={{ color: "#9B7FFF" }}>💰 Savings ({pc.savingsPercent}%)</p>
                <p className="text-sm font-semibold" style={{ color: "#9B7FFF" }}>−{fmt$(Math.round(effectiveTakeHome * pc.savingsPercent / 100))}</p>
              </div>
            )}
            {budgetLines.map(line => (
              <div key={line.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm text-white truncate">{getCategoryEmoji(line.category)} {line.label}</p>
                  {line.isDetected && <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(200,255,0,0.1)", color: LIME }}>auto</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: RED }}>−{fmt$(line.amountPerCheck)}</p>
                  <button onClick={() => { onUpdateBudgetLines(budgetLines.filter(l => l.id !== line.id)); showToast("Removed"); }}><Trash2 size={11} style={{ color: MUTED }} /></button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3.5" style={{ background: "rgba(200,255,0,0.03)" }}>
              <p className="text-sm font-semibold" style={{ color: LIME }}>Yours to spend</p>
              <p className="text-lg font-bold" style={{ color: LIME }}>{fmt$(Math.max(0, effectiveTakeHome - Math.round(effectiveTakeHome * pc.savingsPercent / 100) - budgetLines.reduce((s, l) => s + l.amountPerCheck, 0)))}</p>
            </div>
          </div>
          {showBudgetForm && (
            <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <div className="space-y-2 mb-3">
                <input value={budgetLabel} onChange={e => setBudgetLabel(e.target.value)} placeholder="Label (e.g. Rent, BofA Transfer)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={budgetAmt} onChange={e => setBudgetAmt(e.target.value)} placeholder="Per check ($)" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <select value={budgetCat} onChange={e => setBudgetCat(e.target.value as BudgetLine["category"])} className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                    <option value="housing">🏠 Housing</option><option value="transfer">🏦 Transfer</option><option value="food">🛒 Food</option><option value="transport">🚗 Transport</option><option value="utilities">💡 Utilities</option><option value="savings">💰 Savings</option><option value="other">📌 Other</option>
                  </select>
                </div>
                <input value={budgetToAcct} onChange={e => setBudgetToAcct(e.target.value)} placeholder="To account (optional)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              </div>
              <button onClick={addBudgetLine} disabled={!budgetLabel || !budgetAmt} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: LIME, color: "#fff"}}>Add to Breakdown</button>
            </div>
          )}
        </div>

        {/* Self-care rotation */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>SELF-CARE ROTATION</p>
            <button onClick={() => setShowCareForm(!showCareForm)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}><Plus size={12} /> Add</button>
          </div>
          {selfCare.length === 0 && !showCareForm && (
            <div className="rounded-2xl p-5 text-center mb-3" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
              <p className="text-sm" style={{ color: MUTED }}>Add hair, nails, facials — anything you do on a schedule.</p>
            </div>
          )}
          <div className="space-y-2">
            {[...selfCare].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)).map((item, listIdx, sortedArr) => {
              const isEditing = editId === item.id;
              return (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Priority arrows */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveCare(item.id, -1)} disabled={listIdx === 0}
                          className="w-5 h-4 flex items-center justify-center rounded disabled:opacity-20"
                          style={{ color: MUTED, fontSize: 9 }}>▲</button>
                        <button onClick={() => moveCare(item.id, 1)} disabled={listIdx === sortedArr.length - 1}
                          className="w-5 h-4 flex items-center justify-center rounded disabled:opacity-20"
                          style={{ color: MUTED, fontSize: 9 }}>▼</button>
                      </div>
                      <span className="text-xl">{item.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.name}</p>
                        <p className="text-xs" style={{ color: MUTED }}>{fmt$(item.cost)} · {freqLabel(item.frequencyWeeks, item.frequencyLabel)}{item.lastDone ? ` · last ${format(parseISO(item.lastDone), "MMM d")}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { onUpdateCare(selfCare.map(i => i.id === item.id ? { ...i, lastDone: format(new Date(), "yyyy-MM-dd") } : i)); showToast(`${item.name} — done!`); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>Done</button>
                      <button onClick={() => setEditId(isEditing ? null : item.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
                      <button onClick={() => onUpdateCare(selfCare.filter(i => i.id !== item.id))}><Trash2 size={13} style={{ color: MUTED }} /></button>
                    </div>
                  </div>
                  {isEditing && (
                    <EditCareInline item={item} onSave={(c, fw, fl) => {
                      onUpdateCare(selfCare.map(i => i.id === item.id ? { ...i, cost: c, frequencyWeeks: fw, frequencyLabel: fl } : i));
                      setEditId(null); showToast("Updated!");
                    }} />
                  )}
                </div>
              );
            })}
          </div>
          {showCareForm && (
            <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <div className="space-y-2 mb-3">
                <div className="flex gap-2">
                  <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} className="w-14 rounded-xl px-2 py-3 text-xl text-center outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Waxing, Lashes" className="flex-1 rounded-xl px-3 py-3 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost ($)" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <select value={freqWeeks} onChange={e => setFreqWeeks(e.target.value)} className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                    {FREQ_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={addCare} disabled={!name || !cost} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: LIME, color: "#fff"}}>Add to Rotation</button>
            </div>
          )}
        </div>

        {/* Recurring bills management */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>RECURRING BILLS &amp; SUBSCRIPTIONS</p>
            <button onClick={() => setShowBillForm(!showBillForm)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}><Plus size={12} /> Add</button>
          </div>
          {/* Detected subscriptions from Plaid not yet added */}
          {(insights?.bills ?? []).filter(b => !bills.some(rb => rb.name.toLowerCase().includes(b.name.toLowerCase().slice(0, 6)) || b.name.toLowerCase().includes(rb.name.toLowerCase().slice(0, 6)))).length > 0 && (
            <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: "rgba(124,92,252,0.04)", border: `1px solid ${BORDER}` }}>
              <p className="text-xs font-semibold mb-2" style={{ color: LIME }}>Detected from your bank:</p>
              {(insights!.bills!).filter(b => !bills.some(rb => rb.name.toLowerCase().includes(b.name.toLowerCase().slice(0, 6)) || b.name.toLowerCase().includes(rb.name.toLowerCase().slice(0, 6)))).map((b, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm" style={{ color: "var(--text)" }}>🧾 {b.name}</p>
                    <p className="text-xs" style={{ color: MUTED }}>{fmt$(b.amount)} · due {b.dayOfMonth}{ordinal(b.dayOfMonth)}</p>
                  </div>
                  <button onClick={() => { onUpdateBills([...bills, { id: id(), name: b.name, amount: b.amount, dayOfMonth: b.dayOfMonth }]); showToast("Bill added!"); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff" }}>Add</button>
                </div>
              ))}
            </div>
          )}
          {bills.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {bills.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < bills.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div><p className="text-sm" style={{ color: "var(--text)" }}>{b.name}</p><p className="text-xs" style={{ color: MUTED }}>Due {b.dayOfMonth}{ordinal(b.dayOfMonth)}</p></div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold" style={{ color: RED }}>{fmt$(b.amount)}</p>
                    <button onClick={() => { onUpdateBills(bills.filter(x => x.id !== b.id)); showToast("Removed"); }}><Trash2 size={12} style={{ color: MUTED }} /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(124,92,252,0.03)", borderTop: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: MUTED }}>Monthly total</p>
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{fmt$(bills.reduce((s, b) => s + b.amount, 0))}/mo</p>
              </div>
            </div>
          )}
          {showBillForm && (
            <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <div className="space-y-2 mb-3">
                <input value={billName} onChange={e => setBillName(e.target.value)} placeholder="Name (e.g. Rent, Phone)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={billAmt} onChange={e => setBillAmt(e.target.value)} placeholder="Amount ($)" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <input type="number" min="1" max="31" value={billDay} onChange={e => setBillDay(e.target.value)} placeholder="Day due" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <button onClick={addBill} disabled={!billName || !billAmt} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: LIME, color: "#fff"}}>Add Bill</button>
            </div>
          )}
        </div>

        {/* P2P Transfers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>ZELLE · VENMO · CASHAPP</p>
            <button onClick={() => setShowP2P(!showP2P)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}><Plus size={12} /> Log</button>
          </div>
          {showP2P && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setP2pDir("sent")} className="py-2.5 rounded-xl text-sm font-semibold" style={p2pDir === "sent" ? { background: RED, color: "#fff" } : { background: "rgba(124,92,252,0.07)", color: MUTED }}>↑ Sent</button>
                  <button onClick={() => setP2pDir("received")} className="py-2.5 rounded-xl text-sm font-semibold" style={p2pDir === "received" ? { background: LIME, color: "#fff"} : { background: "rgba(124,92,252,0.07)", color: MUTED }}>↓ Received</button>
                </div>
                <input value={p2pPerson} onChange={e => setP2pPerson(e.target.value)} placeholder="Person" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={p2pAmount} onChange={e => setP2pAmount(e.target.value)} placeholder="Amount ($)" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <select value={p2pPlatform} onChange={e => setP2pPlatform(e.target.value as P2PTransfer["platform"])} className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                    <option value="zelle">Zelle</option><option value="venmo">Venmo</option><option value="cashapp">CashApp</option><option value="cash">Cash</option><option value="other">Other</option>
                  </select>
                </div>
                <input value={p2pNote} onChange={e => setP2pNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              </div>
              <button onClick={addP2P} disabled={!p2pPerson || !p2pAmount} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: LIME, color: "#fff"}}>Log It</button>
            </div>
          )}
          {p2pTransfers.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {p2pTransfers.slice(0, 10).map((t, i) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < Math.min(p2pTransfers.length, 10) - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div><p className="text-sm text-white">{t.direction === "sent" ? "↑" : "↓"} {t.person}</p><p className="text-xs" style={{ color: MUTED }}>{t.platform} · {t.date}{t.note ? ` · ${t.note}` : ""}</p></div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: t.direction === "sent" ? RED : LIME }}>{t.direction === "sent" ? "-" : "+"}{fmt$(t.amount)}</p>
                    <button onClick={() => onRemoveP2P(t.id)}><Trash2 size={11} style={{ color: MUTED }} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {p2pTransfers.length === 0 && !showP2P && <p className="text-xs text-center py-2" style={{ color: MUTED }}>No transfers logged yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Debt Tab ───────────────────────────────────────────────────────────────────
function DebtTab({ liabilities, liabilitiesLoading, effectiveTakeHome, freeCash }: {
  liabilities: LiabilitiesData | null;
  liabilitiesLoading: boolean;
  effectiveTakeHome: number;
  freeCash: number;
}) {
  const [advice, setAdvice]           = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchAdvice = useCallback(async () => {
    if (!liabilities?.hasData) return;
    setAdviceLoading(true);
    try {
      const ctx = {
        takeHome: effectiveTakeHome,
        creditCards: (liabilities?.creditCards ?? []).map(c => ({ name: c.name, balance: c.balance, minimumPayment: c.minimumPayment, purchaseApr: c.purchaseApr })),
        studentLoans: (liabilities?.studentLoans ?? []).map(l => ({ name: l.name, outstandingBalance: l.outstandingBalance, interestRate: l.interestRate, minimumPayment: l.minimumPayment })),
        totalDebt: liabilities?.totalDebt ?? 0,
        totalMinPayments: liabilities?.totalMinPayments ?? 0,
        freeCash,
      };
      const res = await fetch("/api/ai/debt-advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ctx) });
      const j = await res.json();
      setAdvice(j.advice ?? null);
    } catch { setAdvice(null); }
    finally  { setAdviceLoading(false); }
  }, [liabilities, effectiveTakeHome, freeCash]);

  useEffect(() => {
    if (!fetchedRef.current && !liabilitiesLoading) { fetchedRef.current = true; fetchAdvice(); }
  }, [fetchAdvice, liabilitiesLoading]);

  if (liabilitiesLoading) return (
    <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
      <p className="text-xs" style={{ color: MUTED }}>Reading your accounts…</p>
    </div>
  );

  if (!liabilities?.hasData) return (
    <div className="rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-3xl mb-2">💳</p>
      <p className="text-sm text-white mb-1">No debt accounts detected</p>
      <p className="text-xs" style={{ color: MUTED }}>Plaid pulls in credit cards and loans automatically from your connected accounts.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Total debt bar */}
      <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(218,102,123,0.06)", border: `1px solid rgba(218,102,123,0.2)` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: RED, letterSpacing: "0.08em" }}>TOTAL DEBT</p>
            <p className="text-3xl font-bold">{fmt$(liabilities.totalDebt)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: MUTED }}>Minimum/mo</p>
            <p className="text-xl font-bold" style={{ color: AMBER }}>{fmt$(liabilities.totalMinPayments)}</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>{fmt$(Math.round(liabilities.totalMinPayments / 2))}/check</p>
          </div>
        </div>
      </div>

      {/* Credit Cards */}
      {liabilities.creditCards.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>CREDIT CARDS</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {liabilities.creditCards.map((cc, i) => {
              const util = cc.utilization ?? 0;
              const utilColor = util >= 50 ? RED : util >= 30 ? AMBER : LIME;
              return (
                <div key={cc.accountId} className="px-4 py-4" style={{ borderBottom: i < liabilities.creditCards.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">💳 {cc.name}
                        {cc.isOverdue && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(218,102,123,0.15)", color: RED }}>Overdue</span>}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: MUTED }}>{cc.purchaseApr ? `${cc.purchaseApr}% APR · ` : ""}{cc.nextDueDate ? `Due ${format(parseISO(cc.nextDueDate), "MMM d")}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: RED }}>{fmt$(cc.balance)}</p>
                      {cc.minimumPayment && <p className="text-xs" style={{ color: MUTED }}>min {fmt$(cc.minimumPayment)}/mo</p>}
                    </div>
                  </div>
                  {cc.creditLimit && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <p className="text-xs" style={{ color: MUTED }}>{fmt$(cc.balance)} of {fmt$(cc.creditLimit)} limit</p>
                        <p className="text-xs font-semibold" style={{ color: utilColor }}>{util}% used</p>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.08)" }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, util)}%`, background: utilColor }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student Loans */}
      {liabilities.studentLoans.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>STUDENT LOANS</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {liabilities.studentLoans.map((loan, i) => (
              <div key={loan.accountId} className="px-4 py-4" style={{ borderBottom: i < liabilities.studentLoans.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white flex items-center gap-2">🎓 {loan.name}
                      {loan.isOverdue && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(218,102,123,0.15)", color: RED }}>Overdue</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>{loan.interestRate ? `${loan.interestRate}% rate · ` : ""}{loan.nextDueDate ? `Due ${format(parseISO(loan.nextDueDate), "MMM d")}` : ""}{loan.expectedPayoffDate ? ` · Payoff ${format(parseISO(loan.expectedPayoffDate), "MMM yyyy")}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: AMBER }}>{fmt$(loan.outstandingBalance)}</p>
                    {loan.minimumPayment && <p className="text-xs" style={{ color: MUTED }}>min {fmt$(loan.minimumPayment)}/mo</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Payoff Plan */}
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>AI PAYOFF PLAN</p>
          <button onClick={fetchAdvice} disabled={adviceLoading} className="p-1.5 rounded-lg" style={{ background: "rgba(124,92,252,0.06)", border: `1px solid ${BORDER}` }}>
            <RotateCcw size={12} className={adviceLoading ? "animate-spin" : ""} style={{ color: MUTED }} />
          </button>
        </div>
        {adviceLoading ? (
          <div className="space-y-2">{[90, 75, 60].map(w => <div key={w} className="h-3 rounded animate-pulse" style={{ background: "rgba(124,92,252,0.08)", width: `${w}%` }} />)}</div>
        ) : advice ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{advice}</p>
        ) : (
          <p className="text-sm" style={{ color: MUTED }}>Tap refresh for a personalized payoff strategy.</p>
        )}
        <p className="text-xs text-right mt-3" style={{ color: "var(--text-light)" }}>powered by Claude</p>
      </div>
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
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          I read 6 months of transactions. Here&apos;s what I found — confirm to load into your rotation.
          {paycheckAmount ? ` Your avg paycheck: ${fmt$(paycheckAmount)}.` : ""}
        </p>
      </div>
      <div className="px-4 py-3 space-y-2" style={{ background: "rgba(200,255,0,0.03)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.06em" }}>SELF-CARE SPENDING</p>
        {detected.map(d => (
          <button key={d.key} onClick={() => toggle(d.key)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all"
            style={{ background: sel.has(d.key) ? "rgba(124,92,252,0.10)" : "rgba(124,92,252,0.04)", border: `1px solid ${sel.has(d.key) ? "rgba(124,92,252,0.30)" : BORDER}` }}>
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
              style={{ background: sel.has(d.key) ? LIME : "rgba(124,92,252,0.1)" }}>
              {sel.has(d.key) && <Check size={11} color="#fff" />}
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
              style={{ background: bSel.has(b.name) ? "rgba(124,92,252,0.10)" : "rgba(124,92,252,0.04)", border: `1px solid ${bSel.has(b.name) ? "rgba(124,92,252,0.30)" : BORDER}` }}>
              <div className="text-left">
                <p className="text-sm text-white">{b.name}</p>
                <p className="text-xs" style={{ color: MUTED }}>due {b.dayOfMonth}{ordinal(b.dayOfMonth)} · {fmt$(b.amount)}/mo</p>
              </div>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: bSel.has(b.name) ? LIME : "rgba(124,92,252,0.1)" }}>
                {bSel.has(b.name) && <Check size={11} color="#fff" />}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pb-4 pt-3 flex gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={accept} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: LIME, color: "#fff"}}>
          Load {sel.size} item{sel.size !== 1 ? "s" : ""} into plan
        </button>
        <button onClick={onDismiss} className="px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Skip</button>
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
    <div style={{ background: BG, minHeight: "100vh" }}>
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
                  className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}` }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Take-home per check (detected from Plaid)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
                  <input type="number" value={takeHome} onChange={e => setTakeHome(e.target.value)} placeholder="e.g. 1800"
                    className="w-full rounded-2xl pl-8 pr-4 py-3.5 text-sm outline-none"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Projected take-home per check (your expected amount)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
                  <input type="number" value={projectedAmt} onChange={e => setProjectedAmt(e.target.value)} placeholder="Override if different"
                    className="w-full rounded-2xl pl-8 pr-4 py-3.5 text-sm outline-none"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Your next payday</label>
                <input type="date" value={nextPayday} onChange={e => setNextPayday(e.target.value)}
                  className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, colorScheme: "dark" }} />
              </div>
              <div>
                <label className="text-xs mb-2 block" style={{ color: MUTED }}>Save per check (%)</label>
                <div className="grid grid-cols-4 gap-2">
                  {["5","10","15","20"].map(p => (
                    <button key={p} onClick={() => setSavingsPct(p)}
                      className="py-3 rounded-2xl text-sm font-semibold transition-all"
                      style={savingsPct === p ? { background: LIME, color: "#fff"} : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
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
                    <p key={d.key} className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {d.emoji} {d.label} · avg {fmt$(d.avgCost)} · every ~{Math.round(d.avgFreqDays / 7)} wks
                    </p>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: MUTED }}>These will be pre-loaded into your check rotation.</p>
              </div>
            )}

            <button onClick={handleStart} disabled={!takeHome || !nextPayday}
              className="w-full py-4 rounded-2xl text-base font-bold disabled:opacity-40 transition-all active:scale-95"
              style={{ background: LIME, color: "#fff"}}>
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
          style={{ background: "rgba(124,92,252,0.06)", border: `1px solid ${BORDER}` }}>
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} style={{ color: MUTED }} />
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(124,92,252,0.08)", width: "90%" }} />
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(124,92,252,0.08)", width: "70%" }} />
        </div>
      ) : advice ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{advice}</p>
      ) : (
        <p className="text-sm" style={{ color: MUTED }}>Tap refresh for personalized advice.</p>
      )}
      <div className="flex justify-end mt-3">
        <p className="text-xs" style={{ color: "var(--text-light)" }}>powered by Claude</p>
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
    : rentPct <= 30 ? { text: "Manageable", color: "#10B981" }
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
            { label: "Standard (30%)",    amount: Math.round(monthlyIncome * 0.30), color: "#10B981" },
            { label: "Max (35%)",         amount: Math.round(monthlyIncome * 0.35), color: RED },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(124,92,252,0.05)" }}>
              <p className="text-sm" style={{ color: MUTED }}>{r.label}</p>
              <p className="text-sm font-bold" style={{ color: r.color }}>{fmt$(r.amount)}/mo</p>
            </div>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">$</span>
          <input type="number" value={targetRent} onChange={e => setTargetRent(e.target.value)} placeholder="Enter a rent to check"
            className="w-full rounded-xl pl-8 pr-4 py-3 text-sm outline-none"
            style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
        </div>
        {verdict && targetRent && (
          <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(124,92,252,0.05)" }}>
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
              style={{ background: "rgba(124,92,252,0.06)", border: `1px solid ${BORDER}`, color: MUTED }}>
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
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                    {knownAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>To</label>
                  <select value={toAcct} onChange={e => setToAcct(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                    {knownAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount ($)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose (optional)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
            </div>
            <button onClick={addTransfer} disabled={!amount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#fff"}}>Log Transfer</button>
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

// ── Credit Tab ────────────────────────────────────────────────────────────────
function scoreLabel(s: number): { text: string; color: string } {
  if (s >= 800) return { text: "Exceptional", color: LIME };
  if (s >= 740) return { text: "Very Good",   color: LIME };
  if (s >= 670) return { text: "Good",        color: "#10B981" };
  if (s >= 580) return { text: "Fair",        color: AMBER };
  return               { text: "Poor",        color: RED };
}

function CreditTab({ liabilities, liabilitiesLoading, creditScores, effectiveTakeHome, freeCash, onUpdateScores }: {
  liabilities: LiabilitiesData | null;
  liabilitiesLoading: boolean;
  creditScores: CreditScoreEntry[];
  effectiveTakeHome: number;
  freeCash: number;
  onUpdateScores: (s: CreditScoreEntry[]) => void;
}) {
  void liabilities; void liabilitiesLoading; void effectiveTakeHome; void freeCash;
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreInput, setScoreInput]       = useState("");
  const [scoreSource, setScoreSource]     = useState("Credit Karma");
  const [scoreNote, setScoreNote]         = useState("");

  const sorted = [...creditScores].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;
  const prev   = sorted[1] ?? null;
  const delta  = latest && prev ? latest.score - prev.score : null;

  const logScore = () => {
    const n = parseInt(scoreInput);
    if (!n || n < 300 || n > 850) return;
    onUpdateScores([{ id: id(), date: format(new Date(), "yyyy-MM-dd"), score: n, source: scoreSource, notes: scoreNote || undefined }, ...creditScores]);
    setScoreInput(""); setScoreNote(""); setShowScoreForm(false);
  };

  const label = latest ? scoreLabel(latest.score) : null;

  return (
    <div className="space-y-5">
      {/* Credit Score card */}
      <div className="rounded-3xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.1em" }}>CREDIT SCORE</p>
          <button onClick={() => setShowScoreForm(!showScoreForm)}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold"
            style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
            + Log Score
          </button>
        </div>

        {latest ? (
          <div>
            <div className="flex items-end gap-3 mb-1">
              <p className="text-5xl font-bold" style={{ color: label?.color }}>{latest.score}</p>
              {delta !== null && (
                <p className="text-sm font-semibold mb-2" style={{ color: delta >= 0 ? LIME : RED }}>
                  {delta >= 0 ? `↑ +${delta}` : `↓ ${delta}`} pts
                </p>
              )}
            </div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: label?.color }}>{label?.text}</p>
            <p className="text-xs" style={{ color: MUTED }}>
              via {latest.source} · {format(parseISO(latest.date), "MMM d, yyyy")}
            </p>

            {/* Score bar 300–850 */}
            <div className="mt-4 relative">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.08)" }}>
                {["rgba(218,102,123,0.8)","rgba(232,168,124,0.8)","rgba(138,158,135,0.8)","rgba(200,255,0,0.7)","rgba(200,255,0,1)"].map((c, i) => (
                  <div key={i} className="absolute top-0 h-2" style={{ left: `${i * 20}%`, width: "20%", background: c, opacity: 0.5 }} />
                ))}
                <div className="absolute top-0 h-2 rounded-full"
                  style={{ left: 0, width: `${((latest.score - 300) / 550) * 100}%`, background: label?.color, transition: "width 0.5s" }} />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-xs" style={{ color: MUTED }}>300</p>
                <p className="text-xs" style={{ color: MUTED }}>850</p>
              </div>
            </div>

            {/* Score history */}
            {sorted.length > 1 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <p className="text-xs font-semibold mb-2" style={{ color: MUTED, letterSpacing: "0.06em" }}>HISTORY</p>
                <div className="space-y-1.5">
                  {sorted.slice(0, 5).map((e) => {
                    const lbl = scoreLabel(e.score);
                    return (
                      <div key={e.id} className="flex items-center justify-between">
                        <p className="text-xs" style={{ color: MUTED }}>{format(parseISO(e.date), "MMM d, yyyy")} · {e.source}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold" style={{ color: lbl.color }}>{e.score}</p>
                          <button onClick={() => onUpdateScores(creditScores.filter(x => x.id !== e.id))}>
                            <Trash2 size={10} style={{ color: "var(--text-light)" }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">📊</p>
            <p className="text-sm text-white mb-1">No score logged yet</p>
            <p className="text-xs" style={{ color: MUTED }}>Check yours on Credit Karma, Chase, or your bank app — it&apos;s free.</p>
          </div>
        )}

        {/* Log score form */}
        {showScoreForm && (
          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="300" max="850" value={scoreInput} onChange={e => setScoreInput(e.target.value)}
                placeholder="Score (300–850)"
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              <select value={scoreSource} onChange={e => setScoreSource(e.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                {["Credit Karma","Chase","Capital One","Experian","Discover","Bank of America","Other"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <input value={scoreNote} onChange={e => setScoreNote(e.target.value)} placeholder="Note (optional)"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
            <button onClick={logScore} disabled={!scoreInput}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: LIME, color: "#fff"}}>Save Score</button>
          </div>
        )}
      </div>

      {liabilities?.hasData && (
        <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(218,102,123,0.06)", border: `1px solid rgba(218,102,123,0.15)` }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: RED }}>Total Debt: {fmt$(liabilities.totalDebt)}</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Full breakdown + AI payoff plan in the Debt tab →</p>
          </div>
        </div>
      )}
    </div>
  );
}
