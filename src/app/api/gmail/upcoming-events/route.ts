import { NextResponse } from "next/server";
import { getUpcomingEvents, getGmailTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getGmailTokens();
  if (!stored) return NextResponse.json({ events: [] });

  const events = await getUpcomingEvents(14);
  return NextResponse.json({ events });
}
