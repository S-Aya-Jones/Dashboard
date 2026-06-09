import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  try {
    const auth = getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();

    const eventsRes = await calendar.events.list({
      calendarId: "primary", timeMin, timeMax, maxResults: 50, singleEvents: true, orderBy: "startTime",
    });

    const events = (eventsRes.data.items ?? []).map(e => ({
      id: e.id, title: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location, description: e.description, colorId: e.colorId,
    }));

    return NextResponse.json({ events });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { title, date, time, duration, description, allDay } = await req.json();

  try {
    const auth = getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });

    let start, end;
    if (allDay) {
      start = { date };
      end = { date };
    } else {
      const startDt = new Date(`${date}T${time ?? "09:00"}:00`);
      const endDt = new Date(startDt.getTime() + (duration ?? 60) * 60000);
      start = { dateTime: startDt.toISOString(), timeZone: "America/Chicago" };
      end = { dateTime: endDt.toISOString(), timeZone: "America/Chicago" };
    }

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: { summary: title, description, start, end, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }, { method: "email", minutes: 60 }] } },
    });

    return NextResponse.json({ success: true, eventId: event.data.id, link: event.data.htmlLink });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
