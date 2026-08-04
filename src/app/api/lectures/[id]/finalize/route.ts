import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLecture, getChunkTexts, updateLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

const SYSTEM = `You are a med-school study-materials generator for Aya, an MHS student. You receive a raw lecture transcript and produce complete active-recall study materials.

Return ONLY a JSON object (no markdown fences, no prose) with exactly these keys:
{
  "title": "concise descriptive lecture title",
  "summary": "2-3 sentence summary of what this lecture covers",
  "outline": "structured lecture notes in markdown: ## sections, ### subsections, bullet points with the actual content, key terms in **bold**. Comprehensive enough to replace re-watching.",
  "conceptMap": "a mermaid flowchart (flowchart TD) mapping the lecture's concepts and their relationships. 12-20 nodes. Node ids must be simple alphanumerics; label text in square brackets must not contain parentheses, quotes, or special characters.",
  "quiz": [ { "q": "question text", "choices": ["A","B","C","D"], "answer": 0, "explanation": "why" } ],
  "flashcards": [ { "front": "prompt", "back": "answer" } ]
}

Rules:
- quiz: exactly 8 questions, exam-style (application > recall where possible), answer is the index into choices
- flashcards: exactly 12, atomic facts or mechanisms
- outline: this is her note-taking system — capture the real content, not meta-description
- everything grounded strictly in the transcript`;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    const chunks = await getChunkTexts(params.id);
    const transcript = chunks.join("\n\n").trim();
    if (!transcript) return NextResponse.json({ error: "no transcript chunks found" }, { status: 400 });

    await updateLecture(params.id, { status: "generating", transcript });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Course: ${lecture.course}\nLecture transcript:\n\n${transcript.slice(0, 150000)}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("model returned unparseable output");
      parsed = JSON.parse(m[0]);
    }

    await updateLecture(params.id, {
      status: "ready",
      title: parsed.title || lecture.title,
      summary: parsed.summary ?? "",
      outline: parsed.outline ?? "",
      conceptMap: parsed.conceptMap ?? "",
      quiz: JSON.stringify(parsed.quiz ?? []),
      flashcards: JSON.stringify(parsed.flashcards ?? []),
    });

    return NextResponse.json({ ok: true, status: "ready" });
  } catch (e) {
    await updateLecture(params.id, { status: "error" }).catch(() => {});
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
