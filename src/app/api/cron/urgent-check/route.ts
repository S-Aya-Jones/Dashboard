import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import Anthropic from "@anthropic-ai/sdk";
import { sendTelegram } from "@/lib/telegram";
import {
  getUnnotifiedUrgentEvents,
  markEventNotified,
  getStoredEmails,
  hasBeenUrgentNotified,
  markUrgentNotified,
  getUpcomingEvents,
  getEventsComingIn1Hour,
  markEvent1hNotified,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

const client = new Anthropic();

function fmtEventDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH  = Math.round(diffMs / 3600000);
  const diffD  = Math.round(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });

  if (diffH <= 2)  return `in ${diffH}h (${timeStr})`;
  if (diffD === 0) return `today at ${timeStr}`;
  if (diffD === 1) return `tomorrow at ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 0. 1-hour alerts — fire before anything else
    const oneHourEvents = await getEventsComingIn1Hour();
    for (const ev of oneHourEvents) {
      const timeStr = new Date(ev.eventDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
      const diffMin = Math.round((new Date(ev.eventDate).getTime() - Date.now()) / 60000);
      const source = ev.sourceSender || ev.sourceSubject || "";
      const msg = `Starting in ${diffMin} min — ${ev.title}${source ? `\n\n${timeStr} · ${source}` : `\n\n${timeStr}`}`;
      await sendTelegram(msg);
      await markEvent1hNotified(ev.id);
    }

    // 1. Upcoming events (within 48h) not yet notified
    const urgentEvents = await getUnnotifiedUrgentEvents();

    // 2. New action/school emails from the last 2 hours not yet individually notified
    const recentEmails = await getStoredEmails(20, 0);
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    const newUrgentEmails = [];
    for (const email of recentEmails) {
      if (email.receivedAt < twoHoursAgo) continue;
      if (email.category !== "action" && email.category !== "school") continue;
      if (await hasBeenUrgentNotified(email.id)) continue;
      newUrgentEmails.push(email);
    }

    // Nothing urgent — skip
    if (urgentEvents.length === 0 && newUrgentEmails.length === 0) {
      return NextResponse.json({ sent: false, reason: "nothing urgent" });
    }

    // 3. Get broader upcoming events for context (next 7 days)
    const weekEvents = await getUpcomingEvents(7);

    // 4. Build context for Claude
    const context = {
      urgentWithin48h: urgentEvents.map(e => ({
        type:    e.eventType,
        title:   e.title,
        when:    fmtEventDate(e.eventDate),
        subject: e.sourceSubject,
        from:    e.sourceSender,
      })),
      newEmailsNeedingAction: newUrgentEmails.map(e => ({
        subject:  e.subject,
        from:     e.senderName || e.senderEmail,
        category: e.category,
        preview:  e.bodyPreview?.slice(0, 120),
      })),
      weekAhead: weekEvents.slice(0, 8).map(e => ({
        type:  e.eventType,
        title: e.title,
        when:  fmtEventDate(e.eventDate),
      })),
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are Aya's personal assistant sending her an URGENT alert via Telegram.

Something needs her attention now. Write a short, direct message (under 150 words):
- Lead with what's most urgent
- List the specific items with their times/dates
- If there are other things coming up this week, briefly mention them for context
- End with one practical next step she should take

Plain text. No markdown asterisks. Warm and direct — like a trusted friend texting her.
Start with "Heads up —"`,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "Heads up — check your dashboard for urgent items.";

    await sendTelegram(text);

    // Mark all as notified
    for (const ev of urgentEvents) await markEventNotified(ev.id);
    for (const email of newUrgentEmails) await markUrgentNotified(email.id);

    return NextResponse.json({ sent: true, urgentEvents: urgentEvents.length, urgentEmails: newUrgentEmails.length });
  } catch (e) {
    console.error("[urgent-check]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
