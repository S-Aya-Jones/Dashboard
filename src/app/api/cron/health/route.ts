import { NextResponse } from "next/server";
import { getSpineHealth } from "@/lib/spine";

export const dynamic = "force-dynamic";

// Answers "why am I not getting notifications?" — config presence (booleans
// only, no secret values), today's slots and whether they fired, recent
// dispatch history, reminder and assessment counts.
export async function GET() {
  try {
    const health = await getSpineHealth();
    return NextResponse.json({ ok: true, ...health });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
