import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export type TriageCategory = "reply" | "appointment" | "bill" | "school" | "spam" | "fyi";

interface EmailInput {
  id: string;
  from: string;
  subject: string;
  snippet: string;
}

export async function POST(req: NextRequest) {
  const { emails }: { emails: EmailInput[] } = await req.json();
  if (!emails?.length) return NextResponse.json({ results: [] });

  const prompt = `You are an email triage assistant. Categorize each email into exactly one category:
- "reply" — needs a personal response from the user
- "appointment" — medical, school, scheduling, or calendar-related
- "bill" — payment due, receipt, statement, subscription, or financial
- "school" — MCAT, medical school, academic, courses, study programs
- "spam" — marketing, promotions, newsletters, mass emails, unnecessary
- "fyi" — informational, no action needed, not spam

Return ONLY a JSON array like: [{"id":"...","category":"..."}]

Emails to categorize:
${emails.map(e => `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.snippet}`).join("\n---\n")}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ results });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
