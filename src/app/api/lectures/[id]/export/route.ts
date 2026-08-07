import { NextRequest, NextResponse } from "next/server";
import { getLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";

// "I don't want those things disappearing."
//
// The share link only ever exported the notes, and only after creating a
// token. This exports the whole lecture — notes, exam focus, every quiz
// question with its answer, and every flashcard — as one markdown file she
// owns, with no link to set up first.

interface QuizQ { question?: string; options?: string[]; answer?: string | number; explanation?: string }
interface Card  { front?: string; back?: string }

function parse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // A bare 500 is what made the cron failure so hard to read. Say what broke.
  let l;
  try {
    l = await getLecture(id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach the database" },
      { status: 503 }
    );
  }
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = new Date(l.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const out: string[] = [
    `# ${l.title}`,
    "",
    `**${l.course}** · ${date}`,
    "",
  ];

  if (l.summary)  out.push("> " + l.summary, "");
  if (l.outline)  out.push("## Notes", "", l.outline, "");

  if (l.examFocus) {
    out.push("## Exam focus", "");
    const items = parse<{ topic?: string; why?: string }>(l.examFocus);
    if (items.length) {
      for (const it of items) out.push(`- **${it.topic ?? ""}** — ${it.why ?? ""}`);
    } else {
      out.push(l.examFocus);
    }
    out.push("");
  }

  const quiz = parse<QuizQ>(l.quiz);
  if (quiz.length) {
    out.push("## Practice questions", "");
    quiz.forEach((q, i) => {
      out.push(`**${i + 1}. ${q.question ?? ""}**`, "");
      (q.options ?? []).forEach((opt, oi) => {
        out.push(`   ${String.fromCharCode(65 + oi)}. ${opt}`);
      });
      const ans = typeof q.answer === "number"
        ? String.fromCharCode(65 + q.answer)
        : q.answer ?? "";
      if (ans) out.push("", `   *Answer: ${ans}*`);
      if (q.explanation) out.push(`   ${q.explanation}`);
      out.push("");
    });
  }

  const cards = parse<Card>(l.flashcards);
  if (cards.length) {
    out.push("## Flashcards", "");
    cards.forEach((c) => out.push(`- **${c.front ?? ""}** → ${c.back ?? ""}`));
    out.push("");
  }

  if (l.conceptMap) out.push("## Concept map", "", "```mermaid", l.conceptMap, "```", "");

  const safe = `${l.course}-${l.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);

  return new NextResponse(out.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe || "lecture"}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
