import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { neonClient } from "@/lib/neon";
import { partnerByToken } from "@/lib/partners";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// A study session shouldn't run out of questions.
//
// The stored bank is finite and she'll memorise the wording of it long before
// she's learned the material. This makes fresh ones from the same lecture on
// demand, so a partner can keep going for as long as she wants and never see
// the same phrasing twice.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

const SYSTEM = `You write exam questions for a graduate health-sciences student from her own lecture material.

Return ONLY a JSON array. Each item:
{ "question": "...", "options": ["...","...","...","..."], "answer": 0, "explanation": "..." }

Rules:
- Draw only on the lecture material given. Do not invent content it doesn't cover.
- Graduate level — reasoning and mechanism, not recall of a definition.
- Four options. Exactly one correct. "answer" is its zero-based index.
- Wrong options must be plausible to someone who half-knows it, not obviously silly.
- Vary the phrasing and the angle from any questions listed as already asked.
- The explanation says why the right answer is right AND why the tempting wrong one is wrong.
- No markdown, no LaTeX. Plain text with real symbols.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const partner = await partnerByToken(token);
    if (!partner || partner.role !== "quizmaster") {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { lectureId, alreadyAsked } = await req.json();
    if (typeof lectureId !== "string" || !lectureId) {
      return NextResponse.json({ error: "lectureId is required" }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      SELECT title, course, outline, transcript FROM lectures
      WHERE id = ${lectureId} AND status = 'ready'
    `;
    if (!rows.length) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

    const l = rows[0];
    const material = `${String(l.outline ?? "")}\n\n${String(l.transcript ?? "").slice(0, 16000)}`.trim();
    if (!material) return NextResponse.json({ error: "That lecture has no material to work from" }, { status: 400 });

    const asked = Array.isArray(alreadyAsked) ? alreadyAsked.slice(-25) : [];

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content:
          `Lecture: ${String(l.title)} (${String(l.course)})\n\n` +
          `=== MATERIAL ===\n${material}\n\n` +
          (asked.length ? `=== ALREADY ASKED — ask about other things, or the same ideas from a different angle ===\n${asked.join("\n")}\n\n` : "") +
          `Write 5 new questions. Return only the JSON array.`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    let questions: unknown[] = [];
    if (match) {
      try { const p = JSON.parse(match[0]); if (Array.isArray(p)) questions = p; } catch { /* handled below */ }
    }

    // Never hand the UI something it will crash on.
    const clean = questions.filter((q): q is { question: string; options: string[]; answer: number; explanation?: string } => {
      const o = q as { question?: unknown; options?: unknown; answer?: unknown };
      return typeof o?.question === "string"
        && Array.isArray(o.options) && o.options.length >= 2
        && typeof o.answer === "number" && o.answer >= 0 && o.answer < o.options.length;
    });

    if (!clean.length) {
      return NextResponse.json({ error: "Couldn't write usable questions from that lecture — try another one." }, { status: 502 });
    }

    return NextResponse.json({ questions: clean });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't generate questions" },
      { status: 502 }
    );
  }
}
