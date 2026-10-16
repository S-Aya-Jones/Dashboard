import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError, firstText } from "@/lib/aiError";
import { getLecture, updateLecture } from "@/lib/lectures";
import { LEARNING_PROFILE } from "@/lib/learningProfile";

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

// Two segments a call, not three.
//
// Three segments of 150–300 words each, plus analogy, board and check, from
// Sonnet over a full transcript was landing past the 60s function limit — the
// page showed "Couldn't reach the server", which is not what happened and not
// something she could act on. Smaller parts finish comfortably inside the
// limit; she just taps once more.
const PER_PART = 2;
const MAX_PARTS = 12;

const SYSTEM = `You are teaching one lecture to a master's student at Meharry Medical College (pre-med, working full time, taking Biochemistry, Physiology, Microbiology and Cell & Molecular Biology). She could not attend this lecture live. She has the transcript and the slides; neither has worked, because reading a transcript is not the same as being taught.

Teach it. Not a summary, not bullet points — an actual explanation, the way a good lecturer explains something to someone hearing it for the first time.

Return ONLY JSON, no fences:
{ "segments": [ {
    "title": "the one idea this segment teaches, as a short phrase",
    "slide": "which slide or part of the deck this maps to, or null",
    "analogy": "the everyday thing this is like, which part maps to which, and where it stops being true — 2-4 sentences. null only if there is honestly no good one.",
    "teach": "the teaching itself — 150-300 words",
    "board": "optional: a pathway, equation, or comparison written in plain text, as a lecturer would put it on the board. null if not useful.",
    "examLanguage": "the same idea written the way the exam will write it — the proper terms, in a full sentence, the way it would appear in a question stem or a correct answer choice. 1-2 sentences. Never null.",
    "check": { "q": "one question testing whether it landed", "a": "the answer", "why": "one sentence on why, and what the wrong instinct usually is" }
  } ] }

${LEARNING_PROFILE}

How to write "examLanguage":
- She has asked for this specifically: explain it simply, then hand it back in the language the test uses.
- Take the idea you just taught in plain words and restate it in the course's own vocabulary — the terms from the slides, spelled and used the way a question stem would.
- It is not a summary. It is the same sentence, translated up. If the teaching said "the gate only opens when calcium shows up", the exam language says "Ca2+ binding to troponin C displaces tropomyosin from the myosin-binding site on actin."
- Use the exact terms the lecturer used. If the slide says "excitation-contraction coupling", say that, not "the linking step".

How to write "teach":
- Start from what she already knows and build. Introduce the term after the idea, never before.
- The analogy field carries the comparison; "teach" then does the real mechanism. Build on it rather than repeating it.
- Plain words first, proper term second, in that order, every time: say what happens, then name it. "The cell copies the recipe into a working note — that copy is the mRNA, and making it is transcription."
- Explain WHY, not just what. "Histidine buffers at physiological pH" is a fact; why its pKa being 6.0 makes that true is the teaching.
- Say the thing that makes it click — the reason it evolved this way, the reason the exam asks about it.
- Name the trap. Where do students get this wrong, and what is the wrong answer that feels right?
- Use the lecturer's own framing and emphasis where the transcript shows it. If they said something twice, or said "this will be on the exam", teach it as they weighted it.
- Plain readable notation for chemistry and formulas — never LaTeX. pH = -log[H+], not \\log. Use ^ for exponents and charges.
- Write to her, in the second person. No preamble like "In this segment we will".

Segment the lecture by IDEA, not by time or by slide. One concept per segment, in the order the lecture builds them.`;

/**
 * Segments out of a possibly-truncated response.
 *
 * Teaching prose is long, so a reply can stop mid-array and leave the JSON
 * unclosed. Parsing the whole thing then throws away three complete segments
 * because of a fourth that never finished — which is exactly what happened on
 * the first run: 200 OK, zero segments, no error anywhere. So whole objects are
 * pulled out one at a time and whatever completed is kept.
 */
function parseSegments(raw: string): unknown[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const whole = JSON.parse(cleaned);
    if (Array.isArray(whole?.segments)) return whole.segments;
  } catch { /* truncated — salvage below */ }

  const out: unknown[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  // Skip the wrapper object's own brace by starting at the array.
  const from = cleaned.indexOf("[");
  if (from < 0) return out;

  for (let i = from + 1; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(cleaned.slice(start, i + 1))); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return out;
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

    const raw = firstText(msg);
    const fresh = parseSegments(raw);

    // An empty part with a healthy response means the prompt or the parse is
    // wrong, not that the lecture ended. Say which, rather than reporting
    // success with nothing to show for it.
    if (!fresh.length && msg.stop_reason !== "end_turn") {
      return NextResponse.json(
        { error: `The lesson came back unusable (${msg.stop_reason ?? "unknown"}). Try again.` },
        { status: 502 },
      );
    }

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
