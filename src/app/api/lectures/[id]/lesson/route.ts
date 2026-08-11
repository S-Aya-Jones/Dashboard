import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError } from "@/lib/aiError";
import { getLecture, updateLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// A taught lesson, not a transcript.
//
// She misses the lecture live — it streams while she is at work — and notes
// have not closed the gap, because notes assume you were already taught once.
// This rebuilds the teaching: one idea at a time, explained from something she
// already knows, with the slide beside it and a question at the end of each
// piece so she finds out whether it landed while there is still time to fix it.
//
// Built in parts because a whole lecture in one call overruns the 60s function
// limit, and because she can start on part one while the rest is still being
// written.

const PER_PART = 4;
const MAX_PARTS = 8;

const SYSTEM = `You are teaching one lecture to a master's student at Meharry Medical College (pre-med, working full time, taking Biochemistry, Physiology, Microbiology and Cell & Molecular Biology). She could not attend this lecture live. She has the transcript and the slides; neither has worked, because reading a transcript is not the same as being taught.

Teach it. Not a summary, not bullet points — an actual explanation, the way a good lecturer explains something to someone hearing it for the first time.

Return ONLY JSON, no fences:
{ "segments": [ {
    "title": "the one idea this segment teaches, as a short phrase",
    "slide": "which slide or part of the deck this maps to, or null",
    "teach": "the teaching itself — 150-300 words",
    "board": "optional: a pathway, equation, or comparison written in plain text, as a lecturer would put it on the board. null if not useful.",
    "check": { "q": "one question testing whether it landed", "a": "the answer", "why": "one sentence on why, and what the wrong instinct usually is" }
  } ] }

How to write "teach":
- Start from what she already knows and build. Introduce the term after the idea, never before.
- Explain WHY, not just what. "Histidine buffers at physiological pH" is a fact; why its pKa being 6.0 makes that true is the teaching.
- Say the thing that makes it click — the analogy, the reason it evolved this way, the reason the exam asks about it.
- Name the trap. Where do students get this wrong, and what is the wrong answer that feels right?
- Use the lecturer's own framing and emphasis where the transcript shows it. If they said something twice, or said "this will be on the exam", teach it as they weighted it.
- Plain readable notation for chemistry and formulas — never LaTeX. pH = -log[H+], not \\log. Use ^ for exponents and charges.
- Write to her, in the second person. No preamble like "In this segment we will".

Segment the lecture by IDEA, not by time or by slide. One concept per segment, in the order the lecture builds them.`;

function parseJson(raw: string): { segments?: unknown[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const part = Math.max(0, Number(req.nextUrl.searchParams.get("part") ?? 0));

  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    const transcript = (lecture.transcript ?? "").trim();
    if (!transcript) {
      return NextResponse.json({ error: "This lecture has no transcript yet." }, { status: 400 });
    }

    const existing: unknown[] = part === 0
      ? []
      : (() => { try { return JSON.parse(lecture.lesson ?? "[]"); } catch { return []; } })();

    const slides = (lecture.slidesText ?? "").trim();
    const already = (existing as { title?: string }[]).map(s => s.title).filter(Boolean);

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 5000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content:
          `Course: ${lecture.course}\nLecture: ${lecture.title}\n\n` +
          `Write the next ${PER_PART} segments of the lesson, continuing where the list below stops. ` +
          `If the lecture's material is finished, return fewer segments or an empty array.\n\n` +
          (already.length ? `Already taught:\n${already.map(t => `- ${t}`).join("\n")}\n\n` : "") +
          `TRANSCRIPT:\n${transcript.slice(0, 55000)}\n\n` +
          (slides ? `SLIDES:\n${slides.slice(0, 20000)}` : "No slides for this lecture."),
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = parseJson(raw);
    const fresh = Array.isArray(parsed.segments) ? parsed.segments : [];

    const merged = [...existing, ...fresh];
    await updateLecture(params.id, { lesson: JSON.stringify(merged) });

    // Fewer than a full part back means the lecture ran out of material.
    const done = fresh.length < PER_PART || part + 1 >= MAX_PARTS;
    return NextResponse.json({
      ok: true,
      added: fresh.length,
      total: merged.length,
      done,
      next: part + 1,
    });
  } catch (e) {
    const f = describeAiError(e);
    return NextResponse.json(
      { error: f.message, blocking: f.blocking },
      { status: f.blocking ? 402 : 502 },
    );
  }
}
