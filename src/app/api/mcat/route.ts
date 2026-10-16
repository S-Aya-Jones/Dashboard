import { NextRequest, NextResponse } from "next/server";
import { chicagoDay } from "@/lib/planBrief";
import {
  progressBetween, saveDay, questions, addQuestion, addAttempt, deleteQuestion,
  masteryFrom, weakest, weeklyFrom, tests, saveTest, type Question,
} from "@/lib/mcat/store";
import { PLAN, PLAN_START, PLAN_END, dayFor, weekOf, SCHEDULED_TESTS, PHASE_NAME } from "@/lib/mcat/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const today = chicagoDay();
    const [progress, qs, testRows] = await Promise.all([
      progressBetween(PLAN_START, PLAN_END),
      questions(1000),
      tests(),
    ]);
    const mastery = masteryFrom(qs);
    return NextResponse.json({
      today,
      day: dayFor(today),
      week: weekOf(today),
      phaseName: PHASE_NAME,
      totalDays: PLAN.length,
      progress,
      questions: qs,
      mastery,
      weakest: weakest(mastery),
      weekly: weeklyFrom(progress),
      tests: testRows,
      scheduledTests: SCHEDULED_TESTS,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    switch (body.action) {
      case "day":
        await saveDay(body.day);
        return NextResponse.json({ ok: true });

      case "question": {
        const id = await addQuestion(body.question as Omit<Question, "id">);
        return NextResponse.json({ ok: true, id });
      }

      case "attempt":
        await addAttempt(Number(body.id), Boolean(body.correct));
        return NextResponse.json({ ok: true });

      case "deleteQuestion":
        await deleteQuestion(Number(body.id));
        return NextResponse.json({ ok: true });

      case "test":
        await saveTest(body.test);
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
