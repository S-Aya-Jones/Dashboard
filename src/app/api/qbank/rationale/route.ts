import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError, firstText } from "@/lib/aiError";
import { LEARNING_PROFILE_SHORT } from "@/lib/learningProfile";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic();

// Why the other answers are wrong.
//
// Picking the right option and knowing why the other three fail are different
// skills, and the second is most of what a multiple-choice exam actually
// measures. A distractor is written to be the answer you reach for when you
// half-know something — so being able to name what makes it wrong is the
// clearest evidence that the half is now whole.
//
// This grades her reasoning about one distractor. Getting the right option for
// the wrong reason should not pass, which is exactly what it catches.

const SYSTEM = `A student is working through practice questions for a graduate medical-science course. She has answered a multiple-choice question and is now explaining why one of the OTHER options is wrong.

Judge her reasoning about that specific option.

Return ONLY JSON, no fences:
{
  "verdict": "right" | "close" | "wrong",
  "reply": "40-100 words, written to her in the second person"
}

verdict:
- "right" — she has named the actual reason that option fails.
- "close" — she is pointing at the right area but the reason is vague, incomplete, or only true by accident.
- "wrong" — her reason does not hold, or it would also rule out the correct answer, or she has just asserted "it's wrong".

How to reply:
- Say what the option was actually designed to catch. Every distractor is written to be tempting to someone who half-knows something — name what that something is.
- If her reason is one that would also eliminate the correct answer, point that out. It is the most common way of being right for the wrong reason.
- If she is right, add the one detail that makes it airtight on exam day.
- No praise, no preamble, no markdown. Plain sentences.

${LEARNING_PROFILE_SHORT}`;

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, choices, correctAnswer, target, reasoning, explanation } = await req.json();

    if (typeof reasoning !== "string" || !reasoning.trim()) {
      return NextResponse.json({ error: "Say why you think it's wrong first." }, { status: 400 });
    }
    if (typeof target !== "string" || !target.trim()) {
      return NextResponse.json({ error: "Which option?" }, { status: 400 });
    }

    const list = Array.isArray(choices) ? (choices as string[]) : [];

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      system: SYSTEM,
      messages: [{
        role: "user",
        content:
          `QUESTION\n${String(prompt ?? "").slice(0, 2000)}\n\n` +
          (list.length ? `OPTIONS\n${list.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("\n")}\n\n` : "") +
          `THE CORRECT ANSWER: ${String(correctAnswer ?? "")}\n` +
          (explanation ? `Why it is correct: ${String(explanation).slice(0, 1200)}\n` : "") +
          `\nTHE OPTION SHE IS RULING OUT: ${target}\n` +
          `HER REASONING: ${reasoning.slice(0, 1200)}`,
      }],
    });

    const parsed = parseJson(firstText(msg));
    const verdict = ["right", "close", "wrong"].includes(String(parsed.verdict))
      ? String(parsed.verdict)
      : "close";
    const reply = typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : firstText(msg).slice(0, 500);

    if (!reply) {
      return NextResponse.json({ error: "That came back unusable. Try again." }, { status: 502 });
    }

    return NextResponse.json({ verdict, reply });
  } catch (e) {
    const f = describeAiError(e);
    return NextResponse.json({ error: f.message, blocking: f.blocking }, { status: f.blocking ? 402 : 502 });
  }
}
