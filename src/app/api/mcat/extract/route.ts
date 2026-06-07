import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import JSZip from "jszip";
import { randomUUID } from "crypto";

export const maxDuration = 300;

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are an expert MCAT question parser. " +
  "Return ONLY a valid JSON array — no markdown fences, no extra text.";

const VALID_SUBJECTS = new Set([
  "Behavioral Sciences", "Biochemistry", "Biology",
  "Critical Analysis & Reasoning Skills",
  "General Chemistry", "Organic Chemistry", "Physics",
]);

type ImageEntry = {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

type RawQuestion = {
  stem: string;
  choices: { letter: string; text: string }[];
  correctLetter: string;
  explanation: string;
  subject: string;
  topic: string;
  difficulty: string;
};

async function extractDocxImages(buffer: Buffer): Promise<ImageEntry[]> {
  const mimeMap: Record<string, ImageEntry["mimeType"]> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp",
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
      if (base64.length < 2700) continue; // skip tiny icons
      images.push({ base64, mimeType });
    }
    return images;
  } catch {
    return [];
  }
}

function parseJsonResponse(raw: string): RawQuestion[] {
  const cleaned = raw
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
    if (s !== -1 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error("Could not parse JSON from response");
  }
}

function makePrompt(text: string, hasImages: boolean, batchNote: string): string {
  const imageHint = hasImages
    ? `\nThe images above are pages/screenshots from a study document. ` +
      `Read them carefully — they may contain pre-written questions OR study notes/outlines. ` +
      `If a question references a figure, describe the figure in the stem.`
    : "";

  return `You are an expert MCAT question processor. Analyze the content below and do ONE of the following:

1. If the content contains pre-written multiple-choice questions → extract every one exactly as written
2. If the content contains study notes, outlines, flashcards, or explanatory text → GENERATE high-quality MCAT-style MCQs based on the key concepts
3. If the content is mixed → extract existing MCQs AND generate additional ones from any accompanying notes

${imageHint}${batchNote}

For EACH question (extracted or generated) return:
- stem: full question text, NO answer choices in stem
- choices: exactly 4 [{letter:"A",text:"..."}, ...] — must have one definitively correct answer
- correctLetter: uppercase A/B/C/D
- explanation: why correct answer is right AND why each wrong choice is wrong (1–2 sentences each)
- subject: MUST be exactly one of: "Behavioral Sciences","Biochemistry","Biology","Critical Analysis & Reasoning Skills","General Chemistry","Organic Chemistry","Physics"
- topic: specific sub-topic (e.g. "Enzyme Kinetics", "Demographics & Social Structure")
- difficulty: "easy","medium","hard"

Aim for at least 5 questions per page of content. For notes/outlines, generate questions testing the most high-yield MCAT concepts in the material.

Return ONLY a valid JSON array with no markdown:
[{"stem":"...","choices":[{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],"correctLetter":"B","explanation":"...","subject":"Biology","topic":"DNA Replication","difficulty":"medium"}]

${text.trim() ? `Content to process:\n---\n${text.slice(0, 40000)}\n---` : ""}`;
}

async function callClaude(text: string, images: ImageEntry[], batchNote = ""): Promise<RawQuestion[]> {
  const prompt = makePrompt(text, images.length > 0, batchNote);

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...images.map(img => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mimeType, data: img.base64 },
    })),
    { type: "text" as const, text: prompt },
  ];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 20000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  return parseJsonResponse((msg.content[0] as { type: string; text: string }).text.trim());
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Soft file size warning (won't hard-fail, but warn)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      return NextResponse.json(
        { error: `File is ${fileSizeMB.toFixed(0)} MB — please split it into smaller chunks (under 50 MB) for reliable extraction.` },
        { status: 400 }
      );
    }

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
        { error: "PDF not supported — export as .docx or .txt" },
        { status: 400 }
      );
    } else {
      rawText = buffer.toString("utf-8");
    }

    const hasText   = rawText.trim().length > 50;
    const hasImages = images.length > 0;

    if (!hasText && !hasImages) {
      return NextResponse.json({ error: "Could not extract content from file" }, { status: 400 });
    }

    const allRaw: RawQuestion[] = [];

    if (hasImages) {
      // Image-heavy or image-only doc: batch into groups of 15 (Claude max is 20)
      const BATCH = 15;
      const batches: ImageEntry[][] = [];
      for (let i = 0; i < images.length; i += BATCH) {
        batches.push(images.slice(i, i + BATCH));
      }

      for (let b = 0; b < batches.length; b++) {
        const batchNote = batches.length > 1
          ? `\n(This is batch ${b + 1} of ${batches.length}. Extract all questions visible in these images.)`
          : "";
        try {
          // Only send text in the first batch to avoid repeating it
          const batchText = b === 0 ? rawText : "";
          const results = await callClaude(batchText, batches[b], batchNote);
          allRaw.push(...results);
        } catch (e) {
          console.error(`Batch ${b + 1} failed:`, e);
        }
      }
    } else {
      // Text-only
      try {
        const results = await callClaude(rawText, []);
        allRaw.push(...results);
      } catch (e) {
        console.error("Text extraction failed:", e);
      }
    }

    if (allRaw.length === 0) {
      return NextResponse.json(
        { error: "No questions could be generated from this file. Try a .docx or .txt with study notes, outlines, or multiple-choice questions." },
        { status: 422 }
      );
    }

    // Deduplicate by stem prefix
    const seen = new Set<string>();
    const questions = allRaw
      .filter(q => {
        const key = q.stem?.slice(0, 60) ?? "";
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(q => ({
        id: randomUUID(),
        subject: VALID_SUBJECTS.has(q.subject) ? q.subject : "Biology",
        topic: q.topic || "General",
        difficulty: (["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : "medium") as "easy"|"medium"|"hard",
        stem: q.stem,
        choices: q.choices,
        correctLetter: q.correctLetter,
        explanation: q.explanation || "",
        createdAt: new Date().toISOString(),
      }));

    return NextResponse.json({ questions, count: questions.length, hadImages: hasImages });
  } catch (e) {
    console.error("Extract error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Extraction failed", detail: msg }, { status: 500 });
  }
}
