import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { stem, choices, correctLetter, explanation, mode, customQuestion } = await req.json();
  if (!stem || !choices) return NextResponse.json({ error: "No question provided" }, { status: 400 });

  const choicesText = (choices as { letter: string; text: string }[])
    .map((c) => `${c.letter}. ${c.text}`)
    .join("\n");

  const context = `Question:\n${stem}\n\nChoices:\n${choicesText}\n\nCorrect answer: ${correctLetter}\n\nExisting explanation: ${explanation || "(none provided)"}`;

  const instruction =
    mode === "slow"
      ? "Re-explain why the correct answer is right and why each wrong choice is wrong, like you're explaining to someone who is completely lost and needs the simplest possible breakdown. Use short sentences, plain language, and concrete analogies. No jargon without immediately defining it."
      : `Answer this follow-up question about the MCAT question above, directly and specifically: ${customQuestion}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are an MCAT tutor helping a student understand a practice question.\n\n${context}\n\n${instruction}`,
      }],
    });

    const answer = msg.content[0].type === "text" ? msg.content[0].text : "Unable to answer";
    return NextResponse.json({ answer });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
