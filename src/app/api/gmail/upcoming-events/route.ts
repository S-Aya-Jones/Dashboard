import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  // No Gmail token check — course deadlines are always available
  const events = await getUpcomingEvents(30);
  return NextResponse.json({ events });
}
