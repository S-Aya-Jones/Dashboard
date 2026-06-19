import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { loadData } from "@/lib/db";
import nodemailer from "nodemailer";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const CAT_MAP: Record<string, string> = {
  FOOD_AND_DRINK: "Eating Out",
  GROCERIES: "Groceries",
  GAS_STATIONS: "Gas",
  TRANSPORTATION: "Gas",
  ENTERTAINMENT: "Fun / Entertainment",
  PERSONAL_CARE: "Self-Care",
  MEDICAL: "Health",
  RENT_AND_UTILITIES: "Housing",
  GENERAL_MERCHANDISE: "Shopping",
  TRAVEL: "Travel",
  SUBSCRIPTION: "Subscriptions",
};
const SKIP_CATS = new Set(["TRANSFER_IN", "TRANSFER_OUT", "TRANSFER", "PAYMENT", "INCOME", "BANK_FEES", "LOAN_PAYMENTS"]);

export async function GET() {
  try {
    const [plaidItems, data] = await Promise.all([getPlaidItems("aya"), loadData()]);
    if (!plaidItems.length) return NextResponse.json({ transactions: [], alerts: [], spendByCategory: {} });

    const plaid = getPlaidClient();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const allTxns: Array<{
      id: string; name: string; amount: number; date: string;
      plaidCategory: string; mappedCategory: string; accountName: string;
    }> = [];

    for (const item of plaidItems) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp = await plaid.transactionsGet({
          access_token: token, start_date: yesterday, end_date: today,
          options: { count: 100 },
        });
        const acctNames: Record<string, string> = {};
        for (const a of resp.data.accounts) acctNames[a.account_id] = a.name;

        for (const tx of resp.data.transactions) {
          if (tx.amount <= 0) continue;
          const plaidCat = tx.personal_finance_category?.primary ?? (tx.category?.[0] ?? "OTHER");
          if (SKIP_CATS.has(plaidCat)) continue;
          const mapped = CAT_MAP[plaidCat] ?? "Other";
          allTxns.push({
            id: tx.transaction_id, name: tx.name, amount: tx.amount,
            date: tx.date, plaidCategory: plaidCat, mappedCategory: mapped,
            accountName: acctNames[tx.account_id] ?? "Account",
          });
        }
      } catch { /* skip */ }
    }

    const todayTxns = allTxns.filter(t => t.date === today);
    const spendByCategory: Record<string, number> = {};
    for (const t of todayTxns) {
      spendByCategory[t.mappedCategory] = (spendByCategory[t.mappedCategory] ?? 0) + t.amount;
    }

    const baseBudget = data.baseBudget ?? [];
    const alerts: Array<{ category: string; spent: number; limit: number; pct: number }> = [];
    for (const item of baseBudget) {
      const spent = spendByCategory[item.category] ?? 0;
      if (spent > 0 && item.monthlyLimit > 0) {
        const pct = Math.round((spent / (item.monthlyLimit / 30)) * 100);
        alerts.push({ category: item.category, spent, limit: item.monthlyLimit, pct });
      }
    }
    // Unbudgeted categories with spend today
    for (const [cat, spent] of Object.entries(spendByCategory)) {
      if (!baseBudget.some(b => b.category === cat)) {
        alerts.push({ category: cat, spent, limit: 0, pct: 0 });
      }
    }

    return NextResponse.json({ transactions: todayTxns, spendByCategory, alerts, date: today });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { txnName, txnAmount, category, budgetedMonthly, draft: preApprovedDraft, action } = body;
    const data = await loadData();
    const phone = (data.sms?.phoneNumber ?? process.env.USER_PHONE_NUMBER ?? "6156811609").replace(/\D/g, "").replace(/^1/, "");

    if (action === "send" && preApprovedDraft) {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD;
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } });
        await transporter.sendMail({ from: gmailUser, to: `${phone}@tmomail.net`, subject: " ", text: preApprovedDraft });
      }
      return NextResponse.json({ sent: true });
    }

    // Generate draft
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `Write a short (1-2 sentence) SMS to Aya about this transaction: $${txnAmount} at "${txnName}" (${category}). ${budgetedMonthly ? `Her monthly budget for ${category} is $${budgetedMonthly}, so this is $${(txnAmount / (budgetedMonthly / 30)).toFixed(0)}% of today's daily budget.` : "This category has no budget set."} Ask if it was intentional or note it clearly. No emojis. Direct, not preachy.`,
      }],
    });

    const draft = msg.content[0].type === "text" ? msg.content[0].text : `$${txnAmount} at ${txnName} — was this planned?`;
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
