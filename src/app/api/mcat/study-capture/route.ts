import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const TONE_PROMPTS: Record<string, string> = {
  gossip: "Rewrite this like you're spilling juicy gossip to your best friend — dramatic, conspiratorial, lots of 'okay so get this' energy, but keep every fact accurate.",
  truecrime: "Rewrite this like a true-crime podcast narrator building tension and foreshadowing — ominous, suspenseful pacing, ('but what they didn't know was...') while keeping every fact accurate.",
  hype: "Rewrite this like a hype coach pumping someone up before a big game — high energy, motivational, exclamation points, while keeping every fact accurate.",
  housewives: "Rewrite this like a catty Real Housewives reunion confessional — petty, dramatic, shady one-liners, real cussing allowed (not censored), throwing shade at the wrong answer choices like they're a rival cast member, while keeping every fact accurate.",
  plain: "Rewrite this clearly and simply for studying, like a calm, clear tutor explaining it once.",
};

const SYSTEM = `You are helping a pre-med student turn raw study material (from a photo of notes/textbook, or a video transcript) into three things:
1. A "narration" — the material rewritten in a specific tone (provided below), kept factually accurate, written to be read ALOUD by a voice actor: vary sentence length on purpose (mix short punchy lines with longer ones), use em-dashes, ellipses, and exclamation points to mark where the delivery should pause, speed up, or land hard on a word, and break it into short paragraphs (1-3 sentences each) instead of one dense block — it should sound like a person performing the tone, not a monotone reading of facts.
2. A "highYield" array of 4-8 short, punchy bullet-point facts most likely to appear on the MCAT.
3. A single MCAT-style multiple choice "question" object based directly on the material, with this exact JSON shape:
{ "subject": string, "topic": string, "difficulty": "easy"|"medium"|"hard", "stem": string, "choices": [{"letter":"A","text":string},{"letter":"B","text":string},{"letter":"C","text":string},{"letter":"D","text":string}], "correctLetter": "A"|"B"|"C"|"D", "explanation": string }

Respond with ONLY raw JSON, no markdown fences, in this exact shape:
{ "narration": string, "highYield": string[], "question": { ...as above... } }`;

interface QuestionJSON {
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  choices: { letter: string; text: string }[];
  correctLetter: string;
  explanation: string;
}

function parseResponse(text: string): { narration: string; highYield: string[]; question: QuestionJSON } {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let tonePrompt = TONE_PROMPTS.plain;
    let userMessageContent: Anthropic.Messages.MessageParam["content"];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const photos = formData.getAll("photos") as File[];
      const toneKey = (formData.get("tone") as string) ?? "plain";
      tonePrompt = TONE_PROMPTS[toneKey] ?? TONE_PROMPTS.plain;

      if (!photos.length) return NextResponse.json({ error: "No photos provided" }, { status: 400 });

      const imageBlocks = await Promise.all(
        photos.slice(0, 5).map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mediaType = (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";
          return { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64 } };
        })
      );

      userMessageContent = [
        ...imageBlocks,
        {
          type: "text",
          text: `These are photo(s) of MCAT study material (notes or textbook pages). Read the text in the photo(s), then: ${tonePrompt}`,
        },
      ];
    } else {
      const { transcript, tone: toneKey } = await req.json();
      if (!transcript?.trim()) return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
      tonePrompt = TONE_PROMPTS[toneKey] ?? TONE_PROMPTS.plain;

      userMessageContent = `Here is a video transcript of MCAT study material:\n\n${transcript}\n\n${tonePrompt}`;
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessageContent }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseResponse(text);

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    console.error("study-capture error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
