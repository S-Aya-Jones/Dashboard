import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { format, subDays, parseISO, differenceInDays, addDays } from "date-fns";

interface RawTxn { id: string; name: string; amount: number; date: string; category: string; }

// ── Keyword definitions ───────────────────────────────────────────────────────
const CARE_DEFS = [
  { key: "hair",    label: "Hair",          emoji: "💇🏾‍♀️", color: "#C8FF00",
    kw: ["salon", "hair salon", "braids", "loc style", "hair studio", "stylist",
         "natural hair", "beauty supply", "tress", "locs", "relaxer",
         "press and curl", "blowout", "hair care", "naturals", "dominican"] },
  { key: "nails",   label: "Nails",         emoji: "💅🏾",   color: "#DA667B",
    kw: ["nail ", "nails", "manicure", "pedicure", "nail bar", "nail spa",
         "gel nail", "nail lounge", "nail studio", "powder dip"] },
  { key: "skin",    label: "Skin & Facials", emoji: "🧖🏾‍♀️", color: "#A8967E",
    kw: ["facial", "esthetic", "medspa", "med spa", "esthetician",
         "skin treatment", "derma", "glow", "chemical peel", "microderm"] },
  { key: "mcat",    label: "MCAT Prep",     emoji: "📚",     color: "#6B8CAE",
    kw: ["aamc", "uworld", "mcat", "kaplan", "blueprint mcat", "exam prep", "test prep"] },
  { key: "fitness", label: "Gym",           emoji: "💪",     color: "#71816D",
    kw: ["ymca", "planet fitness", "crunch fitness", "anytime fitness",
         "equinox", "gold's gym", "la fitness", "fitness 19", "retro fitness"] },
  { key: "massage", label: "Massage",       emoji: "💆🏾‍♀️", color: "#C9B79C",
    kw: ["massage", "massage therapy", "elements massage", "massage envy"] },
  { key: "wax",     label: "Waxing",        emoji: "✨",     color: "#8A9E87",
    kw: ["wax ", "waxing", "european wax", "sugaring", "bare"] },
  { key: "lashes",  label: "Lashes",        emoji: "👁️",    color: "#E8A87C",
    kw: ["lash ", "lashes", "lash bar", "lash studio", "eyelash"] },
];

function matchKw(name: string, kw: string[]) {
  const lower = name.toLowerCase();
  return kw.some(k => lower.includes(k));
}

// ── Paycheck detection ────────────────────────────────────────────────────────
function detectPaychecks(txns: RawTxn[]) {
  const PAYROLL_KW = ["direct dep", "payroll", "adp", "gusto", "paychex", "workday", "paycheck", "salary", "hca", "hca healthcare", "hca inc"];

  // Plaid: negative amount = deposit (money IN)
  const deposits = txns.filter(t =>
    t.amount < -200 &&
    (t.category === "INCOME" || t.category === "TRANSFER_IN" ||
      PAYROLL_KW.some(k => t.name.toLowerCase().includes(k)))
  );

  // If no obvious payroll label, try any large regular deposit
  const candidates = deposits.length >= 2 ? deposits
    : txns.filter(t => t.amount < -600).slice(0, 20);

  if (candidates.length < 2) return null;

  const amounts = candidates.map(d => Math.abs(d.amount));
  const sorted  = [...amounts].sort((a, b) => a - b);
  const median  = sorted[Math.floor(sorted.length / 2)];

  const consistent = candidates.filter(d =>
    Math.abs(Math.abs(d.amount) - median) / median < 0.18
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (consistent.length < 2) return null;

  const dates = consistent.map(d => parseISO(d.date)).sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push(differenceInDays(dates[i], dates[i - 1]));
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

  const frequency = avgGap <= 9 ? "weekly" : avgGap <= 17 ? "biweekly" : avgGap <= 22 ? "semimonthly" : "monthly";
  const lastDate  = consistent[0].date;
  const nextEst   = format(addDays(parseISO(lastDate), Math.round(avgGap)), "yyyy-MM-dd");

  return { amount: Math.round(median), lastDate, nextEstimatedDate: nextEst, frequency, count: consistent.length, avgGap: Math.round(avgGap) };
}

// ── Self-care detection ───────────────────────────────────────────────────────
function detectSelfCare(txns: RawTxn[]) {
  return CARE_DEFS.map(def => {
    const matches = txns
      .filter(t => t.amount > 5 && !t.name.toLowerCase().includes("amazon") && matchKw(t.name, def.kw))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (matches.length === 0) return null;

    const amounts = matches.map(t => t.amount);
    const avgCost = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const minCost = Math.round(Math.min(...amounts));
    const maxCost = Math.round(Math.max(...amounts));

    const dates = matches.map(t => parseISO(t.date)).sort((a, b) => a.getTime() - b.getTime());
    let avgFreqDays = 30;
    if (dates.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < dates.length; i++) gaps.push(differenceInDays(dates[i], dates[i - 1]));
      avgFreqDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    }

    return {
      key: def.key, label: def.label, emoji: def.emoji, color: def.color,
      avgCost, minCost, maxCost,
      avgFreqDays: Math.max(7, avgFreqDays),
      lastDate: matches[0].date,
      count: matches.length,
      merchants: Array.from(new Set(matches.map(t => t.name))).slice(0, 3),
    };
  }).filter(Boolean);
}

// ── Recurring bill detection ───────────────────────────────────────────────────
function detectBills(txns: RawTxn[]) {
  const byMerchant = new Map<string, RawTxn[]>();
  for (const t of txns) {
    if (t.amount <= 0 || t.amount > 3000) continue;
    const k = t.name.toLowerCase().trim();
    if (!byMerchant.has(k)) byMerchant.set(k, []);
    byMerchant.get(k)!.push(t);
  }

  const recurring: { name: string; amount: number; dayOfMonth: number; count: number }[] = [];

  for (const [, list] of Array.from(byMerchant)) {
    if (list.length < 2) continue;
    const amounts = list.map(t => t.amount);
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (!amounts.every(a => Math.abs(a - avg) / avg < 0.12)) continue;

    const dates = list.map(t => parseISO(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push(differenceInDays(dates[i], dates[i - 1]));
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 24 || avgGap > 42) continue;

    recurring.push({
      name: list[list.length - 1].name,
      amount: Math.round(avg * 100) / 100,
      dayOfMonth: Math.round(dates.reduce((s, d) => s + d.getDate(), 0) / dates.length),
      count: list.length,
    });
  }

  return recurring.filter(b => b.amount >= 4).sort((a, b) => b.amount - a.amount).slice(0, 12);
}

// ── Post-paycheck split detection ─────────────────────────────────────────────
function detectPaycheckSplits(txns: RawTxn[]) {
  const PAYROLL_KW = ["direct dep", "payroll", "adp", "gusto", "paychex", "workday", "paycheck", "salary", "hca"];
  const deposits = txns.filter(t =>
    t.amount < -200 &&
    (t.category === "INCOME" || t.category === "TRANSFER_IN" ||
      PAYROLL_KW.some(k => t.name.toLowerCase().includes(k)))
  );
  if (deposits.length < 2) return [];

  const byKey = new Map<string, number[]>();
  for (const dep of deposits) {
    const depDate = parseISO(dep.date);
    const nearby = txns.filter(t => {
      if (t.amount <= 0) return false;
      const diff = differenceInDays(parseISO(t.date), depDate);
      if (diff < 0 || diff > 3) return false;
      const lower = t.name.toLowerCase();
      return (
        t.category === "TRANSFER_OUT" ||
        lower.includes("bank of america") || lower.includes("bofa") || lower.includes("boa") ||
        lower.includes("transfer") || lower.includes("zelle")
      );
    });
    for (const t of nearby) {
      const k = t.name.toLowerCase().trim();
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(t.amount);
    }
  }

  const splits: { toAccount: string; amount: number; count: number }[] = [];
  for (const [key, amounts] of Array.from(byKey)) {
    if (amounts.length < 2) continue;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (!amounts.every(a => Math.abs(a - avg) / avg < 0.15)) continue;
    const toAccount = (key.includes("bank of america") || key.includes("bofa") || key.includes("boa"))
      ? "Bank of America"
      : key.includes("zelle") ? "Zelle Transfer"
      : "Linked Account";
    splits.push({ toAccount, amount: Math.round(avg), count: amounts.length });
  }

  return splits.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

// ── Route handler ─────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>();

export async function GET() {
  const hit = cache.get("insights:aya");
  if (hit && Date.now() < hit.expiry) return NextResponse.json(hit.data);

  try {
    const items = await getPlaidItems("aya");
    if (items.length === 0) return NextResponse.json({ hasData: false });

    const client    = getPlaidClient();
    const endDate   = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), 180), "yyyy-MM-dd"); // 6 months

    const txns: RawTxn[] = [];
    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp  = await client.transactionsGet({
          access_token: token, start_date: startDate, end_date: endDate,
          options: { count: 500 },
        });
        for (const t of resp.data.transactions) {
          if (!t.pending) txns.push({
            id: t.transaction_id,
            name: t.merchant_name ?? t.name,
            amount: t.amount,
            date: t.date,
            category: t.personal_finance_category?.primary ?? "OTHER",
          });
        }
      } catch { /* skip failed item */ }
    }

    const result = {
      hasData: true,
      paycheck: detectPaychecks(txns),
      selfCare: detectSelfCare(txns),
      bills: detectBills(txns),
      paycheckSplits: detectPaycheckSplits(txns),
      transactionCount: txns.length,
      dateRange: { from: startDate, to: endDate },
    };

    cache.set("insights:aya", { data: result, expiry: Date.now() + 10 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Insights error:", e);
    return NextResponse.json({ error: "Could not analyze" }, { status: 500 });
  }
}
