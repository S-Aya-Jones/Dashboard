import { NextRequest, NextResponse } from "next/server";
import { createLecture, listLectures } from "@/lib/lectures";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lectures = await listLectures();
    return NextResponse.json({ lectures });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { course, title, chunksExpected } = await req.json();
    if (!course || !title || !chunksExpected) {
      return NextResponse.json({ error: "course, title, chunksExpected required" }, { status: 400 });
    }
    const id = await createLecture(course, title, Number(chunksExpected));
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
