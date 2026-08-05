import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLecture, getChunkTexts, updateLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// Generation runs in three stages, each its own request, because Vercel caps
// a function at 60s and one combined call exceeded it (504).
//   notes → summary + outline
//   map   → mermaid concept map
//   quiz  → quiz + flashcards
type Stage = "notes" | "map" | "quiz";

const MAX_TRANSCRIPT = 60000;

const PROMPTS: Record<Stage, { system: string; maxTokens: number }> = {
  notes: {
    maxTokens: 4000,
    system: `You generate med-school study notes from a lecture transcript.

Return ONLY JSON (no markdown fences):
{
  "title": "concise descriptive lecture title",
  "summary": "2-3 sentence summary",
  "outline": "structured notes in markdown: ## sections, ### subsections, bullets with the ACTUAL content, key terms in **bold**. Comprehensive enough to replace re-watching the lecture."
}`,
  },
  map: {
    maxTokens: 1500,
    system: `You generate a concept map from a lecture transcript.

Return ONLY JSON (no markdown fences):
{ "conceptMap": "a mermaid flowchart TD with 12-20 nodes mapping the lecture's concepts and relationships" }

Mermaid rules: node ids simple alphanumerics; label text inside square brackets must NOT contain parentheses, quotes, commas, or special characters.`,
  },
  quiz: {
    maxTokens: 4000,
    system: `You generate active-recall study materials from a lecture transcript.

Return ONLY JSON (no markdown fences):
{
  "quiz": [ { "q": "question", "choices": ["A","B","C","D"], "answer": 0, "explanation": "why" } ],
  "flashcards": [ { "front": "prompt", "back": "answer" } ]
}

Exactly 8 quiz questions (exam-style, application over recall where possible; answer is the index into choices) and exactly 12 flashcards (atomic facts or mechanisms). Ground everything strictly in the transcript.`,
  },
};

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("model returned unparseable output");
    return JSON.parse(m[0]);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const stage = (req.nextUrl.searchParams.get("stage") ?? "notes") as Stage;
  if (!PROMPTS[stage]) {
    return NextResponse.json({ error: `unknown stage '${stage}'` }, { status: 400 });
  }

  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Stage 1 assembles the transcript; later stages reuse the stored one
    let transcript = lecture.transcript ?? "";
    if (stage === "notes" || !transcript) {
      const chunks = await getChunkTexts(params.id);
      transcript = chunks.join("\n\n").trim();
      if (!transcript) {
        return NextResponse.json({ error: "no transcript chunks found" }, { status: 400 });
      }
      await updateLecture(params.id, { status: "generating", transcript });
    }

    const { system, maxTokens } = PROMPTS[stage];
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{
        role: "user",
        content: `Course: ${lecture.course}\n\nTranscript:\n\n${transcript.slice(0, MAX_TRANSCRIPT)}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseJson(raw);

    if (stage === "notes") {
      await updateLecture(params.id, {
        title: parsed.title || lecture.title,
        summary: parsed.summary ?? "",
        outline: parsed.outline ?? "",
      });
    } else if (stage === "map") {
      await updateLecture(params.id, { conceptMap: parsed.conceptMap ?? "" });
    } else {
      await updateLecture(params.id, {
        quiz: JSON.stringify(parsed.quiz ?? []),
        flashcards: JSON.stringify(parsed.flashcards ?? []),
        status: "ready",
      });
    }

    return NextResponse.json({ ok: true, stage });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300), stage }, { status: 500 });
  }
}
