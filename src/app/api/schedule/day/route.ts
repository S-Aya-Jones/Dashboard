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

  // ── Google Calendar events — aggregated across ALL her calendars ────────
  const calEvents: Array<{
    id: string; title: string; start: string; end: string | null;
    allDay: boolean; location?: string; source: "calendar"; calendar?: string;
  }> = [];

  try {
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      const auth = await getAuthedClient();
      const calendar = google.calendar({ version: "v3", auth });

      // Gym / Study / Fall Classes / Family etc. all feed the day view
      let calendarIds: Array<{ id: string; name?: string }> = [{ id: "primary" }];
      try {
        const list = await calendar.calendarList.list();
        const items = (list.data.items ?? []).filter(c => c.id);
        if (items.length) {
          calendarIds = items.map(c => ({ id: c.id!, name: c.summary ?? undefined }));
        }
      } catch { /* fall back to primary only */ }

      const results = await Promise.all(
        calendarIds.map(async (c) => {
          try {
            const resp = await calendar.events.list({
              calendarId: c.id,
              timeMin: dayStart.toISOString(),
              timeMax: dayEnd.toISOString(),
              maxResults: 50,
              singleEvents: true,
              orderBy: "startTime",
            });
            return (resp.data.items ?? []).map(e => ({
              id: e.id ?? `cal-${c.id}-${e.summary ?? ""}`,
              title: e.summary ?? "(no title)",
              start: e.start?.dateTime ?? e.start?.date ?? dayStart.toISOString(),
              end:   e.end?.dateTime ?? e.end?.date ?? null,
              allDay: !e.start?.dateTime,
              location: e.location ?? undefined,
              source: "calendar" as const,
              calendar: c.name,
            }));
          } catch { return []; }
        })
      );
      for (const batch of results) calEvents.push(...batch);
      calEvents.sort((a, b) => a.start.localeCompare(b.start));
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
