import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { Flashcard } from "@/types/dashboard";
import { randomUUID } from "crypto";
import { format } from "date-fns";

const client = new Anthropic();

interface GenerateRequest {
  subject: string;
  topic: string;
  count: number;
}

export async function POST(req: Request) {
  try {
    const { subject, topic, count }: GenerateRequest = await req.json();
    if (!subject || !topic) {
      return NextResponse.json({ error: "Subject and topic are required" }, { status: 400 });
    }

    const n = Math.min(Math.max(1, count || 3), 20);

    const prompt = `Generate ${n} MCAT flashcard${n > 1 ? "s" : ""} for the topic "${topic}" within "${subject}".

Each flashcard should have:
- A concise front (question or prompt, 1-2 sentences max)
- A clear back (answer or explanation, 2-4 sentences)

Return ONLY a JSON array, no markdown, no extra text:
[
  {"front": "question or prompt text", "back": "answer or explanation text"}
]

Make the cards useful for MCAT preparation — test conceptual understanding, key facts, and application.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are an expert MCAT tutor creating high-quality flashcards. Return ONLY valid JSON arrays, no markdown or extra text.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();

    let parsed: { front: string; back: string }[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON array from the response
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) {
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
      parsed = JSON.parse(match[0]);
    }

    const today = format(new Date(), "yyyy-MM-dd");

    const cards: Flashcard[] = parsed.map(item => ({
      id: randomUUID(),
      front: item.front,
      back: item.back,
      subject,
      topic,
      tags: [],
      deck: "MCAT",
      createdAt: new Date().toISOString(),
      state: "new" as const,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      learningStep: 0,
      nextReview: today,
    }));

    return NextResponse.json({ cards });
  } catch (e) {
    console.error("Flashcard generation error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
