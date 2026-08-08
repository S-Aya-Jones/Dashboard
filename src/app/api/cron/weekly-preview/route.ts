import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import Anthropic from "@anthropic-ai/sdk";
import { sendTelegram } from "@/lib/telegram";
import { getUpcomingEvents, getStoredEmails } from "@/lib/gmail";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";
import { loadData } from "@/lib/db";

export const dynamic = "force-dynamic";

const client = new Anthropic();

async function getWeekCalendarEvents() {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) return [];
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const now = new Date();
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000);
    const resp = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: sevenDaysOut.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: "startTime",
    });
    return (resp.data.items ?? []).map(e => ({
      title:  e.summary ?? "(no title)",
      start:  e.start?.dateTime ?? e.start?.date,
      allDay: !e.start?.dateTime,
    }));
  } catch { return []; }
}

function fmtEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [calEvents, emailEvents, recentEmails, data] = await Promise.all([
      getWeekCalendarEvents(),
      getUpcomingEvents(7),
      getStoredEmails(20, 0),
      loadData().catch(() => ({})),
    ]);

    // Upcoming deadlines from emails
    const deadlines = recentEmails
      .filter(e => e.deadlineAt)
      .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
      .slice(0, 5);

    // Bills due this week
    const bills = recentEmails.filter(e => e.category === "bills").slice(0, 3);

    // Action items
    const actionItems = recentEmails.filter(e => e.category === "action" && !e.isRead).slice(0, 3);

    // 75 Hard context
    const h75 = (data as Record<string, unknown>).seventyFiveHard as { startDate?: string } | undefined;
    const startDate = h75?.startDate ?? "2026-06-14";
    const start = new Date(startDate);
    const dayNum = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);

    const context = {
      weekStarting: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" }),
      "75hardDay": dayNum,
      calendarEvents: calEvents.map(e => ({
        title: e.title,
        when: e.start ? new Date(e.start).toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "all day",
      })),
      upcomingFromEmails: emailEvents.map(e => ({
        type:  e.eventType,
        title: e.title,
        when:  fmtEventDate(e.eventDate),
        from:  e.sourceSender,
      })),
      schoolDeadlines: deadlines.map(e => ({
        title: e.deadlineTitle || e.subject,
        due:   fmtEventDate(e.deadlineAt!),
      })),
      billsDue: bills.map(e => ({ subject: e.subject, from: e.senderName || e.senderEmail })),
      actionNeeded: actionItems.map(e => ({ subject: e.subject, from: e.senderName })),
      mcatTestDate: (data as Record<string, unknown>).mcatTestDate,
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are Aya's personal assistant sending her Sunday night weekly preview via Telegram.

Aya is a pre-med student doing 75 Hard, managing school deadlines, health appointments, and finances. She needs a clear picture of the week ahead so she can front-load and protect her energy.

Write a warm, intelligent weekly preview (under 250 words):
- Start with "Week ahead —" and name the specific dates
- Give an honest read: is this a heavy week or a light one, and why
- List what actually matters this week: school deadlines, appointments, bills, action items — with specific days/times
- Suggest ONE strategic focus (e.g., "get the Biochem assignment done Tuesday so Thursday isn't a crisis")
- End with a short encouragement specific to where she is in 75 Hard

Plain text. No markdown. No bullet symbols. Line breaks between sections.
Be specific and real — she needs to feel like you actually know what's on her plate.`,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "Week ahead — check your dashboard for the full picture this week.";

    await sendTelegram(text);

    // Log to SMS history
    const { loadData: ld, saveData } = await import("@/lib/db");
    const freshData = await ld();
    const phone = process.env.USER_PHONE_NUMBER ?? "6156811609";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const smsAny = freshData.sms as any ?? { phoneNumber: phone, enabled: true, messages: [], reminders: [] };
    smsAny.messages ??= [];
    smsAny.messages.push({
      id: `weekly-${Date.now()}`, direction: "outbound", body: text, timestamp: new Date().toISOString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    freshData.sms = smsAny as any;
    await saveData(freshData);

    return NextResponse.json({ success: true, text });
  } catch (e) {
    console.error("[weekly-preview]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
