import { NextResponse } from "next/server";
import { recentReviews } from "@/lib/weeklyReset";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ reviews: await recentReviews(8) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
