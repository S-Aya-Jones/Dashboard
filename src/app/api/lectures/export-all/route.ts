import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One file with everything, so a copy of the whole library exists outside the
// app. Grouped by course and numbered the same way the studio shows them.

interface Row {
  id: string; course: string; title: string; created_at: string;
  summary: string | null; outline: string | null; exam_focus: string | null;
  quiz: string | null; flashcards: string | null;
}

function parse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });

  try {
    const sql = neonClient(url);
    const rows = (await sql`
      SELECT id, course, title, created_at, summary, outline, exam_focus, quiz, flashcards
      FROM lectures
      WHERE status = 'ready'
      ORDER BY course ASC, created_at ASC
    `) as unknown as Row[];

    const out: string[] = [
      "# Lecture library",
      "",
      `Everything saved as of ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
      "",
    ];

    let currentCourse = "";
    let n = 0;
    for (const r of rows) {
      if (r.course !== currentCourse) {
        currentCourse = r.course;
        n = 0;
        out.push("", `# ${r.course}`, "");
      }
      n += 1;
      out.push(`## ${n}. ${r.title}`, "");
      if (r.summary) out.push("> " + r.summary, "");
      if (r.outline) out.push(r.outline, "");

      const focus = parse<{ topic?: string; why?: string }>(r.exam_focus);
      if (focus.length) {
        out.push("### Exam focus", "");
        for (const f of focus) out.push(`- **${f.topic ?? ""}** — ${f.why ?? ""}`);
        out.push("");
      }

      const quiz = parse<{ question?: string; options?: string[]; answer?: string | number; explanation?: string }>(r.quiz);
      if (quiz.length) {
        out.push("### Practice questions", "");
        quiz.forEach((q, i) => {
          out.push(`**${i + 1}. ${q.question ?? ""}**`, "");
          (q.options ?? []).forEach((o, oi) => out.push(`   ${String.fromCharCode(65 + oi)}. ${o}`));
          const a = typeof q.answer === "number" ? String.fromCharCode(65 + q.answer) : q.answer ?? "";
          if (a) out.push("", `   *Answer: ${a}*`);
          if (q.explanation) out.push(`   ${q.explanation}`);
          out.push("");
        });
      }

      const cards = parse<{ front?: string; back?: string }>(r.flashcards);
      if (cards.length) {
        out.push("### Flashcards", "");
        for (const c of cards) out.push(`- **${c.front ?? ""}** → ${c.back ?? ""}`);
        out.push("");
      }
    }

    if (!rows.length) out.push("_No finished lectures yet._");

    return new NextResponse(out.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="lecture-library-${new Date().toISOString().slice(0, 10)}.md"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
