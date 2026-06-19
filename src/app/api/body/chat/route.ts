import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { analysis, userMessage, conversationHistory } = await req.json();

  if (!userMessage) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  const systemPrompt = `You are an honest, direct fitness coach and body composition expert. You're having a conversation with someone about their body scan analysis.

You've already provided a detailed analysis of their body composition. Now you're answering follow-up questions.

Guidelines:
- Be honest and direct, never sugarcoat
- Use the analysis data provided to ground your responses
- Give specific, actionable advice
- If they ask about unrealistic goals, explain why and suggest realistic alternatives
- Be encouraging but realistic about timeline and effort
- Don't pretend to have access to data you don't — stick to what's visible in the photos
- If something is unclear, ask for clarification

Current Analysis:
${JSON.stringify(analysis, null, 2)}`;

  try {
    const messages = [
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ];

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    });

    const responseText = msg.content[0].type === "text" ? msg.content[0].text : "";

    return NextResponse.json({
      message: responseText,
      role: "assistant",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
