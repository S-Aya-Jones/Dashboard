import { NextRequest, NextResponse } from "next/server";
import { getLecture, deleteLecture } from "@/lib/lectures";

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteLecture(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
