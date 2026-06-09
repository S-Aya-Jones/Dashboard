import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface BudgetLineInput {
  id: string;
  label: string;
  amountPerCheck: number;
}

export async function POST(req: NextRequest) {
  const { budgetLines, command, takeHome }: { budgetLines: BudgetLineInput[]; command: string; takeHome: number } = await req.json();
  if (!budgetLines?.length || !command) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const total = budgetLines.reduce((s, l) => s + l.amountPerCheck, 0);

  const prompt = `You are a personal budget assistant. The user has a take-home pay of $${takeHome} per paycheck.

Current budget allocations per paycheck:
${budgetLines.map(l => `- ${l.label}: $${l.amountPerCheck} (id: ${l.id})`).join("\n")}
Total allocated: $${total}

The user says: "${command}"

Interpret their request and return ONLY a JSON array of the lines that need to change, with updated amounts. Do not change lines that weren't mentioned. Keep amounts as whole numbers. If the user says "half" of something, calculate half of the current amount.

Return ONLY a JSON array like: [{"id":"...","amountPerCheck":123}]`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const updates: { id: string; amountPerCheck: number }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const updatedLines = budgetLines.map(l => {
      const update = updates.find(u => u.id === l.id);
      return update ? { ...l, amountPerCheck: update.amountPerCheck } : l;
    });

    const summary = updates.map(u => {
      const orig = budgetLines.find(l => l.id === u.id);
      if (!orig) return "";
      const diff = u.amountPerCheck - orig.amountPerCheck;
      return `${orig.label}: $${orig.amountPerCheck} → $${u.amountPerCheck} (${diff >= 0 ? "+" : ""}${diff})`;
    }).filter(Boolean).join(", ");

    return NextResponse.json({ updatedLines, summary: summary || "No changes made" });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
