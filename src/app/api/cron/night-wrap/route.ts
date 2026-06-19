import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadData } from "@/lib/db";
import nodemailer from "nodemailer";
import { sendPushNotification } from "@/lib/push";

const client = new Anthropic();

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await loadData();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const h75 = data.seventyFiveHard;
    const startDate = h75?.startDate ?? "2026-06-15";
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    const dayNum = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
    const todayLog = h75?.logs.find(l => l.date === today);

    const RESET_KEYS = ["workout","steps","water","mcat","progressPhoto","diet"];
    const completedCount = RESET_KEYS.filter(k => todayLog?.[k as keyof typeof todayLog]).length;
    const dayComplete = completedCount === RESET_KEYS.length;

    const weights = data.workout?.bodyWeight ?? [];
    const latestWeight = weights.slice(-1)[0];

    // Tomorrow's date of week
    const tomorrowDow = new Date(tomorrow + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

    const context = {
      time: "11pm",
      dayNumber: dayNum,
      dayComplete,
      completedCount,
      totalRequired: RESET_KEYS.length,
      exposureTherapy: todayLog?.exposureTherapy ?? false,
      latestWeight: latestWeight?.weight,
      tomorrowDayOfWeek: tomorrowDow,
      mcatTestDate: data.mcatTestDate,
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are Aya's personal dashboard sending a 11pm nightly wrap-up text.

Write a SHORT wrap-up (under 100 words):
- If day is complete: celebrate briefly, remind her to get good sleep for tomorrow
- If incomplete: be honest about what's missing, ask if she can still get it done before midnight
- End with one prep note for tomorrow (what to prioritize first thing)

Plain text only — no emojis, no bullets, no markdown. Warm and real.
Start with "Night wrap —"`,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "Night wrap — log today's progress on your dashboard before you sleep.";
    // eslint-disable-next-line no-control-regex
    const text = raw.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const phone = process.env.USER_PHONE_NUMBER ?? "6156811609";

    if (gmailUser && gmailPass) {
      const digits = phone.replace(/\D/g, "").replace(/^1/, "");
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } });
      await transporter.sendMail({ from: gmailUser, to: `${digits}@tmomail.net`, subject: " ", text });
    }

    const sms = data.sms ?? { phoneNumber: phone, enabled: true, messages: [], reminders: [] };
    sms.messages = [...(sms.messages ?? []), {
      id: `nightwrap-${Date.now()}`, direction: "outbound" as const, body: text, timestamp: new Date().toISOString(),
    }];
    data.sms = sms;

    await sendPushNotification(data, "Night Wrap", text);

    const { saveData } = await import("@/lib/db");
    await saveData(data);

    return NextResponse.json({ success: true, text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
