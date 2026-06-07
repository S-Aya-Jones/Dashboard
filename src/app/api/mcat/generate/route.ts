import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MCATQuestion } from "@/types/dashboard";
import { randomUUID } from "crypto";

const client = new Anthropic();

interface GenerateRequest {
  selections: { subject: string; topic: string }[];
  count: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
}

export async function POST(req: Request) {
  try {
    const { selections, count, difficulty }: GenerateRequest = await req.json();
    if (!selections?.length) return NextResponse.json({ error: "No topics selected" }, { status: 400 });

    // Distribute questions across topics
    const perTopic = Math.max(1, Math.ceil(count / selections.length));
    const questions: MCATQuestion[] = [];

    for (const sel of selections) {
      if (questions.length >= count) break;
      const need = Math.min(perTopic, count - questions.length);
      const diff = difficulty === "mixed" ? "varying difficulty (mix of easy, medium, and hard)" : difficulty;

      const prompt = `Generate ${need} MCAT-style multiple choice question${need > 1 ? "s" : ""} on the topic "${sel.topic}" within "${sel.subject}".

Requirements:
- MCAT-level accuracy and scientific rigor — all facts MUST be correct
- Difficulty: ${diff}
- Each question has exactly 4 choices (A, B, C, D) with ONE definitively correct answer
- Wrong answers must be plausible but clearly incorrect upon careful reasoning
- Explanation must explain why the correct answer is right AND briefly why each wrong answer is wrong
- Questions should test conceptual understanding and MCAT-style reasoning, not rote memorization
- Mimic AAMC passage-based or discrete question style

Return ONLY a JSON array, no other text:
[
  {
    "stem": "question text here...",
    "choices": [
      {"letter": "A", "text": "choice text"},
      {"letter": "B", "text": "choice text"},
      {"letter": "C", "text": "choice text"},
      {"letter": "D", "text": "choice text"}
    ],
    "correctLetter": "C",
    "explanation": "C is correct because... A is wrong because... B is wrong because... D is wrong because..."
  }
]`;

      try {
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: "You are an expert MCAT question writer with board-level scientific accuracy. All facts must be verifiably correct. Return ONLY valid JSON arrays, no markdown or extra text.",
          messages: [{ role: "user", content: prompt }],
        });

        const raw = (msg.content[0] as { type: string; text: string }).text.trim();
        const parsed: { stem: string; choices: { letter: string; text: string }[]; correctLetter: string; explanation: string }[] = JSON.parse(raw);

        for (const q of parsed) {
          questions.push({
            id: randomUUID(),
            subject: sel.subject,
            topic: sel.topic,
            difficulty: difficulty === "mixed" ? (["easy", "medium", "hard"][Math.floor(Math.random() * 3)] as "easy" | "medium" | "hard") : difficulty,
            stem: q.stem,
            choices: q.choices,
            correctLetter: q.correctLetter,
            explanation: q.explanation,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error(`Failed to generate for topic ${sel.topic}:`, e);
      }
    }

    return NextResponse.json({ questions });
  } catch (e) {
    console.error("Generate error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
