import { NextRequest, NextResponse } from "next/server";
import { getLecture, deleteLecture, updateLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ lecture });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Picking the wrong course on upload shouldn't mean re-recording the lecture.
const COURSES = ["Physiology", "Biochemistry", "Microbiology", "Cell & Molecular Bio", "MCAT", "Other"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { course, title } = await req.json();
    const fields: { course?: string; title?: string } = {};

    if (course !== undefined) {
      if (typeof course !== "string" || !COURSES.includes(course)) {
        return NextResponse.json({ error: "Unknown course" }, { status: 400 });
      }
      fields.course = course;
    }
    if (title !== undefined) {
      const t = typeof title === "string" ? title.trim() : "";
      if (!t) return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
      fields.title = t.slice(0, 300);
    }
    if (!Object.keys(fields).length) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    await updateLecture(params.id, fields);
    const lecture = await getLecture(params.id);
    return NextResponse.json({ ok: true, lecture });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteLecture(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
