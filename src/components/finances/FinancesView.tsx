"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Unlink, Plus, Trash2, Check, ChevronDown, ChevronUp, RotateCcw, Pencil } from "lucide-react";
import { DashboardData, PaycheckConfig, SelfCareItem, RecurringBill, P2PTransfer, AccountTransfer, BudgetLine, CreditScoreEntry, BaseBudgetItem, BudgetPlan, BudgetPlanItem } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { parseISO, format, addDays, differenceInDays } from "date-fns";
import { TodaySpendCard } from "@/components/finances/TodaySpendCard";

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
type PaycheckPlanData = { overrides: Record<string, number>; savingsOverride?: number; incomeOverride?: number; oneTimeItems: { id: string; label: string; amount: number; category: string }[]; checkIns?: Record<string, { checkedAt: string; actualAmount?: number }> };
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
function getCategoryColor(cat: BudgetLine["category"] | string): string {
  const map: Record<string, string> = {
    transfer: "#6366F1", housing: "#7C5CFC", food: "#10B981", transport: "#F59E0B",
    savings: "#8B5CF6", utilities: "#06B6D4", other: "#94A3B8",
    groceries: "#10B981", "eating out": "#FB923C", gas: "#F59E0B",
    health: "#EF4444", fun: "#E879F9", "self-care": "#EC4899",
    subscriptions: "#6366F1", travel: "#0EA5E9", shopping: "#F472B6",
  };
  return map[cat.toLowerCase()] ?? "#94A3B8";
}

function CatDot({ cat, size = 8 }: { cat: string; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: getCategoryColor(cat),
      flexShrink: 0,
    }} />
  );
}

function autoDetectCategory(label: string): BudgetLine["category"] {
  const l = label.toLowerCase();
  if (/rent|mortgage|hoa/.test(l)) return "housing";
  if (/car\s*(note|payment|loan)|auto|vehicle|gas|fuel|uber|lyft|transit|bus|train|parking|toll/.test(l)) return "transport";
  if (/grocer|grocery|food|walmart|target|costco|trader\s*joe|whole\s*food|aldi|kroger|safeway|instacart/.test(l)) return "food";
  if (/phone|internet|cable|electric|water|utility|utilities|ymca|gym|fitness/.test(l)) return "utilities";
  if (/saving|emergency fund|invest|401k|roth|ira|sinking fund/.test(l)) return "savings";
  if (/transfer|bofa|chase|wells\s*fargo|citi|deposit/.test(l)) return "transfer";
  return "other";
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
function UpcomingChecksCard({ yearPlan, effectiveTakeHome, budgetLines, pc, paycheckPlans, onUpdatePaycheckPlans }: {
  yearPlan: CheckSlot[]; effectiveTakeHome: number; budgetLines: BudgetLine[]; pc: PaycheckConfig;
  paycheckPlans: Record<string, PaycheckPlanData>; onUpdatePaycheckPlans: (p: Record<string, PaycheckPlanData>) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll,  setShowAll]  = useState(false);
  const visible = showAll ? yearPlan : yearPlan.slice(0, 8);

  const addToPlan = (key: string, label: string, amount: number, category: string) => {
    const existing = paycheckPlans[key] ?? { overrides: {}, oneTimeItems: [] };
    if (existing.oneTimeItems.some(o => o.label === label)) return;
    onUpdatePaycheckPlans({ ...paycheckPlans, [key]: { ...existing, oneTimeItems: [...existing.oneTimeItems, { id: id(), label, amount, category }] } });
  };
  const isInPlan = (key: string, label: string) =>
    (paycheckPlans[key]?.oneTimeItems ?? []).some(o => o.label === label);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {visible.map((slot, idx) => {
        const key      = format(slot.checkDate, "yyyy-MM-dd");
        const isExp    = expanded === key;
        const focus    = slot.focusItem;
        const freeAft  = slot.free - (focus?.cost ?? 0);
        const sc       = freeAft < 0 ? RED : freeAft < 100 ? AMBER : "#10B981";
        const prevSlot = visible[idx - 1];
        const newMonth = !prevSlot || format(prevSlot.checkDate, "MM-yyyy") !== format(slot.checkDate, "MM-yyyy");
        return (
          <div key={key}>
            {newMonth && (
              <div className="px-4 py-2" style={{ background: "rgba(124,92,252,0.03)", borderBottom: `1px solid ${BORDER}` }}>
                <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.07em" }}>{format(slot.checkDate, "MMMM yyyy").toUpperCase()}</p>
              </div>
            )}
            <button onClick={() => setExpanded(isExp ? null : key)} className="w-full px-4 py-3.5 flex items-center justify-between text-left" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{format(slot.checkDate, "EEE, MMM d")}</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {focus
                    ? `${focus.emoji} ${focus.name} · ${fmt$(focus.cost)}`
                    : slot.dueBills.length > 0
                    ? `${slot.dueBills.length} bill${slot.dueBills.length > 1 ? "s" : ""} due · ${fmt$(slot.billsTotal)}`
                    : "No self-care scheduled"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: sc }}>{fmt$(Math.max(0, freeAft))}</p>
                  <p className="text-xs" style={{ color: MUTED }}>free</p>
                </div>
                <ChevronDown size={13} style={{ color: MUTED, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>
            </button>
            {isExp && (
              <div className="px-4 py-3 space-y-2" style={{ background: "rgba(124,92,252,0.02)", borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: MUTED }}>Paycheck</span>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{fmt$(effectiveTakeHome)}</span>
                </div>
                {slot.savings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: MUTED }}>Savings ({pc.savingsPercent}%)</span>
                    <span className="font-semibold" style={{ color: "#10B981" }}>−{fmt$(slot.savings)}</span>
                  </div>
                )}
                {budgetLines.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <CatChip cat={l.category} />
                      <span style={{ color: "var(--text)" }}>{l.label}</span>
                    </div>
                    <span className="font-semibold" style={{ color: AMBER }}>−{fmt$(l.amountPerCheck)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>Available</span>
                  <span className="font-bold" style={{ color: "var(--text)" }}>{fmt$(slot.free)}</span>
                </div>
                {focus && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span style={{ color: slot.canAfford ? "#10B981" : RED }}>{focus.emoji} {focus.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold" style={{ color: slot.canAfford ? "#10B981" : RED }}>−{fmt$(focus.cost)}</span>
                      {isInPlan(key, focus.name) ? (
                        <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>Added ✓</span>
                      ) : (
                        <button onClick={() => addToPlan(key, focus.name, focus.cost, "other")}
                          className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
                          + Plan
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {slot.dueBills.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-sm gap-2">
                    <span style={{ color: MUTED }}>🧾 {b.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold" style={{ color: AMBER }}>−{fmt$(b.amount)}</span>
                      {isInPlan(key, b.name) ? (
                        <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>Added ✓</span>
                      ) : (
                        <button onClick={() => addToPlan(key, b.name, b.amount, autoDetectCategory(b.name))}
                          className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
                          + Plan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>Yours after</span>
                  <span className="text-base font-bold" style={{ color: sc }}>{fmt$(Math.max(0, freeAft))}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!showAll && yearPlan.length > 8 && (
        <button onClick={() => setShowAll(true)} className="w-full py-3 text-xs text-center" style={{ color: MUTED }}>
          Show all {yearPlan.length} checks ▼
        </button>
      )}
      {showAll && (
        <button onClick={() => setShowAll(false)} className="w-full py-3 text-xs text-center" style={{ color: MUTED }}>
          Show less ▲
        </button>
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
  const [checkOffset, setCheckOffset]       = useState(0); // 0=this check, 1=next check, etc.
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
      <div className="px-4 md:px-5 pt-5 md:pt-8 pb-4 md:pb-5">
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
              className="flex-1 py-2 md:py-1.5 rounded-lg text-xs font-semibold transition-all"
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

      <div className="px-4 md:px-5 pb-16">
        {tab === "health" && (
          <HealthTab
            health={health}
            accounts={accounts} loadingAccts={loadingAccts} refreshing={refreshing}
            accountTransfers={accountTransfers}
            yearPlan={yearPlan} effectiveTakeHome={effectiveTakeHome}
            onRefresh={handleRefresh} onDisconnect={handleDisconnect}
            onConnected={() => fetchAccounts(true)}
            onAddTransfer={(t) => update(d => ({ ...d, accountTransfers: [t, ...(d.accountTransfers ?? [])] }))}
            onRemoveTransfer={(tid) => update(d => ({ ...d, accountTransfers: (d.accountTransfers ?? []).filter(t => t.id !== tid) }))}
          />
        )}
        {tab === "flow" && (() => {
          const selectedSlot = yearPlan[checkOffset] ?? yearPlan[0];
          const selectedPaydayStr = format(selectedSlot.checkDate, "yyyy-MM-dd");
          const isNextCheck = checkOffset > 0;
          return (<>
            {/* Paycheck switcher */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setCheckOffset(Math.max(0, checkOffset - 1))}
                disabled={checkOffset === 0}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all"
                style={{ background: checkOffset === 0 ? "transparent" : "rgba(124,92,252,0.1)", color: checkOffset === 0 ? MUTED : "#7C5CFC", border: `1px solid ${checkOffset === 0 ? "transparent" : "rgba(124,92,252,0.2)"}` }}>
                ‹
              </button>
              <div className="flex-1 text-center">
                <p className="text-xs font-semibold" style={{ color: isNextCheck ? "#7C5CFC" : LIME }}>
                  {isNextCheck ? `Check ${checkOffset + 1} — ` : "This Check — "}{format(selectedSlot.checkDate, "MMM d")}
                </p>
              </div>
              <button onClick={() => setCheckOffset(Math.min(yearPlan.length - 1, checkOffset + 1))}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all"
                style={{ background: "rgba(124,92,252,0.1)", color: "#7C5CFC", border: "1px solid rgba(124,92,252,0.2)" }}>
                ›
              </button>
            </div>
          <FlowTab
            yearPlan={yearPlan} savingsAlerts={savingsAlerts}
            pc={pc} effectiveTakeHome={effectiveTakeHome}
            paydayStr={selectedPaydayStr}
            budgetLines={budgetLines} bills={bills} selfCare={selfCare}
            insights={insights} p2pTransfers={p2pTransfers}
            liabilities={liabilities} creditScores={data.creditScores ?? []}
            paycheckPlans={data.paycheckPlans ?? {}}
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
            onUpdatePaycheckPlans={(plans) => update(d => ({ ...d, paycheckPlans: plans }))}
            baseBudget={data.baseBudget ?? []}
            budgetPlans={data.budgetPlans ?? []}
            onUpdateBaseBudget={(b) => update(d => ({ ...d, baseBudget: b }))}
            onUpdateBudgetPlans={(p) => update(d => ({ ...d, budgetPlans: p }))}
            showToast={showToast}
          />
          </>);
        })()}
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
function HealthTab({ health, accounts, loadingAccts, refreshing, accountTransfers, yearPlan, effectiveTakeHome, onRefresh, onDisconnect, onConnected, onAddTransfer, onRemoveTransfer }: {
  health: ReturnType<typeof calcHealthGrade>;
  accounts: PlaidAccount[]; loadingAccts: boolean; refreshing: boolean;
  accountTransfers: AccountTransfer[]; yearPlan: CheckSlot[];
  effectiveTakeHome: number;
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
            <p className="text-sm font-semibold text-dark mt-0.5">{health.total}/100</p>
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
function FlowTab({ yearPlan, savingsAlerts, pc, effectiveTakeHome, paydayStr, budgetLines, bills, selfCare, insights, p2pTransfers, liabilities, creditScores, paycheckPlans, baseBudget, budgetPlans, onMarkBillPaid, onMarkFocusDone, onAddP2P, onRemoveP2P, onUpdateCare, onUpdateBills, onUpdateBudgetLines, onUpdatePc, onUpdatePaycheckPlans, onUpdateBaseBudget, onUpdateBudgetPlans, showToast }: {
  yearPlan: CheckSlot[]; savingsAlerts: SavingsAlert[];
  pc: PaycheckConfig; effectiveTakeHome: number; paydayStr: string;
  budgetLines: BudgetLine[]; bills: RecurringBill[]; selfCare: SelfCareItem[];
  insights: InsightsData | null; p2pTransfers: P2PTransfer[];
  liabilities: LiabilitiesData | null; creditScores: CreditScoreEntry[];
  paycheckPlans: Record<string, PaycheckPlanData>;
  baseBudget: BaseBudgetItem[];
  budgetPlans: BudgetPlan[];
  onMarkBillPaid: (id: string) => void; onMarkFocusDone: (id: string) => void;
  onAddP2P: (t: P2PTransfer) => void; onRemoveP2P: (tid: string) => void;
  onUpdateCare: (i: SelfCareItem[]) => void; onUpdateBills: (b: RecurringBill[]) => void;
  onUpdateBudgetLines: (bl: BudgetLine[]) => void; onUpdatePc: (p: PaycheckConfig) => void;
  onUpdatePaycheckPlans: (p: Record<string, PaycheckPlanData>) => void;
  onUpdateBaseBudget: (b: BaseBudgetItem[]) => void;
  onUpdateBudgetPlans: (p: BudgetPlan[]) => void;
  showToast: (m: string) => void;
}) {
  const [expanded,       setExpanded]       = useState<number | null>(null);
  const [showAllYear,    setShowAllYear]    = useState(false);
  const [showP2P,        setShowP2P]        = useState(false);
  const [showCareForm,   setShowCareForm]   = useState(false);
  const [showBillForm,   setShowBillForm]   = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [confirmReset,   setConfirmReset]   = useState(false);
  const [editLineId,     setEditLineId]     = useState<string | null>(null);
  const [editLineAmt,    setEditLineAmt]    = useState("");
  const [editId,         setEditId]         = useState<string | null>(null);
  const [editPay,        setEditPay]        = useState(false);
  const [editSavings,    setEditSavings]    = useState(false);
  const [editProjected,  setEditProjected]  = useState(false);

  const [name, setName]         = useState("");
  const [cost, setCost]         = useState(""); const [freqWeeks,setFreqWeeks]= useState("4");
  const [billName, setBillName] = useState(""); const [billAmt, setBillAmt] = useState(""); const [billDay, setBillDay] = useState("1");
  const [budgetLabel, setBudgetLabel] = useState(""); const [budgetAmt, setBudgetAmt] = useState("");
  const [budgetCat,   setBudgetCat]   = useState<BudgetLine["category"]>("other");
  const [budgetToAcct,setBudgetToAcct]= useState("");
  const [budgetAICmd,  setBudgetAICmd]  = useState("");
  const [budgetAIBusy, setBudgetAIBusy] = useState(false);
  const [budgetAISummary, setBudgetAISummary] = useState("");
  const [p2pPerson,  setP2pPerson]  = useState(""); const [p2pAmount,   setP2pAmount]   = useState("");
  const [p2pDir,     setP2pDir]     = useState<"sent"|"received">("sent");
  const [p2pPlatform,setP2pPlatform]= useState<P2PTransfer["platform"]>("zelle");
  const [p2pNote,    setP2pNote]    = useState("");
  const [payInput,   setPayInput]   = useState(String(pc.takeHomePerCheck));
  const [savingsPct, setSavingsPct] = useState(String(pc.savingsPercent));
  const [savingsMode, setSavingsMode] = useState<"pct" | "dollar">("pct");
  const [savingsDollar, setSavingsDollar] = useState(String(Math.round(pc.takeHomePerCheck * pc.savingsPercent / 100)));
  const [projInput,  setProjInput]  = useState(String(pc.projectedTakeHome ?? pc.takeHomePerCheck));

  const current      = yearPlan[0];
  const focus        = current.focusItem;
  const pushed       = current.pushedItem;
  const isPaid       = (b: RecurringBill) => !!(b.lastPaidDate && b.lastPaidDate >= paydayStr);
  const thisPlan       = paycheckPlans[paydayStr] ?? { overrides: {}, oneTimeItems: [] };
  const planIncome     = thisPlan.incomeOverride ?? effectiveTakeHome;
  const planSavings    = thisPlan.savingsOverride !== undefined ? thisPlan.savingsOverride : Math.round(planIncome * pc.savingsPercent / 100);
  const planLines      = budgetLines.map(l => ({ ...l, amountPerCheck: thisPlan.overrides[l.id] ?? l.amountPerCheck }));
  const planBudgetTot  = planLines.reduce((s, l) => s + l.amountPerCheck, 0);
  const planFree       = planIncome - planSavings - planBudgetTot - current.billsTotal;
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
    onUpdateCare([...selfCare, { id: id(), name, emoji: "●", cost: parseFloat(cost), frequencyWeeks: parseInt(freqWeeks), frequencyLabel: fl, color: COLORS[selfCare.length % COLORS.length], priority: selfCare.length }]);
    setName(""); setCost(""); setFreqWeeks("4"); setShowCareForm(false); showToast("Added!");
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
  const runBudgetAI = async () => {
    if (!budgetAICmd.trim() || budgetAIBusy || !budgetLines.length) return;
    setBudgetAIBusy(true); setBudgetAISummary("");
    try {
      const res = await fetch("/api/ai/budget", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetLines, command: budgetAICmd.trim(), takeHome: effectiveTakeHome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateBudgetLines(data.updatedLines);
      setBudgetAISummary(data.summary);
      setBudgetAICmd("");
      showToast("Budget updated!");
    } catch { setBudgetAISummary("Couldn't update — try again."); }
    finally { setBudgetAIBusy(false); }
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
      {/* ── THIS PAYCHECK PLAN ── */}
      <PaycheckPlanCard
        paydayStr={paydayStr}
        budgetLines={budgetLines}
        effectiveTakeHome={effectiveTakeHome}
        pc={pc}
        paycheckPlans={paycheckPlans}
        onUpdatePaycheckPlans={onUpdatePaycheckPlans}
        showToast={showToast}
      />

      {/* ── SAVINGS CALIBRATION ── */}
      <SavingsCalibrationCard
        yearPlan={yearPlan}
        paycheckPlans={paycheckPlans}
        onUpdatePaycheckPlans={onUpdatePaycheckPlans}
        effectiveTakeHome={effectiveTakeHome}
        pc={pc}
        budgetLines={budgetLines}
        showToast={showToast}
      />

      {/* ── UPCOMING CHECKS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>UPCOMING CHECKS</p>
        </div>
        <UpcomingChecksCard yearPlan={yearPlan} effectiveTakeHome={effectiveTakeHome} budgetLines={budgetLines} pc={pc}
          paycheckPlans={paycheckPlans} onUpdatePaycheckPlans={onUpdatePaycheckPlans} />
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
              {([
                { label: "Paycheck",  amount: planIncome,    color: "var(--text)", isIncome: true },
                { label: "Savings",   amount: planSavings,   color: "#9B7FFF",     isIncome: false, cat: "savings" as BudgetLine["category"] },
                ...planLines.map(l => ({ label: l.label, amount: l.amountPerCheck, color: AMBER, isIncome: false, cat: l.category })),
                { label: "Bills",     amount: current.billsTotal, color: AMBER,    isIncome: false, cat: undefined },
                { label: focus.name,  amount: focus.cost,    color: current.canAfford ? LIME : RED, isIncome: false, cat: undefined },
              ] as { label: string; amount: number; color: string; isIncome: boolean; cat?: BudgetLine["category"] }[]).filter(r => r.amount > 0).map(r => (
                <div key={r.label} className="flex justify-between text-sm items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.cat && <CatChip cat={r.cat} />}
                    <span className="truncate" style={{ color: "var(--text)" }}>{r.label}</span>
                  </div>
                  <span className="font-semibold flex-shrink-0" style={{ color: r.color }}>{r.isIncome ? fmt$(r.amount) : `−${fmt$(r.amount)}`}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="text-sm" style={{ color: MUTED }}>Yours after</span>
                <span className="text-2xl font-bold" style={{ color: planFree - focus.cost >= 0 ? LIME : RED }}>
                  {fmt$(Math.max(0, planFree - focus.cost))}
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
            <p className="text-sm font-semibold text-dark">{pushed.name} is pushed</p>
            <p className="text-xs" style={{ color: AMBER }}>{fmt$(pushed.cost)} — affordable on {current.pushedTo ? fmtDate(current.pushedTo) : "a future check"}</p>
          </div>
        </div>
      )}

      {/* Bills this period */}
      {current.dueBills.length > 0 && (() => {
        const paidBills   = current.dueBills.filter(b => isPaid(b));
        const unpaidBills = current.dueBills.filter(b => !isPaid(b));
        const paidTotal   = paidBills.reduce((s, b) => s + b.amount, 0);
        const unpaidTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);
        // What's left after savings + budget lines + ALL bills clear
        const afterEverything = planIncome - planSavings - planBudgetTot - current.billsTotal;
        // What's in your pocket right now (savings + budget lines already pulled, only paid bills pulled)
        const rightNow = planIncome - planSavings - planBudgetTot - paidTotal;
        return (
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>BILLS THIS PERIOD</p>

          {/* Remaining balance tracker */}
          <div className="rounded-2xl px-4 py-4 mb-3 space-y-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.07em" }}>REMAINING BALANCE</span>
              {paidBills.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>
                  {paidBills.length}/{current.dueBills.length} paid
                </span>
              )}
            </div>

            {/* Waterfall */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--text)" }}>Paycheck</span>
                <span className="font-semibold" style={{ color: LIME }}>{fmt$(planIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: MUTED }}>Savings + planned</span>
                <span style={{ color: MUTED }}>−{fmt$(planSavings + planBudgetTot)}</span>
              </div>
              {paidTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: MUTED }}>Bills paid so far</span>
                  <span style={{ color: MUTED }}>−{fmt$(paidTotal)}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${BORDER}` }} />

            {/* Right now */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>In your pocket now</p>
                {unpaidTotal > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>{unpaidBills.length} bill{unpaidBills.length !== 1 ? "s" : ""} still out — {fmt$(unpaidTotal)} left to clear</p>
                )}
              </div>
              <p className="text-2xl font-bold" style={{ color: rightNow >= 0 ? LIME : RED }}>{fmt$(Math.max(0, rightNow))}</p>
            </div>

            {/* After everything clears */}
            {unpaidTotal > 0 && (
              <div className="flex justify-between items-center pt-1" style={{ borderTop: `1px dashed ${BORDER}` }}>
                <p className="text-xs" style={{ color: MUTED }}>After all bills clear</p>
                <p className="text-sm font-bold" style={{ color: afterEverything >= 0 ? "#10B981" : RED }}>{fmt$(Math.max(0, afterEverything))}</p>
              </div>
            )}
          </div>

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
        );
      })()}

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
                <p className="text-sm font-semibold text-dark">{a.item.emoji} {a.item.name} — {fmtDate(a.checkDate)}</p>
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
                            <div className="w-6 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item?.color ?? MUTED }} />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-dark">{item?.name ?? "Free check"}{isPushedSlot && <span className="ml-1.5 text-xs" style={{ color: AMBER }}>pushed</span>}</p>
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
                              { label: "Paycheck",  amount: effectiveTakeHome,       color: "var(--text)", prefix: "", cat: "transfer" },
                              { label: "Savings",   amount: slot.savings,            color: "#9B7FFF",prefix: "−", cat: "savings" },
                              { label: "Bills",     amount: slot.billsTotal,         color: AMBER,    prefix: "−", cat: "utilities" },
                              ...(slot.focusItem  ? [{ label: slot.focusItem.name, amount: slot.focusItem.cost, color: LIME, prefix: "−", cat: "other" }] : []),
                              ...(slot.pushedItem ? [{ label: `${slot.pushedItem.name} (pushed)`, amount: slot.pushedItem.cost, color: AMBER, prefix: "", cat: "other" }] : []),
                            ].filter(r => r.amount > 0).map(r => (
                              <div key={r.label} className="flex justify-between items-center text-xs gap-2">
                                <span className="flex items-center gap-1.5" style={{ color: MUTED }}><CatDot cat={r.cat} size={6} />{r.label}</span>
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
        <p className="text-xs font-semibold mb-4" style={{ color: LIME, letterSpacing: "0.12em" }}>MANAGE YOUR PLAN</p>

        {/* Today's real-time spend */}
        <TodaySpendCard baseBudget={baseBudget} />

        {/* Income settings */}
        <div className="mb-5">
          <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.08em" }}>YOUR INCOME</p>
          <p className="text-xs mb-3" style={{ color: "var(--text-light)" }}>Edit your take-home and savings rate</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div><p className="text-sm" style={{ color: "var(--text)" }}>Take-home per check</p><p className="text-xs mt-0.5" style={{ color: MUTED }}>your actual deposit amount</p></div>
              {editPay ? (
                <div className="flex items-center gap-2">
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dark">$</span>
                    <input type="number" value={payInput} onChange={e => setPayInput(e.target.value)} className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} /></div>
                  <button onClick={() => { onUpdatePc({ ...pc, takeHomePerCheck: parseFloat(payInput) || pc.takeHomePerCheck }); setEditPay(false); showToast("Updated!"); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-dark">{fmt$(pc.takeHomePerCheck)}</p>
                  <button onClick={() => setEditPay(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div><p className="text-sm" style={{ color: "var(--text)" }}>Projected</p>{pc.projectedTakeHome && <p className="text-xs" style={{ color: AMBER }}>Used for math</p>}</div>
              {editProjected ? (
                <div className="flex items-center gap-2">
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dark">$</span>
                    <input type="number" value={projInput} onChange={e => setProjInput(e.target.value)} className="w-28 rounded-lg pl-7 pr-3 py-1.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} /></div>
                  <button onClick={() => { const v = parseFloat(projInput); onUpdatePc({ ...pc, projectedTakeHome: v && v !== pc.takeHomePerCheck ? v : undefined }); setEditProjected(false); showToast("Updated!"); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: LIME, color: "#fff"}}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-dark">{pc.projectedTakeHome ? fmt$(pc.projectedTakeHome) : <span style={{ color: MUTED }}>Not set</span>}</p>
                  <button onClick={() => setEditProjected(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>{pc.projectedTakeHome ? "Edit" : "Set"}</button>
                  {pc.projectedTakeHome && <button onClick={() => { onUpdatePc({ ...pc, projectedTakeHome: undefined }); showToast("Cleared."); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(218,102,123,0.1)", color: RED }}>Clear</button>}
                </div>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm" style={{ color: "var(--text)" }}>Savings per check</p>
                  {!editSavings && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{pc.savingsPercent}% · {fmt$(Math.round(pc.takeHomePerCheck * pc.savingsPercent / 100))}</p>}
                </div>
                {!editSavings && <button onClick={() => setEditSavings(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>}
              </div>
              {editSavings && (
                <div className="space-y-2">
                  {/* Mode toggle */}
                  <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                    <button onClick={() => setSavingsMode("pct")} className="flex-1 py-1.5 text-xs font-semibold"
                      style={savingsMode === "pct" ? { background: LIME, color: "#fff" } : { color: MUTED }}>% of check</button>
                    <button onClick={() => setSavingsMode("dollar")} className="flex-1 py-1.5 text-xs font-semibold"
                      style={savingsMode === "dollar" ? { background: LIME, color: "#fff" } : { color: MUTED }}>$ amount</button>
                  </div>
                  {savingsMode === "pct" ? (
                    <div className="flex gap-1 flex-wrap">
                      {["5","10","15","20","25"].map(p => (
                        <button key={p} onClick={() => setSavingsPct(p)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={savingsPct === p ? { background: LIME, color: "#fff" } : { background: "rgba(124,92,252,0.07)", color: MUTED }}>
                          {p}% · {fmt$(Math.round(pc.takeHomePerCheck * parseInt(p) / 100))}
                        </button>
                      ))}
                      <div className="relative">
                        <input type="number" value={savingsPct} onChange={e => setSavingsPct(e.target.value)}
                          placeholder="custom" className="w-20 rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: MUTED }}>$</span>
                      <input type="number" value={savingsDollar} onChange={e => setSavingsDollar(e.target.value)}
                        placeholder="e.g. 300" className="w-full pl-7 pr-3 py-2 rounded-xl text-sm outline-none"
                        style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                    </div>
                  )}
                  {savingsMode === "dollar" && savingsDollar && pc.takeHomePerCheck > 0 && (
                    <p className="text-xs" style={{ color: MUTED }}>
                      = {Math.round((parseFloat(savingsDollar) / pc.takeHomePerCheck) * 100)}% of your check · {fmt$(parseFloat(savingsDollar) * 26)}/yr
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const pct = savingsMode === "pct"
                        ? parseInt(savingsPct) || 0
                        : Math.round((parseFloat(savingsDollar) / pc.takeHomePerCheck) * 100);
                      onUpdatePc({ ...pc, savingsPercent: pct });
                      setEditSavings(false);
                      showToast("Savings updated!");
                    }} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
                    <button onClick={() => setEditSavings(false)} className="px-3 py-2 rounded-xl text-xs" style={{ color: MUTED }}>Cancel</button>
                  </div>
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
            <div className="flex items-center gap-2">
              {confirmReset ? (
                <>
                  <span className="text-xs" style={{ color: MUTED }}>Clear all?</span>
                  <button onClick={() => { onUpdateBudgetLines([]); onUpdatePaycheckPlans({}); setConfirmReset(false); showToast("Budget lines cleared"); }} className="text-xs px-2 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: RED }}>Yes, clear</button>
                  <button onClick={() => setConfirmReset(false)} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => onUpdateBudgetLines(budgetLines.map(l => ({ ...l, category: autoDetectCategory(l.label) })))} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Auto-fix</button>
                  <button onClick={() => setConfirmReset(true)} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: RED }}>Reset</button>
                  <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}><Plus size={12} /> Add</button>
                </>
              )}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2.5"><CatDot cat="transfer" size={10} /><p className="text-sm font-semibold text-dark">Paycheck</p></div>
              <p className="text-sm font-bold text-dark">{fmt$(effectiveTakeHome)}</p>
            </div>
            {pc.savingsPercent > 0 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2.5"><CatDot cat="savings" size={10} /><p className="text-sm" style={{ color: "#9B7FFF" }}>Savings ({pc.savingsPercent}%)</p></div>
                <p className="text-sm font-semibold" style={{ color: "#9B7FFF" }}>−{fmt$(Math.round(effectiveTakeHome * pc.savingsPercent / 100))}</p>
              </div>
            )}
            {budgetLines.map(line => (
              <div key={line.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                {editLineId === line.id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CatDot cat={line.category} />
                      <p className="text-sm truncate" style={{ color: "var(--text)" }}>{line.label || line.toAccount || line.category}</p>
                    </div>
                    <span className="text-sm" style={{ color: MUTED }}>$</span>
                    <input
                      type="number"
                      value={editLineAmt}
                      onChange={e => setEditLineAmt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const v = parseFloat(editLineAmt);
                          if (!isNaN(v) && v >= 0) { onUpdateBudgetLines(budgetLines.map(l => l.id === line.id ? { ...l, amountPerCheck: v } : l)); showToast("Updated!"); }
                          setEditLineId(null);
                        }
                        if (e.key === "Escape") setEditLineId(null);
                      }}
                      autoFocus
                      className="w-20 text-sm text-right rounded-lg px-2 py-1"
                      style={{ background: "rgba(124,92,252,0.08)", border: `1px solid ${BORDER}`, color: "var(--text)" }}
                    />
                    <button onClick={() => { const v = parseFloat(editLineAmt); if (!isNaN(v) && v >= 0) { onUpdateBudgetLines(budgetLines.map(l => l.id === line.id ? { ...l, amountPerCheck: v } : l)); showToast("Updated!"); } setEditLineId(null); }} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
                    <button onClick={() => setEditLineId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CatDot cat={line.category} />
                      <p className="text-sm" style={{ color: "var(--text)" }}>{line.label || line.toAccount || line.category}</p>
                      {line.isDetected && <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>auto</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-semibold" style={{ color: RED }}>−{fmt$(line.amountPerCheck)}</p>
                      <button onClick={() => { setEditLineId(line.id); setEditLineAmt(String(line.amountPerCheck)); }}><Pencil size={11} style={{ color: MUTED }} /></button>
                      <button onClick={() => { onUpdateBudgetLines(budgetLines.filter(l => l.id !== line.id)); showToast("Removed"); }}><Trash2 size={11} style={{ color: MUTED }} /></button>
                    </div>
                  </div>
                )}
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
                <input value={budgetLabel} onChange={e => { setBudgetLabel(e.target.value); setBudgetCat(autoDetectCategory(e.target.value)); }} placeholder="Label (e.g. Rent, BofA Transfer)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
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

          {/* AI Budget Adjuster */}
          {budgetLines.length > 0 && (
            <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(124,92,252,0.2)` }}>
              <p className="text-xs font-semibold mb-1" style={{ color: MUTED, letterSpacing: "0.08em" }}>AI ADJUST BUDGET</p>
              <p className="text-xs mb-2" style={{ color: "var(--text-light)" }}>
                &ldquo;Put half toward hair&rdquo; · &ldquo;Move $50 from food to savings&rdquo;
              </p>
              <div className="flex gap-2">
                <input value={budgetAICmd} onChange={e => setBudgetAICmd(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runBudgetAI()}
                  placeholder="Tell me how to adjust…"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
                <button onClick={runBudgetAI} disabled={budgetAIBusy || !budgetAICmd.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: "rgba(124,92,252,0.12)", color: LIME }}>
                  {budgetAIBusy ? "…" : "Go"}
                </button>
              </div>
              {budgetAISummary && (
                <p className="text-xs mt-2" style={{ color: budgetAISummary.includes("Couldn") ? RED : LIME }}>{budgetAISummary}</p>
              )}
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
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color ?? LIME }} />
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
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Waxing, Lashes" className="w-full rounded-xl px-3 py-3 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
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
                  <div><p className="text-sm" style={{ color: "var(--text)" }}>{t.direction === "sent" ? "↑" : "↓"} {t.person}</p><p className="text-xs" style={{ color: MUTED }}>{t.platform} · {t.date}{t.note ? ` · ${t.note}` : ""}</p></div>
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

        {/* ── Base Budget ── */}
        <BaseBudgetCard baseBudget={baseBudget} onUpdate={onUpdateBaseBudget} showToast={showToast} />

        {/* ── Budget Planner ── */}
        <BudgetPlannerCard budgetPlans={budgetPlans} onUpdate={onUpdateBudgetPlans} showToast={showToast} />

      </div>
    </div>
  );
}

// ── Base Budget Card ──────────────────────────────────────────────────────────
const BASE_BUDGET_DEFAULTS = [
  { emoji: "🏠", category: "Housing" },
  { emoji: "🛒", category: "Groceries" },
  { emoji: "🍽️", category: "Eating Out" },
  { emoji: "⛽", category: "Gas" },
  { emoji: "👗", category: "Shopping" },
  { emoji: "💊", category: "Health" },
  { emoji: "🎉", category: "Fun / Entertainment" },
  { emoji: "📦", category: "Subscriptions" },
  { emoji: "💇", category: "Self-Care" },
  { emoji: "✈️", category: "Travel" },
];

function BaseBudgetCard({ baseBudget, onUpdate, showToast }: {
  baseBudget: BaseBudgetItem[];
  onUpdate: (b: BaseBudgetItem[]) => void;
  showToast: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [addEmoji, setAddEmoji] = useState("📌");
  const [addCat, setAddCat] = useState("");
  const [addAmt, setAddAmt] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editVal, setEditVal] = useState("");

  const total = baseBudget.reduce((s, b) => s + b.monthlyLimit, 0);

  function saveEdit(itemId: string) {
    const val = parseFloat(editVal);
    if (!isNaN(val) && val >= 0) {
      onUpdate(baseBudget.map(b => b.id === itemId ? { ...b, monthlyLimit: val } : b));
      showToast("Updated!");
    }
    setEditing(null);
  }

  function addItem() {
    if (!addCat || !addAmt) return;
    const newItem: BaseBudgetItem = { id: id(), category: addCat, emoji: addEmoji, monthlyLimit: parseFloat(addAmt) };
    onUpdate([...baseBudget, newItem]);
    setAddCat(""); setAddAmt(""); setAddEmoji("📌"); setShowAddForm(false);
    showToast("Added!");
  }

  function loadDefaults() {
    const existing = new Set(baseBudget.map(b => b.category.toLowerCase()));
    const toAdd = BASE_BUDGET_DEFAULTS
      .filter(d => !existing.has(d.category.toLowerCase()))
      .map(d => ({ id: id(), category: d.category, emoji: d.emoji, monthlyLimit: 0 }));
    if (toAdd.length) { onUpdate([...baseBudget, ...toAdd]); showToast("Defaults loaded — set your amounts!"); }
    else showToast("All defaults already added");
  }

  return (
    <div className="mb-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-left" style={{ color: MUTED, letterSpacing: "0.08em" }}>MY BASE BUDGET</p>
          <p className="text-xs mt-0.5 text-left" style={{ color: "var(--text-light)" }}>
            {baseBudget.length > 0 ? `${baseBudget.length} categories · ${fmt$(total)}/mo` : "Set your monthly spending limits"}
          </p>
        </div>
        <span style={{ color: MUTED, fontSize: 16 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {baseBudget.length === 0 && (
            <div className="rounded-2xl p-5 text-center mb-3" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
              <p className="text-sm mb-3" style={{ color: MUTED }}>No budget set yet. Load defaults or add categories.</p>
              <button onClick={loadDefaults} className="text-xs px-4 py-2 rounded-xl font-semibold" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>
                Load Common Categories
              </button>
            </div>
          )}

          {baseBudget.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {baseBudget.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < baseBudget.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CatDot cat={item.category} />
                    <p className="text-sm truncate" style={{ color: "var(--text)" }}>{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editing === item.id ? (
                      <>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>$</span>
                          <input autoFocus type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                            onBlur={() => saveEdit(item.id)}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditing(null); }}
                            className="w-24 pl-5 pr-2 py-1 rounded-lg text-sm outline-none"
                            style={{ background: "rgba(124,92,252,0.07)", border: `1px solid rgba(124,92,252,0.3)` }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(item.id); setEditVal(String(item.monthlyLimit)); }}
                          className="text-sm font-semibold px-2 py-1 rounded-lg"
                          style={{ color: item.monthlyLimit > 0 ? LIME : MUTED, background: "rgba(124,92,252,0.05)" }}>
                          {item.monthlyLimit > 0 ? fmt$(item.monthlyLimit) : "Set"}
                        </button>
                        <span className="text-xs" style={{ color: MUTED }}>/mo</span>
                        <button onClick={() => { onUpdate(baseBudget.filter(b => b.id !== item.id)); }}><Trash2 size={11} style={{ color: MUTED }} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(124,92,252,0.04)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Total</p>
                <p className="text-sm font-bold" style={{ color: LIME }}>{fmt$(total)}/mo</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
              <Plus size={12} /> Add Category
            </button>
            {baseBudget.length === 0 && (
              <button onClick={loadDefaults} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>
                Load Defaults
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <input value={addCat} onChange={e => setAddCat(e.target.value)} placeholder="Category name (e.g. Groceries)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-2"
                style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: MUTED }}>$</span>
                <input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)} placeholder="Monthly limit"
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              </div>
              <button onClick={addItem} disabled={!addCat || !addAmt}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: LIME, color: "#fff" }}>
                Add to Budget
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Budget Planner Card ───────────────────────────────────────────────────────
const PLAN_CATEGORY_DEFAULTS = [
  { emoji: "🏠", category: "Housing" },
  { emoji: "🛒", category: "Groceries" },
  { emoji: "🍽️", category: "Eating Out" },
  { emoji: "⛽", category: "Gas" },
  { emoji: "💊", category: "Health" },
  { emoji: "🎉", category: "Fun" },
  { emoji: "💇", category: "Self-Care" },
  { emoji: "📦", category: "Subscriptions" },
  { emoji: "💰", category: "Savings" },
];

function BudgetPlannerCard({ budgetPlans, onUpdate, showToast }: {
  budgetPlans: BudgetPlan[];
  onUpdate: (p: BudgetPlan[]) => void;
  showToast: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanIncome, setNewPlanIncome] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemVal, setEditItemVal] = useState("");
  const [addItemEmoji, setAddItemEmoji] = useState("📌");
  const [addItemCat, setAddItemCat] = useState("");
  const [addItemAmt, setAddItemAmt] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);

  const activePlan = budgetPlans.find(p => p.id === activePlanId) ?? budgetPlans[0] ?? null;

  function createPlan() {
    if (!newPlanName) return;
    const defaultItems: BudgetPlanItem[] = PLAN_CATEGORY_DEFAULTS.map(d => ({
      id: id(), category: d.category, emoji: d.emoji, plannedMonthly: 0,
    }));
    const plan: BudgetPlan = {
      id: id(), name: newPlanName,
      createdAt: new Date().toISOString(),
      monthlyIncome: parseFloat(newPlanIncome) || 0,
      items: defaultItems,
    };
    onUpdate([...budgetPlans, plan]);
    setActivePlanId(plan.id);
    setNewPlanName(""); setNewPlanIncome(""); setShowCreateForm(false);
    showToast("Budget plan created!");
  }

  function updatePlanItem(planId: string, itemId: string, amount: number) {
    onUpdate(budgetPlans.map(p => p.id !== planId ? p : {
      ...p, items: p.items.map(i => i.id === itemId ? { ...i, plannedMonthly: amount } : i),
    }));
  }

  function addPlanItem(planId: string) {
    if (!addItemCat || !addItemAmt) return;
    const newItem: BudgetPlanItem = { id: id(), category: addItemCat, emoji: addItemEmoji, plannedMonthly: parseFloat(addItemAmt) };
    onUpdate(budgetPlans.map(p => p.id !== planId ? p : { ...p, items: [...p.items, newItem] }));
    setAddItemCat(""); setAddItemAmt(""); setAddItemEmoji("📌"); setShowAddItem(false);
    showToast("Added!");
  }

  function deletePlan(planId: string) {
    onUpdate(budgetPlans.filter(p => p.id !== planId));
    if (activePlanId === planId) setActivePlanId(null);
    showToast("Plan deleted");
  }

  return (
    <div className="mb-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-left" style={{ color: MUTED, letterSpacing: "0.08em" }}>BUDGET PLANNER</p>
          <p className="text-xs mt-0.5 text-left" style={{ color: "var(--text-light)" }}>
            {budgetPlans.length > 0 ? `${budgetPlans.length} plan${budgetPlans.length > 1 ? "s" : ""} saved` : "Draft your next budget"}
          </p>
        </div>
        <span style={{ color: MUTED, fontSize: 16 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {/* Plan selector */}
          {budgetPlans.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {budgetPlans.map(p => (
                <button key={p.id} onClick={() => setActivePlanId(p.id)}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                  style={activePlan?.id === p.id
                    ? { background: LIME, color: "#fff" }
                    : { background: "rgba(124,92,252,0.07)", color: MUTED }}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Active plan */}
          {activePlan && (
            <div className="rounded-2xl overflow-hidden mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {/* Plan header */}
              <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{activePlan.name}</p>
                  {activePlan.monthlyIncome > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                      Income: {fmt$(activePlan.monthlyIncome)}/mo · Allocated: {fmt$(activePlan.items.reduce((s, i) => s + i.plannedMonthly, 0))}/mo
                      {activePlan.monthlyIncome - activePlan.items.reduce((s, i) => s + i.plannedMonthly, 0) > 0 && (
                        <span style={{ color: LIME }}> · {fmt$(activePlan.monthlyIncome - activePlan.items.reduce((s, i) => s + i.plannedMonthly, 0))} left</span>
                      )}
                    </p>
                  )}
                </div>
                <button onClick={() => deletePlan(activePlan.id)}><Trash2 size={13} style={{ color: MUTED }} /></button>
              </div>

              {/* Remaining budget bar */}
              {activePlan.monthlyIncome > 0 && (() => {
                const allocated = activePlan.items.reduce((s, i) => s + i.plannedMonthly, 0);
                const pct = Math.min(100, Math.round((allocated / activePlan.monthlyIncome) * 100));
                const color = pct > 100 ? RED : pct > 85 ? AMBER : LIME;
                return (
                  <div className="px-4 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div className="h-2 rounded-full" style={{ background: "rgba(124,92,252,0.08)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="text-xs mt-1 text-right" style={{ color }}>{pct}% allocated</p>
                  </div>
                );
              })()}

              {/* Line items */}
              {activePlan.items.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: i < activePlan.items.length - 1 ? `1px solid ${BORDER}` : undefined }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CatDot cat={item.category} />
                    <p className="text-sm truncate" style={{ color: "var(--text)" }}>{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingItem === item.id ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>$</span>
                        <input autoFocus type="number" value={editItemVal}
                          onChange={e => setEditItemVal(e.target.value)}
                          onBlur={() => { const v = parseFloat(editItemVal); if (!isNaN(v)) updatePlanItem(activePlan.id, item.id, v); setEditingItem(null); }}
                          onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat(editItemVal); if (!isNaN(v)) updatePlanItem(activePlan.id, item.id, v); setEditingItem(null); } if (e.key === "Escape") setEditingItem(null); }}
                          className="w-24 pl-5 pr-2 py-1 rounded-lg text-sm outline-none"
                          style={{ background: "rgba(124,92,252,0.07)", border: `1px solid rgba(124,92,252,0.3)` }} />
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { setEditingItem(item.id); setEditItemVal(String(item.plannedMonthly)); }}
                          className="text-sm font-semibold px-2 py-1 rounded-lg"
                          style={{ color: item.plannedMonthly > 0 ? LIME : MUTED, background: "rgba(124,92,252,0.05)" }}>
                          {item.plannedMonthly > 0 ? fmt$(item.plannedMonthly) : "Set"}
                        </button>
                        <span className="text-xs" style={{ color: MUTED }}>/mo</span>
                        <button onClick={() => onUpdate(budgetPlans.map(p => p.id !== activePlan.id ? p : { ...p, items: p.items.filter(x => x.id !== item.id) }))}>
                          <Trash2 size={11} style={{ color: MUTED }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Add item row */}
              {showAddItem ? (
                <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <input value={addItemCat} onChange={e => setAddItemCat(e.target.value)} placeholder="Category"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-2"
                    style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>$</span>
                      <input type="number" value={addItemAmt} onChange={e => setAddItemAmt(e.target.value)} placeholder="Monthly amount"
                        className="w-full pl-6 pr-3 py-2 rounded-xl text-sm outline-none"
                        style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                    </div>
                    <button onClick={() => addPlanItem(activePlan.id)} disabled={!addItemCat || !addItemAmt}
                      className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                      style={{ background: LIME, color: "#fff" }}>Add</button>
                    <button onClick={() => setShowAddItem(false)} className="px-3 py-2 rounded-xl text-xs" style={{ color: MUTED }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddItem(true)}
                  className="w-full flex items-center justify-center gap-1 py-3 text-xs font-semibold"
                  style={{ color: MUTED, borderTop: `1px solid ${BORDER}` }}>
                  <Plus size={12} /> Add Category
                </button>
              )}
            </div>
          )}

          {budgetPlans.length === 0 && !showCreateForm && (
            <div className="rounded-2xl p-5 text-center mb-3" style={{ background: CARD, border: `1px dashed ${BORDER}` }}>
              <p className="text-sm mb-1" style={{ color: MUTED }}>No budget plans yet.</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>Draft a plan to see how a new income or budget would look.</p>
            </div>
          )}

          {/* Create plan button / form */}
          {!showCreateForm ? (
            <button onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(200,255,0,0.1)", color: LIME, border: `1px solid rgba(200,255,0,0.2)` }}>
              <Plus size={12} /> New Plan
            </button>
          ) : (
            <div className="rounded-2xl p-4 mt-2" style={{ background: CARD, border: `1px solid rgba(200,255,0,0.2)` }}>
              <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>NEW BUDGET PLAN</p>
              <div className="space-y-2 mb-3">
                <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder='Plan name (e.g. "After Raise", "July Budget")'
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: MUTED }}>$</span>
                  <input type="number" value={newPlanIncome} onChange={e => setNewPlanIncome(e.target.value)} placeholder="Monthly income (optional)"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createPlan} disabled={!newPlanName}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: LIME, color: "#fff" }}>Create Plan</button>
                <button onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
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
      <p className="text-sm" style={{ color: "var(--text)" }}>No debt accounts detected</p>
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
                      <p className="text-sm font-semibold text-dark flex items-center gap-2">💳 {cc.name}
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
                    <p className="text-sm font-semibold text-dark flex items-center gap-2">🎓 {loan.name}
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
                <p className="text-sm" style={{ color: "var(--text)" }}>{d.label}</p>
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
                <p className="text-sm" style={{ color: "var(--text)" }}>{b.name}</p>
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
            <h1 className="text-2xl font-bold text-dark mb-1">
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-dark">$</span>
                  <input type="number" value={takeHome} onChange={e => setTakeHome(e.target.value)} placeholder="e.g. 1800"
                    className="w-full rounded-2xl pl-8 pr-4 py-3.5 text-sm outline-none"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: MUTED }}>Projected take-home per check (your expected amount)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-dark">$</span>
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
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
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

// ── Savings Calibration Card ──────────────────────────────────────────────────
function SavingsCalibrationCard({ yearPlan, paycheckPlans, onUpdatePaycheckPlans, effectiveTakeHome, pc, budgetLines, showToast }: {
  yearPlan: CheckSlot[]; paycheckPlans: Record<string, PaycheckPlanData>;
  onUpdatePaycheckPlans: (p: Record<string, PaycheckPlanData>) => void;
  effectiveTakeHome: number; pc: PaycheckConfig; budgetLines: BudgetLine[];
  showToast: (m: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const MIN_BUFFER = 100;

  const warnings = yearPlan.slice(0, 26).flatMap(slot => {
    const key = format(slot.checkDate, "yyyy-MM-dd");
    const plan = paycheckPlans[key] ?? { overrides: {}, oneTimeItems: [] };
    if (plan.savingsOverride !== undefined) return []; // already handled
    const income       = plan.incomeOverride ?? effectiveTakeHome;
    const savings      = Math.round(income * pc.savingsPercent / 100);
    const budget       = budgetLines.reduce((s, l) => s + (plan.overrides[l.id] ?? l.amountPerCheck), 0);
    const oneTime      = plan.oneTimeItems.reduce((s, o) => s + o.amount, 0);
    const focusCost    = slot.focusItem?.cost ?? 0;
    const effectiveFree = income - savings - budget - slot.billsTotal - oneTime - focusCost;
    if (effectiveFree >= MIN_BUFFER) return [];
    const suggestedSavings = Math.max(0, income - budget - slot.billsTotal - oneTime - focusCost - MIN_BUFFER);
    return [{ slot, key, effectiveFree, savings, suggestedSavings, isNeg: effectiveFree < 0 }];
  });

  const visible = showAll ? warnings : warnings.slice(0, 3);

  if (warnings.length === 0) return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <span className="text-lg">✓</span>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#10B981" }}>Savings plan is solid</p>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>All upcoming checks are feasible at your current savings rate</p>
      </div>
    </div>
  );

  const negCount = warnings.filter(w => w.isNeg).length;

  return (
    <div>
      <p className="text-xs font-semibold mb-3" style={{ color: MUTED, letterSpacing: "0.08em" }}>SAVINGS CALIBRATION</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid rgba(245,158,11,0.3)` }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(245,158,11,0.04)" }}>
          <p className="text-sm font-semibold" style={{ color: AMBER }}>
            {negCount > 0 ? "⚠️" : "🔔"} {warnings.length} check{warnings.length !== 1 ? "s" : ""} need a savings adjustment
          </p>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            At your current savings rate, these dates get tight. Tap Fix to reduce savings just for that check.
          </p>
        </div>
        {visible.map(({ slot, key, effectiveFree, savings, suggestedSavings, isNeg }) => {
          const skipped = savings - suggestedSavings;
          return (
            <div key={key} className="px-4 py-3.5 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: isNeg ? RED : AMBER }}>
                  {fmtDate(slot.checkDate)}
                  {slot.focusItem ? ` · ${slot.focusItem.name}` : " · bills heavy"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {isNeg
                    ? `Short by ${fmt$(Math.abs(effectiveFree))} — `
                    : `Only ${fmt$(effectiveFree)} breathing room — `}
                  save {fmt$(suggestedSavings)} instead{skipped > 0 ? ` (hold back ${fmt$(skipped)})` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  const existing = paycheckPlans[key] ?? { overrides: {}, oneTimeItems: [] };
                  onUpdatePaycheckPlans({ ...paycheckPlans, [key]: { ...existing, savingsOverride: suggestedSavings } });
                  showToast(`Savings adjusted for ${fmtDate(slot.checkDate)}`);
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 mt-0.5"
                style={{ background: "rgba(245,158,11,0.12)", color: AMBER, border: "1px solid rgba(245,158,11,0.25)" }}>
                Fix it
              </button>
            </div>
          );
        })}
        {warnings.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full px-4 py-3 text-xs text-center" style={{ color: MUTED }}>
            {showAll ? "Show less ▲" : `Show ${warnings.length - 3} more ▼`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Paycheck Plan Card ────────────────────────────────────────────────────────
const CAT_COLORS: Record<BudgetLine["category"], string> = {
  housing: "#7C5CFC", transfer: "#6366F1", food: "#10B981",
  transport: "#FB923C", utilities: "#F59E0B", savings: "#10B981", other: "#7C6FAE",
};
function CatChip({ cat }: { cat: BudgetLine["category"] }) {
  const c = CAT_COLORS[cat] ?? "#7C6FAE";
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 capitalize"
      style={{ background: `${c}22`, color: c }}>{cat}</span>
  );
}

function CheckCircle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all"
      style={{ background: checked ? "#10B981" : "transparent", border: `2px solid ${checked ? "#10B981" : "rgba(124,92,252,0.25)"}` }}>
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
    </button>
  );
}

function PaycheckPlanCard({ paydayStr, budgetLines, effectiveTakeHome, pc, paycheckPlans, onUpdatePaycheckPlans, showToast }: {
  paydayStr: string; budgetLines: BudgetLine[]; effectiveTakeHome: number; pc: PaycheckConfig;
  paycheckPlans: Record<string, PaycheckPlanData>; onUpdatePaycheckPlans: (p: Record<string, PaycheckPlanData>) => void;
  showToast: (m: string) => void;
}) {
  const plan = paycheckPlans[paydayStr] ?? { overrides: {}, oneTimeItems: [] };
  const checkIns = plan.checkIns ?? {};
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editVal,      setEditVal]      = useState("");
  const [editSav,      setEditSav]      = useState(false);
  const [savVal,       setSavVal]       = useState("");
  const [editInc,      setEditInc]      = useState(false);
  const [incVal,       setIncVal]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [oneLabel,     setOneLabel]     = useState("");
  const [oneAmt,       setOneAmt]       = useState("");
  const [oneCat,       setOneCat]       = useState<BudgetLine["category"]>("other");
  const [actualEditId, setActualEditId] = useState<string | null>(null);
  const [actualVal,    setActualVal]    = useState("");

  const savePlan      = (next: PaycheckPlanData) => onUpdatePaycheckPlans({ ...paycheckPlans, [paydayStr]: next });
  const setOverride   = (lineId: string, amount: number) => savePlan({ ...plan, overrides: { ...plan.overrides, [lineId]: amount } });
  const clearOverride = (lineId: string) => { const next = { ...plan.overrides }; delete next[lineId]; savePlan({ ...plan, overrides: next }); };
  const addOneTime    = () => {
    if (!oneLabel || !oneAmt) return;
    savePlan({ ...plan, oneTimeItems: [...plan.oneTimeItems, { id: id(), label: oneLabel, amount: parseFloat(oneAmt), category: oneCat }] });
    setOneLabel(""); setOneAmt(""); setShowForm(false); showToast("Added!");
  };
  const removeOneTime  = (oid: string) => savePlan({ ...plan, oneTimeItems: plan.oneTimeItems.filter(o => o.id !== oid) });

  const toggleCheckIn = (itemId: string, budgetedAmt: number) => {
    const next = { ...checkIns };
    if (next[itemId]) { delete next[itemId]; }
    else { next[itemId] = { checkedAt: new Date().toISOString(), actualAmount: budgetedAmt }; }
    savePlan({ ...plan, checkIns: next });
  };
  const saveActual = (itemId: string, amount: number) => {
    savePlan({ ...plan, checkIns: { ...checkIns, [itemId]: { ...(checkIns[itemId] ?? { checkedAt: new Date().toISOString() }), actualAmount: amount } } });
    setActualEditId(null);
  };

  const income       = plan.incomeOverride ?? effectiveTakeHome;
  const savingsDed   = plan.savingsOverride !== undefined ? plan.savingsOverride : Math.round(income * pc.savingsPercent / 100);
  const totalBudget  = budgetLines.reduce((s, l) => s + (plan.overrides[l.id] ?? l.amountPerCheck), 0);
  const totalOneTime = plan.oneTimeItems.reduce((s, o) => s + o.amount, 0);
  const remaining    = income - savingsDed - totalBudget - totalOneTime;

  const totalItems   = budgetLines.length + plan.oneTimeItems.length + (pc.savingsPercent > 0 ? 1 : 0);
  const checkedCount = Object.keys(checkIns).length;

  const tx = { color: "var(--text)" } as const;
  const mx = { color: MUTED } as const;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: MUTED, letterSpacing: "0.08em" }}>THIS PAYCHECK</p>
          <p className="text-xs mt-0.5" style={mx}>{fmtDate(parseISO(paydayStr))} · tap circle to check in when paid</p>
        </div>
        {totalItems > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.12)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(checkedCount / totalItems * 100)}%`, background: "#10B981" }} />
            </div>
            <p className="text-xs font-semibold" style={{ color: checkedCount === totalItems ? "#10B981" : MUTED }}>
              {checkedCount}/{totalItems}
            </p>
          </div>
        )}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>

        {/* Income */}
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={tx}>Paycheck income</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={tx}>{fmt$(income)}</p>
              <button onClick={() => { setEditInc(!editInc); setIncVal(String(income)); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
            </div>
          </div>
          {plan.incomeOverride !== undefined && !editInc && <p className="text-xs mt-1" style={mx}>Standard: {fmt$(effectiveTakeHome)}</p>}
          {editInc && (
            <div className="mt-2 flex gap-2">
              <input type="number" value={incVal} onChange={e => setIncVal(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} placeholder="Take-home this check" />
              <button onClick={() => { savePlan({ ...plan, incomeOverride: parseFloat(incVal) || undefined }); setEditInc(false); showToast("Updated!"); }} className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
              {plan.incomeOverride !== undefined && <button onClick={() => { savePlan({ ...plan, incomeOverride: undefined }); setEditInc(false); showToast("Reset"); }} className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Reset</button>}
            </div>
          )}
        </div>

        {/* Savings */}
        {pc.savingsPercent > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}`, opacity: checkIns["__savings__"] ? 0.6 : 1 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle checked={!!checkIns["__savings__"]} onToggle={() => toggleCheckIn("__savings__", savingsDed)} />
                <CatChip cat="savings" />
                <p className="text-sm" style={tx}>Savings ({pc.savingsPercent}%)</p>
                {plan.savingsOverride !== undefined && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: AMBER }}>edited</span>}
              </div>
              <div className="flex items-center gap-2">
                {checkIns["__savings__"] ? (
                  <span className="text-xs font-semibold" style={{ color: "#10B981" }}>Transferred ✓</span>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: "#10B981" }}>−{fmt$(savingsDed)}</p>
                )}
                <button onClick={() => { setEditSav(!editSav); setSavVal(String(savingsDed)); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
              </div>
            </div>
            {plan.savingsOverride !== undefined && !editSav && <p className="text-xs mt-1 ml-8" style={mx}>Standard: {fmt$(Math.round(income * pc.savingsPercent / 100))}</p>}
            {editSav && (
              <div className="mt-2 flex gap-2">
                <input type="number" value={savVal} onChange={e => setSavVal(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} placeholder="Savings this check ($)" />
                <button onClick={() => { savePlan({ ...plan, savingsOverride: parseFloat(savVal) || 0 }); setEditSav(false); showToast("Updated!"); }} className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
                {plan.savingsOverride !== undefined && <button onClick={() => { savePlan({ ...plan, savingsOverride: undefined }); setEditSav(false); showToast("Reset"); }} className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Reset</button>}
              </div>
            )}
          </div>
        )}

        {/* Budget lines */}
        {budgetLines.map(line => {
          const isEditing    = editingId === line.id;
          const hasOverride  = plan.overrides[line.id] !== undefined;
          const displayAmt   = hasOverride ? plan.overrides[line.id] : line.amountPerCheck;
          const ci           = checkIns[line.id];
          const isChecked    = !!ci;
          const actualDiffers = ci && ci.actualAmount !== undefined && ci.actualAmount !== displayAmt;
          const isActualEdit = actualEditId === line.id;
          return (
            <div key={line.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}`, opacity: isChecked ? 0.65 : 1 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle checked={isChecked} onToggle={() => toggleCheckIn(line.id, displayAmt)} />
                  <CatChip cat={line.category} />
                  <p className="text-sm truncate" style={tx}>{line.label}</p>
                  {hasOverride && !isChecked && <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(245,158,11,0.15)", color: AMBER }}>edited</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isChecked ? (
                    <button onClick={() => { setActualEditId(isActualEdit ? null : line.id); setActualVal(String(ci.actualAmount ?? displayAmt)); }}
                      className="text-xs font-semibold" style={{ color: "#10B981" }}>
                      Paid {fmt$(ci.actualAmount ?? displayAmt)} {actualDiffers ? `(budget ${fmt$(displayAmt)})` : "✓"}
                    </button>
                  ) : (
                    <>
                      <p className="text-sm font-semibold" style={{ color: RED }}>−{fmt$(displayAmt)}</p>
                      <button onClick={() => { setEditingId(isEditing ? null : line.id); setEditVal(String(displayAmt)); }} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Edit</button>
                    </>
                  )}
                </div>
              </div>
              {isActualEdit && (
                <div className="mt-2 flex gap-2 ml-8">
                  <input type="number" value={actualVal} onChange={e => setActualVal(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} placeholder="Actual amount paid" />
                  <button onClick={() => saveActual(line.id, parseFloat(actualVal) || displayAmt)} className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "#10B981", color: "#fff" }}>Save</button>
                </div>
              )}
              {isEditing && !isChecked && (
                <div className="mt-2 flex gap-2 ml-8">
                  <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} placeholder="This paycheck amount" />
                  <button onClick={() => { setOverride(line.id, parseFloat(editVal) || 0); setEditingId(null); showToast("Updated!"); }} className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#fff" }}>Save</button>
                  {hasOverride && <button onClick={() => { clearOverride(line.id); setEditingId(null); showToast("Reset to standard"); }} className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(124,92,252,0.07)", color: MUTED }}>Reset</button>}
                </div>
              )}
              {hasOverride && !isEditing && !isChecked && <p className="text-xs mt-1 ml-8" style={mx}>Standard: {fmt$(line.amountPerCheck)}</p>}
            </div>
          );
        })}

        {/* One-time items */}
        {plan.oneTimeItems.map(o => {
          const ci        = checkIns[o.id];
          const isChecked = !!ci;
          return (
            <div key={o.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}`, opacity: isChecked ? 0.65 : 1 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle checked={isChecked} onToggle={() => toggleCheckIn(o.id, o.amount)} />
                  <CatChip cat={o.category as BudgetLine["category"]} />
                  <p className="text-sm truncate" style={tx}>{o.label}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(232,121,249,0.15)", color: "#E879F9" }}>once</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isChecked ? (
                    <span className="text-xs font-semibold" style={{ color: "#10B981" }}>Paid {fmt$(ci.actualAmount ?? o.amount)} ✓</span>
                  ) : (
                    <p className="text-sm font-semibold" style={{ color: RED }}>−{fmt$(o.amount)}</p>
                  )}
                  {!isChecked && <button onClick={() => removeOneTime(o.id)}><Trash2 size={11} style={{ color: MUTED }} /></button>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add one-time */}
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(232,121,249,0.1)", color: "#E879F9", border: "1px solid rgba(232,121,249,0.2)" }}>
            <Plus size={12} /> One-time item this check
          </button>
          {showForm && (
            <div className="mt-2 space-y-2">
              <input value={oneLabel} onChange={e => { setOneLabel(e.target.value); setOneCat(autoDetectCategory(e.target.value)); }} placeholder="Label (e.g. Car repair, Birthday gift)" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={oneAmt} onChange={e => setOneAmt(e.target.value)} placeholder="Amount ($)" className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }} />
                <select value={oneCat} onChange={e => setOneCat(e.target.value as BudgetLine["category"])} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ background: "rgba(124,92,252,0.07)", border: `1px solid ${BORDER}` }}>
                  <option value="housing">Housing</option><option value="transfer">Transfer</option><option value="food">Food</option><option value="transport">Transport</option><option value="utilities">Utilities</option><option value="savings">Savings</option><option value="other">Other</option>
                </select>
              </div>
              <button onClick={addOneTime} disabled={!oneLabel || !oneAmt} className="w-full py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: "#E879F9", color: "#fff" }}>Add This Check Only</button>
            </div>
          )}
        </div>

        {/* Remaining */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ background: remaining >= 0 ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)" }}>
          <p className="text-sm font-semibold" style={{ color: remaining >= 0 ? "#10B981" : RED }}>{remaining >= 0 ? "Yours to spend" : "Over budget"}</p>
          <p className="text-lg font-bold" style={{ color: remaining >= 0 ? "#10B981" : RED }}>{remaining >= 0 ? fmt$(remaining) : "−" + fmt$(Math.abs(remaining))}</p>
        </div>
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
                <p className="text-sm font-semibold text-dark">{inst}</p>
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
                      <p className="text-sm" style={{ color: "var(--text)" }}>{a.name}{a.mask ? ` ···${a.mask}` : ""}</p>
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
                  <p className="text-sm" style={{ color: "var(--text)" }}>{t.fromAccount} → {t.toAccount}</p>
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
            <p className="text-sm" style={{ color: "var(--text)" }}>No score logged yet</p>
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
