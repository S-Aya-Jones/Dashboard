import { NextRequest, NextResponse } from "next/server";
import { getErrorLog } from "@/lib/lectures";

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
