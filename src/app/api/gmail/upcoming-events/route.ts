import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  // No Gmail token check — course deadlines are always available
  // 180 days covers the full fall semester through November
  const events = await getUpcomingEvents(180);
  return NextResponse.json({ events });
}
