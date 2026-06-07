import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { randomUUID } from "crypto";

export const maxDuration = 120;

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
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      rawText = buffer.toString("utf-8");
    } else if (name.endsWith(".pdf")) {
      return NextResponse.json({ error: "PDF files are not supported. Please export as .docx or .txt" }, { status: 400 });
    } else {
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });

    // Truncate to ~50k chars to stay within Claude context
    const text = rawText.slice(0, 50000);

    const prompt = `You are an expert MCAT question parser with deep knowledge of all MCAT content areas. Extract every multiple choice question from the text below.

Identify questions by these patterns (any may appear):
- Numbered: "1.", "Q1:", "Question 1", "#1"
- Answer choices: "A)" "B)" "(A)" "(B)" "A." "B." or standalone A/B/C/D lines
- Correct answers: marked with *, asterisk, bold hint, "Answer:", or listed in a key at the end
- Explanations: text after each question or in a separate section

For EACH question, extract:
- stem: full question text, NO answer choices
- choices: exactly 4 choices [{letter:"A",text:"..."}, ...] — if fewer exist, infer plausible distractors
- correctLetter: uppercase A/B/C/D (use "?" only if truly impossible to determine)
- explanation: why the correct answer is right AND briefly why each wrong choice is wrong; generate a helpful explanation if none exists
- subject: MUST be exactly one of: "Behavioral Sciences", "Biochemistry", "Biology", "Critical Analysis & Reasoning Skills", "General Chemistry", "Organic Chemistry", "Physics" — infer from content
- topic: specific sub-topic (e.g., "Enzyme Kinetics", "Action Potential", "Acid-Base Chemistry")
- difficulty: "easy", "medium", or "hard" based on MCAT standards

Return ONLY a valid JSON array, no markdown, no other text:
[{"stem":"...","choices":[{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],"correctLetter":"B","explanation":"...","subject":"Biology","topic":"DNA & Gene Expression","difficulty":"medium"}]

Text to parse:
---
${text}
---`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: "You are an expert MCAT question parser with deep knowledge of all MCAT content areas. Return ONLY valid JSON arrays, no markdown or extra text.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();

    // Try to extract a JSON array robustly
    let parsed: {
      stem: string;
      choices: { letter: string; text: string }[];
      correctLetter: string;
      explanation: string;
      subject: string;
      topic: string;
      difficulty: string;
    }[];

    try {
      // First try: direct parse
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Second try: find the first '[' to last ']'
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start === -1 || end === -1 || end <= start) {
        return NextResponse.json(
          { error: "AI could not structure the questions. Make sure the file contains clearly formatted multiple-choice questions." },
          { status: 422 }
        );
      }
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        return NextResponse.json(
          { error: "Failed to parse AI response. The file may have an unusual format." },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ error: "No questions found in the file." }, { status: 422 });
    }

    const questions = parsed.map(q => ({
      id: randomUUID(),
      subject: q.subject || "General",
      topic: q.topic || "General",
      difficulty: (["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium") as "easy" | "medium" | "hard",
      stem: q.stem,
      choices: q.choices,
      correctLetter: q.correctLetter,
      explanation: q.explanation || "",
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({ questions, count: questions.length });
  } catch (e) {
    console.error("Extract error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Extraction failed", detail: msg }, { status: 500 });
  }
}
