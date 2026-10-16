import { NextResponse } from "next/server";
import { activity, totals, lastNDays, STEP_GOAL } from "@/lib/activity";
import { chicagoDay } from "@/lib/planBrief";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = chicagoDay();
    const days = lastNDays(14, today);
    const rows = await activity(days[0], today);
    return NextResponse.json({ days: rows, totals: totals(rows), goal: STEP_GOAL });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
