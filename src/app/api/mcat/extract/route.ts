import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { randomUUID } from "crypto";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let rawText = "";

    const name = file.name.toLowerCase();
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (name.endsWith(".txt")) {
      rawText = buffer.toString("utf-8");
    } else {
      // Treat as plain text for other formats
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });

    // Truncate to avoid token limits — Claude can handle big chunks
    const text = rawText.slice(0, 40000);

    const prompt = `You are an expert at parsing MCAT study materials. Extract all multiple choice questions from the following text.

The text may have various formats:
- Questions numbered like "1.", "Q1:", "Question 1"
- Answer choices labeled A-D or a-d, possibly with or without periods
- Correct answers may be marked with asterisks (*), bold indicators, or listed at the end
- Explanations may follow each question or be listed separately
- Some formats have the answer key at the end of the document

For each question extract:
- stem: the question text (not including choices)
- choices: array of {letter, text} for A, B, C, D
- correctLetter: the letter of the correct answer (A/B/C/D uppercase)
- explanation: any explanation text, or empty string if none
- subject: guess the MCAT subject (Behavioral Sciences, Biochemistry, Biology, Critical Analysis & Reasoning Skills, General Chemistry, Organic Chemistry, Physics) based on content
- topic: specific sub-topic if identifiable
- difficulty: "easy", "medium", or "hard" based on complexity

Return ONLY a valid JSON array (no markdown, no other text):
[
  {
    "stem": "...",
    "choices": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],
    "correctLetter": "B",
    "explanation": "...",
    "subject": "Biology",
    "topic": "DNA & Gene Expression",
    "difficulty": "medium"
  }
]

If you cannot confidently identify the correct answer for a question, use "?" as correctLetter and note it in the explanation.

Text to parse:
---
${text}
---`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: "You are an expert MCAT question parser. Return ONLY valid JSON arrays, no markdown or extra text.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();

    // Strip markdown code blocks if present
    const cleaned = raw.replace(/^```json\n?/,"").replace(/^```\n?/,"").replace(/\n?```$/,"").trim();

    const parsed: {
      stem: string;
      choices: { letter: string; text: string }[];
      correctLetter: string;
      explanation: string;
      subject: string;
      topic: string;
      difficulty: string;
    }[] = JSON.parse(cleaned);

    const questions = parsed.map(q => ({
      id: randomUUID(),
      subject: q.subject || "General",
      topic: q.topic || "General",
      difficulty: (["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : "medium") as "easy"|"medium"|"hard",
      stem: q.stem,
      choices: q.choices,
      correctLetter: q.correctLetter,
      explanation: q.explanation || "",
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({ questions, count: questions.length });
  } catch (e) {
    console.error("Extract error:", e);
    return NextResponse.json({ error: "Extraction failed", detail: String(e) }, { status: 500 });
  }
}
