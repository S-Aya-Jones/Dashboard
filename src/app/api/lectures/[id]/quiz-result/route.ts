import { NextRequest, NextResponse } from "next/server";
import { getLecture, logMisses } from "@/lib/lectures";

export const dynamic = "force-dynamic";

// Missed quiz questions flow into the error log — the exam study guide.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { misses } = await req.json();
    if (!Array.isArray(misses)) {
      return NextResponse.json({ error: "misses array required" }, { status: 400 });
    }
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });
    await logMisses(lecture.course, params.id, misses);
    return NextResponse.json({ ok: true, logged: misses.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
