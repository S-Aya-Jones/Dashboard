import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

interface ChatCtx {
  question: string;
  takeHome: number;
  freeCash: number;
  savings: number;
  billsTotal: number;
  budgetLines: { label: string; amount: number }[];
  upcomingServices: { name: string; cost: number; date: string; canAfford: boolean }[];
  totalDebt: number;
  creditScore?: number;
  employer?: string;
}

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const ctx: ChatCtx = await req.json();

    const budgetSummary = [
      `Take-home per check: $${ctx.takeHome}`,
      `Savings: $${ctx.savings}`,
      ...ctx.budgetLines.map(l => `${l.label}: $${l.amount}`),
      `Bills this period: $${ctx.billsTotal}`,
      `Free cash this check: $${ctx.freeCash}`,
    ].join("\n");

    const servicesSummary = ctx.upcomingServices.length
      ? ctx.upcomingServices.map(s =>
          `${s.name}: $${s.cost} on ${s.date} (${s.canAfford ? "affordable" : "tight"})`
        ).join("\n")
      : "None scheduled";

    const prompt = `You are a personal financial advisor. Answer this question concisely with exact dollar amounts from the context.

${ctx.employer ? `Employer: ${ctx.employer}` : ""}
Budget per check:
${budgetSummary}

Upcoming services:
${servicesSummary}

Total debt: $${ctx.totalDebt}
${ctx.creditScore ? `Credit score: ${ctx.creditScore}` : ""}

Question: "${ctx.question}"

Rules:
- Use exact dollar amounts from the context
- If asking about affording something, show: free cash - cost = what's left
- Be direct, 2-3 sentences max
- No generic advice, only answer based on their actual numbers`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const answer = (msg.content[0] as { type: string; text: string }).text;
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("Chat error:", e);
    return NextResponse.json({ error: "Could not answer" }, { status: 500 });
  }
}
