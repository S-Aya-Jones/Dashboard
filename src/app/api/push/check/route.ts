import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";
import webpush from "web-push";
import { loadData } from "@/lib/db";

const vapidConfigured =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, title: string, message: string, url: string) {
  if (!vapidConfigured) return;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title, message, url }));
  } catch { /* subscription may be stale */ }
}

export async function GET() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ skipped: "no google" });

  const data = await loadData();
  const sub = data.sms?.pushSubscription;
  if (!sub) return NextResponse.json({ skipped: "no subscription" });

  const results: string[] = [];

  // ── Calendar: events starting in the next 30 minutes ──
  try {
    const auth = getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const now = new Date();
    const soon = new Date(now.getTime() + 31 * 60000);
    const past = new Date(now.getTime() - 5 * 60000);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: past.toISOString(),
      timeMax: soon.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 5,
    });

    for (const event of res.data.items ?? []) {
      const start = event.start?.dateTime;
      if (!start) continue;
      const startMs = new Date(start).getTime();
      const minsAway = Math.round((startMs - now.getTime()) / 60000);
      if (minsAway >= 0 && minsAway <= 30) {
        const label = minsAway <= 1 ? "starting now" : `in ${minsAway} min`;
        await sendPush(sub, `📅 ${event.summary ?? "Event"}`, `${label}${event.location ? ` · ${event.location}` : ""}`, "/integrations");
        results.push(`calendar: ${event.summary}`);
      }
    }
  } catch { /* google not connected */ }

  // ── Gmail: unread reply-needed threads (checked at most once per session via header) ──
  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const list = await gmail.users.threads.list({ userId: "me", q: "in:inbox is:unread", maxResults: 5, labelIds: ["INBOX"] });
    const count = list.data.resultSizeEstimate ?? 0;
    if (count > 0) {
      await sendPush(sub, `📬 ${count} unread email${count > 1 ? "s" : ""}`, "Tap to open your inbox", "/integrations");
      results.push(`gmail: ${count} unread`);
    }
  } catch { /* gmail not connected */ }

  return NextResponse.json({ sent: results });
}
