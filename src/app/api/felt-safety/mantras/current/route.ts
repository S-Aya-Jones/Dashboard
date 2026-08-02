import { NextRequest, NextResponse } from "next/server";
import { getCurrentMantra } from "@/lib/felt-safety-db";

// Public endpoint — Twilio webhooks can hit this to pull current mantra for SMS
export async function GET(req: NextRequest) {
  const faithMode = req.nextUrl.searchParams.get("faith");
  const mantra    = await getCurrentMantra(faithMode === null ? undefined : faithMode === "true");
  if (!mantra) return NextResponse.json({ text: "The urge is information, not instruction." });
  return NextResponse.json({ text: mantra.text, id: mantra.id, faithFlag: mantra.faithFlag });
}
