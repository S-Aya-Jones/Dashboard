import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { loadData, saveData } from "@/lib/db";
import { SmsMessage } from "@/types/dashboard";

const TMOBILE_SENDER_DOMAIN = "tmomail.net";

function parseIntent(raw: string): { reply: string; action: string; weightUpdate?: number; stepsUpdate?: number } {
  const body = raw.toLowerCase().replace(/[!?.]+$/, "").trim();

  if (["done", "workout done", "finished", "complete", "completed"].includes(body)) {
    return { reply: "Workout logged! You showed up and that's the whole game. 🔥", action: "Workout marked complete" };
  }
  if (["skip", "rest", "rest day"].includes(body)) {
    return { reply: "Rest day noted. Recovery is part of the program. 💤", action: "Rest day logged" };
  }
  if (/(\d+\.?\d*)\s*lbs?$/.test(body) || /^weight\s+(\d+\.?\d*)/.test(body) || /^(\d+\.?\d*)\s*pounds?/.test(body)) {
    const match = body.match(/(\d+\.?\d*)/);
    if (match) {
      const w = parseFloat(match[1]);
      return { reply: `Weight logged: ${w} lbs 📊`, action: `Body weight logged: ${w} lbs`, weightUpdate: w };
    }
  }
  if (/(\d{3,6})\s*steps?/.test(body) || /^steps?\s+(\d{3,6})/.test(body)) {
    const match = body.match(/(\d{3,6})/);
    if (match) {
      const steps = parseInt(match[1]);
      return { reply: `${steps.toLocaleString()} steps logged! 🏃`, action: `Steps logged: ${steps}`, stepsUpdate: steps };
    }
  }
  if (["help", "commands", "?"].includes(body)) {
    return { reply: "📋 DONE • SKIP • 130lbs • 8500 steps • HELP", action: "Help requested" };
  }
  return { reply: "Got it! 👋 Reply HELP to see what I can track.", action: "" };
}

// Folders to search — Gmail stores everything in All Mail
const FOLDERS_TO_CHECK = ["INBOX", "[Gmail]/All Mail", "All Mail"];

export async function GET() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return NextResponse.json({ error: "Gmail not configured" }, { status: 503 });

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages: { uid: number; body: string; from: string; folder: string }[] = [];
    const seenIds = new Set<string>();

    for (const folder of FOLDERS_TO_CHECK) {
      try {
        await client.mailboxOpen(folder);
      } catch {
        continue; // folder doesn't exist, skip
      }

      // Search all messages (read or unread) from T-Mobile in last 24h
      for await (const msg of client.fetch(
        { since },
        { envelope: true, source: true }
      )) {
        const from = msg.envelope?.from?.[0]?.address ?? "";
        if (!from.includes(TMOBILE_SENDER_DOMAIN)) continue;

        const msgId = msg.envelope?.messageId ?? `${msg.uid}`;
        if (seenIds.has(msgId)) continue;
        seenIds.add(msgId);

        const source = msg.source?.toString() ?? "";
        // Try multiple patterns to extract plain text body
        const textMatch =
          source.match(/Content-Type: text\/plain[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]+?)(?:\r\n--|\r\n\r\n--|$)/) ??
          source.match(/\r\n\r\n([\s\S]+?)(?:\r\n--|$)/);
        const body = textMatch?.[1]?.trim() ?? "";
        if (body) messages.push({ uid: msg.uid, body, from, folder });
      }
    }

    if (messages.length === 0) {
      await client.logout();
      return NextResponse.json({ processed: 0, checked: FOLDERS_TO_CHECK });
    }

    const data = await loadData();
    const sms = data.sms ?? { phoneNumber: user, enabled: true, messages: [], reminders: [] };

    // Get already-processed message IDs to avoid duplicates
    const existingIds = new Set((sms.messages ?? []).map(m => m.id));
    let processed = 0;

    for (const msg of messages) {
      const msgKey = `tmobile-${msg.from}-${msg.body.slice(0, 20)}`;
      // Skip if we already have a message with this same content from today
      const today = new Date().toISOString().slice(0, 10);
      const alreadyStored = (sms.messages ?? []).some(
        m => m.direction === "inbound" && m.body === msg.body && m.timestamp.startsWith(today)
      );
      if (alreadyStored) continue;

      const { reply, action, weightUpdate, stepsUpdate } = parseIntent(msg.body);

      if (weightUpdate !== undefined) {
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.bodyWeight = [...(wd.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight: weightUpdate }];
        data.workout = wd;
      }
      if (stepsUpdate !== undefined) {
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.walkingLogs = [...(wd.walkingLogs ?? []).filter(l => l.date !== today), { date: today, steps: stepsUpdate }];
        data.workout = wd;
      }

      const inbound: SmsMessage = {
        id: `sms-in-${Date.now()}-${processed}`,
        direction: "inbound",
        body: msg.body,
        timestamp: new Date().toISOString(),
        parsedAction: action || undefined,
      };
      sms.messages = [...(sms.messages ?? []), inbound];

      // Send reply back
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
      if (appUrl) {
        await fetch(`${appUrl}/api/sms/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: reply }),
        }).catch(() => {});
      }

      processed++;
    }

    if (processed > 0) {
      data.sms = sms;
      await saveData(data);
    }

    await client.logout();
    return NextResponse.json({ processed, found: messages.length });
  } catch (e) {
    try { await client.logout(); } catch { /* ignore */ }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
