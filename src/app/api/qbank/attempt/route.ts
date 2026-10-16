import { NextRequest, NextResponse } from "next/server";
import { recordAttempt } from "@/lib/qbank";
import { logMisses } from "@/lib/lectures";

export const dynamic = "force-dynamic";

// Records the attempt and, on a miss, mirrors it into the error log so the
// exam-review workflow sees question-bank misses too.
export async function POST(req: NextRequest) {
  try {
    const { questionId, correct, course, lectureId, prompt, answer, chosen } = await req.json();
    if (!questionId || typeof correct !== "boolean") {
      return NextResponse.json({ error: "questionId and correct required" }, { status: 400 });
    }
    await recordAttempt(questionId, correct);
    if (!correct && course && prompt) {
      await logMisses(course, lectureId ?? "", [{
        question: String(prompt).slice(0, 500),
        correct: String(answer ?? "").slice(0, 500),
        chosen: String(chosen ?? "").slice(0, 500),
      }]).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
