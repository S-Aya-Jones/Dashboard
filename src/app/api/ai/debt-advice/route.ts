import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

interface DebtCtx {
  takeHome: number;
  creditCards: { name: string; balance: number; minimumPayment: number | null; purchaseApr: number | null }[];
  studentLoans: { name: string; outstandingBalance: number; interestRate: number | null; minimumPayment: number | null }[];
  totalDebt: number;
  totalMinPayments: number;
  freeCash: number; // what's left after bills + budget lines each check
}

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const ctx: DebtCtx = await req.json();

    const ccLines = ctx.creditCards.map(c =>
      `- ${c.name}: $${c.balance} balance · ${c.purchaseApr ? c.purchaseApr + "% APR" : "APR unknown"} · min $${c.minimumPayment ?? "?"}/mo`
    ).join("\n");

    const loanLines = ctx.studentLoans.map(l =>
      `- ${l.name}: $${l.outstandingBalance} outstanding · ${l.interestRate ? l.interestRate + "% rate" : "rate unknown"} · min $${l.minimumPayment ?? "?"}/mo`
    ).join("\n");

    const prompt = `You are a direct, practical financial coach. Analyze this debt situation and give a specific payoff plan.

Biweekly take-home: $${ctx.takeHome}
Monthly take-home: ~$${Math.round(ctx.takeHome * 26 / 12)}
Free cash per check (after all obligations): $${ctx.freeCash}
Total debt: $${ctx.totalDebt}
Total minimum payments/month: $${ctx.totalMinPayments}

Credit Cards:
${ccLines || "None"}

Student Loans:
${loanLines || "None"}

Give exactly 3 things:
1. Which debt to hit first and the strategy (avalanche = highest APR first, snowball = lowest balance first) — name a specific account
2. Exact extra dollar amount to throw at it per check beyond minimums (based on their free cash)
3. One specific action that would improve their credit score within 90 days

Be direct. Name specific accounts. No fluff. 4 sentences max.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const advice = (msg.content[0] as { type: string; text: string }).text;
    return NextResponse.json({ advice });
  } catch (e) {
    console.error("Debt advice error:", e);
    return NextResponse.json({ error: "Could not generate advice" }, { status: 500 });
  }
}
