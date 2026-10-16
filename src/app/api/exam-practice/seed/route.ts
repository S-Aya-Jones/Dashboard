import { NextRequest, NextResponse } from "next/server";
import { importCourse, tableCounts, type ImportChapter } from "@/lib/examPractice";
import cardsJson from "@/../data/exam-practice/micro_ch1_cards.json";
import glossaryJson from "@/../data/exam-practice/glossary.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The same seed the script runs, triggerable from a phone.
//
// scripts/seed-exam-practice.ts needs a terminal and a DATABASE_URL. This is
// the same importCourse() call against the deployed database, so there is one
// implementation and no chance of the two drifting.
//
// POST-only and requires an explicit confirmation, because seeding replaces
// the course and takes its review history with it. A GET reports what is
// already loaded instead, which is the question worth asking first.

export async function GET() {
  try {
    return NextResponse.json({ counts: await tableCounts() });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "replace") {
      return NextResponse.json(
        {
          error: "Send { \"confirm\": \"replace\" }. This replaces Microbiology Exam 1 and discards its review history.",
          counts: await tableCounts(),
        },
        { status: 400 },
      );
    }

    const result = await importCourse({
      courseName: "Microbiology",
      term: "Fall 2026",
      examName: "Exam 1",
      examDate: null,
      chapters: cardsJson as ImportChapter[],
      glossary: glossaryJson as Record<string, string>,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      counts: await tableCounts(result.courseId),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
