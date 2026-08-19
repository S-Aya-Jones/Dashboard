import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError, firstText } from "@/lib/aiError";
import { getLecture } from "@/lib/lectures";
import { LEARNING_PROFILE } from "@/lib/learningProfile";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const client = new Anthropic();

// Answering back.
//
// Revealing an answer and asking her to self-grade is not understanding — she
// reads it, recognises it, and marks herself right. This makes her say the idea
// in her own words first, then responds to what she actually said: what landed,
// what is missing, and one question aimed at the gap.
//
// The verdict is the model's, not hers, because the whole point is that she
// stops being the one deciding whether she knew it.

const SYSTEM = `You are teaching one idea to a master's student at Meharry Medical College. She has just been taught the segment below and has answered a question about it in her own words.

Respond to what she actually wrote. Not to what you wish she had written.

Return ONLY JSON, no fences:
{
  "verdict": "got" | "partly" | "missed",
  "reply": "your response to her, 60-140 words, written to her in the second person",
  "followUp": "one question that targets what is still missing, or null when she has it"
}

verdict:
- "got" — she has the mechanism, in her own words. Small wording slips do not count against her.
- "partly" — the shape is right but something load-bearing is missing, vague, or backwards.
- "missed" — she has the wrong model, or she has restated the question, or she has guessed.

How to reply:
- Name what she got right first, specifically. "You've got the direction of the gradient" — not "good job".
- Then name exactly what is missing or wrong, and why it matters. Be concrete.
- If she has restated your own words back, say so and ask her to apply it somewhere new instead.
- If she says she doesn't know, don't just tell her — give her the one piece she needs and ask again.
- Never praise an answer that is wrong. She is preparing for an exam that will not be kind, and a false pass costs her more than a hard correction.
- No preamble, no "great question", no markdown. Plain sentences.

${LEARNING_PROFILE}`;

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { segment, history, answer } = await req.json();
    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "Say what you think first." }, { status: 400 });
    }

    const seg = segment ?? {};
    const priorTurns: Array<{ role: string; content: string }> = Array.isArray(history) ? history : [];

    const context =
      `Course: ${lecture.course}\nLecture: ${lecture.title}\n\n` +
      `THE SEGMENT SHE WAS JUST TAUGHT\n` +
      `Title: ${seg.title ?? ""}\n` +
      (seg.analogy ? `Analogy used: ${seg.analogy}\n` : "") +
      `Teaching: ${String(seg.teach ?? "").slice(0, 3000)}\n` +
      (seg.check?.q ? `\nThe question put to her: ${seg.check.q}\nThe answer you are checking against: ${seg.check.a}\n` : "");

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        { role: "user", content: context },
        // Earlier turns of this same exchange, so a follow-up builds on what
        // she already said rather than restarting the question.
        ...priorTurns
          .filter(t => t.role === "user" || t.role === "assistant")
          .slice(-6)
          .map(t => ({ role: t.role as "user" | "assistant", content: String(t.content).slice(0, 2000) })),
        { role: "user", content: answer.slice(0, 2000) },
      ],
    });

    const parsed = parseJson(firstText(msg));
    const verdict = ["got", "partly", "missed"].includes(String(parsed.verdict))
      ? String(parsed.verdict)
      : "partly";
    const reply = typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : firstText(msg).slice(0, 600);

    if (!reply) {
      return NextResponse.json({ error: "That didn't come back usable. Try again." }, { status: 502 });
    }

    return NextResponse.json({
      verdict,
      reply,
      followUp: typeof parsed.followUp === "string" && parsed.followUp.trim() ? parsed.followUp.trim() : null,
    });
  } catch (e) {
    const f = describeAiError(e);
    return NextResponse.json({ error: f.message, blocking: f.blocking }, { status: f.blocking ? 402 : 502 });
  }
}
