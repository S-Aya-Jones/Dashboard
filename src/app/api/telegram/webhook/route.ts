import { NextRequest, NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { SmsMessage } from "@/types/dashboard";
import webpush from "web-push";

const vapidReady =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT;

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, title: string, message: string) {
  if (!vapidReady) return;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title, message, url: "/workout" }));
  } catch { /* non-fatal */ }
}

async function reply(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });

  const update = await req.json();
  const msg    = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id as number;
  const raw    = (msg.text as string).trim();
  const body   = raw.toLowerCase().replace(/[!?.]+$/, "").trim();

  let replyText = "Got it! ✓";
  let action    = "";

  if (body === "done" || body === "workout done" || body === "finished" || body === "complete") {
    action    = "Workout marked complete";
    replyText = "Workout logged! You showed up and that's the whole game 🔥 Keep that streak going.";
  } else if (body === "skip" || body === "rest" || body === "rest day") {
    action    = "Rest day logged";
    replyText = "Rest day noted. Recovery is part of the program 💤 See you next session.";
  } else if (/(\d+\.?\d*)\s*lbs?$/.test(body) || /^weight\s+(\d+\.?\d*)/.test(body)) {
    const match = body.match(/(\d+\.?\d*)/);
    if (match) {
      const w = parseFloat(match[1]);
      action    = `Body weight logged: ${w} lbs`;
      replyText = `Weight logged: ${w} lbs 📊 Progress is progress — keep going!`;
      try {
        const data  = await loadData();
        const today = new Date().toISOString().slice(0, 10);
        const wd    = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.bodyWeight = [...(wd.bodyWeight ?? []).filter((b) => b.date !== today), { date: today, weight: w }];
        data.workout  = wd;
        await saveData(data);
        if (data.sms?.pushSubscription) await sendPush(data.sms.pushSubscription, "Weight Logged", `${w} lbs saved to your dashboard 📊`);
      } catch { /* non-fatal */ }
    }
  } else if (/(\d{3,6})\s*steps?/.test(body) || /^steps?\s+(\d{3,6})/.test(body)) {
    const match = body.match(/(\d{3,6})/);
    if (match) {
      const steps = parseInt(match[1]);
      action    = `Steps logged: ${steps.toLocaleString()}`;
      replyText = `${steps.toLocaleString()} steps logged! ${steps >= 10000 ? "10k+ — crushed it! 🏆" : steps >= 8000 ? "Goal hit! 🎯" : "Keep moving!"}`;
      try {
        const data  = await loadData();
        const today = new Date().toISOString().slice(0, 10);
        const wd    = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.walkingLogs = [...(wd.walkingLogs ?? []).filter((l) => l.date !== today), { date: today, steps }];
        data.workout   = wd;
        await saveData(data);
        if (data.sms?.pushSubscription) await sendPush(data.sms.pushSubscription, "Steps Logged", `${steps.toLocaleString()} steps saved to your dashboard 🚶🏾‍♀️`);
      } catch { /* non-fatal */ }
    }
  } else if (body === "help" || body === "commands" || body === "?") {
    replyText = "📋 Commands:\n• DONE — log workout complete\n• SKIP — log rest day\n• 130lbs — log body weight\n• 8500 steps — log steps\n• HELP — show this menu";
    action    = "Help requested";
  } else if (body === "start") {
    replyText = "👋 Hey! I'm your dashboard bot. Send HELP to see what I can track for you.";
    action    = "Bot started";
  } else {
    replyText = "Got your message! 👋 Send HELP to see available commands.";
  }

  // Store message + auto-save chatId if not stored yet
  try {
    const data     = await loadData();
    const inbound: SmsMessage = {
      id: `tg-${Date.now()}`,
      direction: "inbound",
      body: raw,
      timestamp: new Date().toISOString(),
      parsedAction: action || undefined,
    };
    const sms = data.sms ?? { phoneNumber: "", enabled: true, messages: [], reminders: [], telegramChatId: String(chatId) };
    // Auto-capture chat ID on first message
    if (!sms.telegramChatId) sms.telegramChatId = String(chatId);
    sms.messages = [...(sms.messages ?? []), inbound];
    data.sms     = sms;
    await saveData(data);
  } catch { /* non-fatal */ }

  await reply(token, chatId, replyText);
  return NextResponse.json({ ok: true });
}
