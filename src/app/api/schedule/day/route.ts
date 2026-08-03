import { NextRequest, NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";
import { getUpcomingEvents } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // date param: YYYY-MM-DD, defaults to today (Chicago time)
  const dateParm = searchParams.get("date");
  const tz = "America/Chicago";

  const targetDate = dateParm
    ? new Date(`${dateParm}T00:00:00`)
    : new Date(new Date().toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00");

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // ── Google Calendar events ──────────────────────────────────────────────
  const calEvents: Array<{
    id: string; title: string; start: string; end: string | null;
    allDay: boolean; location?: string; source: "calendar";
  }> = [];

  try {
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      const auth = getAuthedClient();
      const calendar = google.calendar({ version: "v3", auth });
      const resp = await calendar.events.list({
        calendarId: "primary",
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      });
      for (const e of (resp.data.items ?? [])) {
        calEvents.push({
          id: e.id ?? `cal-${Math.random()}`,
          title: e.summary ?? "(no title)",
          start: e.start?.dateTime ?? e.start?.date ?? dayStart.toISOString(),
          end:   e.end?.dateTime ?? e.end?.date ?? null,
          allDay: !e.start?.dateTime,
          location: e.location ?? undefined,
          source: "calendar",
        });
      }
    }
  } catch { /* calendar unavailable */ }

  // ── Email-parsed events on this day ─────────────────────────────────────
  const allEmail = await getUpcomingEvents(180).catch(() => []);
  const emailEvents = allEmail
    .filter(e => {
      const d = new Date(e.eventDate);
      return d >= dayStart && d <= dayEnd;
    })
    .map(e => ({
      id: e.emailId ?? e.title,
      title: e.title,
      start: e.eventDate,
      end: null as string | null,
      allDay: false,
      source: "email" as const,
      eventType: e.eventType,
      from: e.sourceSender || e.sourceSubject,
    }));

  return NextResponse.json({
    date: targetDate.toISOString().slice(0, 10),
    calEvents,
    emailEvents,
  });
}
