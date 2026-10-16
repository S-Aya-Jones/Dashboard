import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { partnerByToken } from "@/lib/partners";

export const dynamic = "force-dynamic";

// The partner side. This is the security boundary of the whole feature.
//
// Every query below names its columns explicitly and touches only the lecture
// and question tables. It cannot reach finances, credit, therapy, felt-safety,
// exposure, email or the dashboard blob, because it never queries them — not
// because something is hidden in a view. A partner link that leaks exposes
// quiz questions and nothing else.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const partner = await partnerByToken(token);
    if (!partner) {
      return NextResponse.json({ error: "This link isn't valid any more." }, { status: 404 });
    }

    const sql = db();
    const course = req.nextUrl.searchParams.get("course") ?? "";

    // Courses that actually have finished lectures.
    const courseRows = await sql`
      SELECT course, COUNT(*)::int AS n
      FROM lectures WHERE status = 'ready'
      GROUP BY course ORDER BY course ASC
    `;

    const base = {
      partner: {
        name: partner.name,
        role: partner.role,
        mediaId: partner.mediaId,
        seeScores: partner.seeScores,
      },
      courses: courseRows.map((r) => ({ course: String(r.course), lectures: Number(r.n) })),
    };

    // Accountability partners get no material at all — only whether she has
    // been studying. Nothing to read out, nothing to leak.
    if (partner.role === "accountability") {
      const recent = await sql`
        SELECT course, title, created_at FROM lectures
        WHERE status = 'ready' ORDER BY created_at DESC LIMIT 5
      `;
      return NextResponse.json({
        ...base,
        recentWork: recent.map((r) => ({
          course: String(r.course), title: String(r.title), at: String(r.created_at),
        })),
      });
    }

    if (!course) return NextResponse.json(base);

    const lectures = await sql`
      SELECT id, title, quiz, flashcards, exam_focus
      FROM lectures
      WHERE course = ${course} AND status = 'ready'
      ORDER BY created_at ASC
    `;

    const misses = partner.seeScores
      ? await sql`
          SELECT question, correct, chosen FROM error_log
          WHERE course = ${course} ORDER BY missed_at DESC LIMIT 20
        `
      : [];

    return NextResponse.json({
      ...base,
      lectures: lectures.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        quiz: r.quiz ? String(r.quiz) : "[]",
        flashcards: r.flashcards ? String(r.flashcards) : "[]",
        examFocus: r.exam_focus ? String(r.exam_focus) : null,
      })),
      weakSpots: misses.map((r) => ({
        question: String(r.question),
        correct: r.correct ? String(r.correct) : null,
        chosen: r.chosen ? String(r.chosen) : null,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't load the study material" },
      { status: 503 }
    );
  }
}

// A partner marking an answer wrong feeds her error log, which is what the
// tutor's "my weak spots" mode drills from.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const partner = await partnerByToken(token);
    if (!partner || partner.role !== "quizmaster") {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { course, lectureId, question, correct, chosen } = await req.json();
    if (typeof course !== "string" || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "course and question are required" }, { status: 400 });
    }

    const sql = db();
    await sql`
      INSERT INTO error_log (course, lecture_id, question, correct, chosen)
      VALUES (${course}, ${typeof lectureId === "string" ? lectureId : null},
              ${question.slice(0, 2000)},
              ${typeof correct === "string" ? correct.slice(0, 1000) : null},
              ${typeof chosen === "string" ? chosen.slice(0, 1000) : null})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't record that" }, { status: 500 });
  }
}
