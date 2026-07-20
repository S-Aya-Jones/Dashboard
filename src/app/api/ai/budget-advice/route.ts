import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

interface BudgetCtx {
  employer?: string;
  checkDate: string;
  takeHome: number;
  projectedTakeHome?: number;
  savings: number;
  bills: number;
  focusItem?: { name: string; cost: number; lastDone?: string; canAfford: boolean };
  pushedItem?: { name: string; cost: number; nextDate: string };
  freeAfterAll: number;
  yearChecksRemaining: number;
  totalYearTreatmentCost: number;
  savingsPercent: number;
}

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const ctx: BudgetCtx = await req.json();

    const lines = [
      `Employer: ${ctx.employer ?? "not specified"}`,
      `Check date: ${ctx.checkDate}`,
      `Take-home: $${ctx.projectedTakeHome ?? ctx.takeHome}${ctx.projectedTakeHome ? " (projected)" : ""}`,
      `Savings (${ctx.savingsPercent}%): $${ctx.savings}`,
      `Bills due: $${ctx.bills}`,
      ctx.focusItem
        ? `Self-care focus: ${ctx.focusItem.name} costs $${ctx.focusItem.cost} — ${ctx.focusItem.canAfford ? "AFFORDABLE" : "CANNOT AFFORD (pushed to next available)"}${ctx.focusItem.lastDone ? `, last done ${ctx.focusItem.lastDone}` : ", never tracked"}`
        : "No self-care assigned this check",
      ctx.pushedItem ? `Pushed from this check: ${ctx.pushedItem.name} → rescheduled to ${ctx.pushedItem.nextDate}` : "",
      `Free money after everything: $${ctx.freeAfterAll}`,
      `Checks remaining in ${new Date().getFullYear()}: ${ctx.yearChecksRemaining}`,
      `Total self-care cost for rest of year: $${ctx.totalYearTreatmentCost}`,
    ].filter(Boolean);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: "You are a sharp, warm financial coach for a biweekly-paid healthcare professional. Give 1-2 sentences of specific, actionable advice for this exact check. Use real dollar amounts from the data. Be direct and encouraging. No bullet points. No generic platitudes.",
      messages: [{ role: "user", content: `My check snapshot:\n${lines.join("\n")}\n\nWhat's my key action for this check?` }],
    });

    const advice = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    return NextResponse.json({ advice });
  } catch (e) {
    console.error("Budget advice error:", e);
    return NextResponse.json({ advice: "" }, { status: 500 });
  }
}
