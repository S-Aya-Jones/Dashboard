import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  try {
    const auth = getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();

    const [eventsRes, calListRes] = await Promise.all([
      calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      }),
      calendar.calendarList.list(),
    ]);

    const events = (eventsRes.data.items ?? []).map(e => ({
      id: e.id,
      title: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location,
      description: e.description,
      colorId: e.colorId,
      status: e.status,
    }));

    const calendars = (calListRes.data.items ?? []).map(c => ({
      id: c.id,
      name: c.summary,
      color: c.backgroundColor,
    }));

    return NextResponse.json({ events, calendars });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
