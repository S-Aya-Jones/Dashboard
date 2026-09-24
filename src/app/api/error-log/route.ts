import { NextRequest, NextResponse } from "next/server";
import { getErrorLog, logMisses } from "@/lib/lectures";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const course = req.nextUrl.searchParams.get("course") ?? undefined;
    const entries = await getErrorLog(course);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// A single miss. The lesson's "I didn't have that" writes here, so what she
// got wrong while being taught feeds the same error log the tutor drills from.
export async function POST(req: NextRequest) {
  try {
    const { course, lectureId, question, correct, chosen } = await req.json();
    if (typeof course !== "string" || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "course and question are required" }, { status: 400 });
    }
    await logMisses(course, typeof lectureId === "string" ? lectureId : "", [{
      question: question.slice(0, 2000),
      correct: typeof correct === "string" ? correct.slice(0, 1000) : "",
      chosen: typeof chosen === "string" ? chosen.slice(0, 1000) : "",
    }]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
