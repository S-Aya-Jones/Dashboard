import { NextRequest, NextResponse } from "next/server";
import { setShareToken, getLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const lecture = await getLecture(params.id);
  if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ token: lecture.shareToken });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { enabled } = await req.json();
    const token = await setShareToken(params.id, !!enabled);
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
