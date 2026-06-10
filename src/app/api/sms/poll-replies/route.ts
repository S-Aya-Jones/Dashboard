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
    await client.mailboxOpen("INBOX");

    // Find unread emails from T-Mobile gateway in last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages: { uid: number; body: string; from: string }[] = [];

    for await (const msg of client.fetch(
      { since, seen: false },
      { envelope: true, bodyStructure: true, source: true }
    )) {
      const from = msg.envelope?.from?.[0]?.address ?? "";
      if (from.includes(TMOBILE_SENDER_DOMAIN)) {
        const source = msg.source?.toString() ?? "";
        // Extract plain text body from email source
        const textMatch = source.match(/\r\n\r\n([\s\S]+?)(\r\n--|\r\n\r\n--|$)/);
        const body = textMatch?.[1]?.trim() ?? "";
        if (body) messages.push({ uid: msg.uid, body, from });
      }
    }

    if (messages.length === 0) {
      await client.logout();
      return NextResponse.json({ processed: 0 });
    }

    // Process each reply
    const data = await loadData();
    const sms = data.sms ?? { phoneNumber: user, enabled: true, messages: [], reminders: [] };
    let processed = 0;

    for (const msg of messages) {
      const { reply, action, weightUpdate, stepsUpdate } = parseIntent(msg.body);

      // Update dashboard data
      if (weightUpdate !== undefined) {
        const today = new Date().toISOString().slice(0, 10);
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.bodyWeight = [...(wd.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight: weightUpdate }];
        data.workout = wd;
      }
      if (stepsUpdate !== undefined) {
        const today = new Date().toISOString().slice(0, 10);
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.walkingLogs = [...(wd.walkingLogs ?? []).filter(l => l.date !== today), { date: today, steps: stepsUpdate }];
        data.workout = wd;
      }

      // Store inbound message
      const inbound: SmsMessage = {
        id: `sms-${Date.now()}-${processed}`,
        direction: "inbound",
        body: msg.body,
        timestamp: new Date().toISOString(),
        parsedAction: action || undefined,
      };
      sms.messages = [...(sms.messages ?? []), inbound];

      // Send reply back via email gateway
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });

      // Mark as read
      await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
      processed++;
    }

    data.sms = sms;
    await saveData(data);
    await client.logout();

    return NextResponse.json({ processed });
  } catch (e) {
    try { await client.logout(); } catch { /* ignore */ }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
