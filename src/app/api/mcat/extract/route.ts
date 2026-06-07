import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import JSZip from "jszip";
import { randomUUID } from "crypto";

export const maxDuration = 120;

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are an expert MCAT question parser with deep knowledge of all MCAT content areas. " +
  "Return ONLY valid JSON arrays — no markdown, no code fences, no extra text.";

function buildPrompt(text: string, hasImages: boolean): string {
  const imageNote = hasImages
    ? "\n\nIMPORTANT: The document contains embedded figures/images provided above. " +
      "Reference them when interpreting passages and questions that refer to a figure, graph, diagram, or table. " +
      "For questions about an image, describe the figure content in the stem so it makes sense without the image."
    : "";

  return `You are an expert MCAT question parser.${imageNote}

Extract EVERY multiple choice question from the content below.

Identify questions by these patterns:
- Numbered: "1.", "Q1:", "Question 1", "#1"
- Answer choices: "A)" "B)" "(A)" "(B)" "A." "B." or standalone A/B/C/D lines
- Correct answers: marked with *, asterisk, "Answer:", or listed at the end
- Explanations: text after each question or in a separate answer key section

For EACH question, extract:
- stem: full question text including any passage context, NO answer choices; if the question references a figure/image, describe what the image shows
- choices: exactly 4 choices [{letter:"A",text:"..."}, ...] — infer plausible distractors if fewer than 4 exist
- correctLetter: uppercase A/B/C/D (use "?" only if truly impossible to determine)
- explanation: why the correct answer is right AND briefly why each wrong choice is wrong; generate a solid MCAT explanation if none is given
- subject: MUST be exactly one of: "Behavioral Sciences", "Biochemistry", "Biology", "Critical Analysis & Reasoning Skills", "General Chemistry", "Organic Chemistry", "Physics"
- topic: specific sub-topic (e.g., "Enzyme Kinetics", "Action Potential", "Acid-Base Chemistry")
- difficulty: "easy", "medium", or "hard" based on MCAT standards

Return ONLY a valid JSON array:
[{"stem":"...","choices":[{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],"correctLetter":"B","explanation":"...","subject":"Biology","topic":"DNA Replication","difficulty":"medium"}]

${text ? `Text content:\n---\n${text}\n---` : ""}`;
}

type ImageEntry = { base64: string; mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

async function extractDocxImages(buffer: Buffer): Promise<ImageEntry[]> {
  const mimeMap: Record<string, ImageEntry["mimeType"]> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };

  try {
    const zip = await JSZip.loadAsync(buffer);
    const images: ImageEntry[] = [];

    for (const [filePath, zipFile] of Object.entries(zip.files)) {
      if (!filePath.startsWith("word/media/") || zipFile.dir) continue;
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = mimeMap[ext];
      if (!mimeType) continue;

      const base64 = await zipFile.async("base64");
      // Skip suspiciously small files (icons, bullets < 2 KB)
      if (base64.length < 2700) continue;
      images.push({ base64, mimeType });
      if (images.length >= 8) break; // cap for API payload
    }

    return images;
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name   = file.name.toLowerCase();

    let rawText = "";
    let images: ImageEntry[] = [];

    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
      images  = await extractDocxImages(buffer);
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      rawText = buffer.toString("utf-8");
    } else if (name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "PDF files are not supported. Please export as .docx or .txt" },
        { status: 400 }
      );
    } else {
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim() && images.length === 0) {
      return NextResponse.json({ error: "Could not extract content from file" }, { status: 400 });
    }

    // Truncate text to ~50k chars
    const text   = rawText.slice(0, 50000);
    const prompt = buildPrompt(text, images.length > 0);

    // Build message content — prepend images if present
    let raw: string;

    if (images.length > 0) {
      const content: Anthropic.Messages.ContentBlockParam[] = [
        ...images.map(img => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: img.mimeType,
            data: img.base64,
          },
        })),
        { type: "text" as const, text: prompt },
      ];

      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });
      raw = (msg.content[0] as { type: string; text: string }).text.trim();
    } else {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      raw = (msg.content[0] as { type: string; text: string }).text.trim();
    }

    // Robust JSON parse
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
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const start = raw.indexOf("[");
      const end   = raw.lastIndexOf("]");
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

    const VALID_SUBJECTS = new Set([
      "Behavioral Sciences", "Biochemistry", "Biology",
      "Critical Analysis & Reasoning Skills",
      "General Chemistry", "Organic Chemistry", "Physics",
    ]);

    const questions = parsed.map(q => ({
      id: randomUUID(),
      subject: VALID_SUBJECTS.has(q.subject) ? q.subject : "Biology",
      topic: q.topic || "General",
      difficulty: (["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium") as "easy" | "medium" | "hard",
      stem: q.stem,
      choices: q.choices,
      correctLetter: q.correctLetter,
      explanation: q.explanation || "",
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      questions,
      count: questions.length,
      hadImages: images.length > 0,
    });
  } catch (e) {
    console.error("Extract error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Extraction failed", detail: msg }, { status: 500 });
  }
}
