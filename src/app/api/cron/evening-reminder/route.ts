import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadData } from "@/lib/db";
import nodemailer from "nodemailer";

const client = new Anthropic();

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await loadData();
    const today = new Date().toISOString().slice(0, 10);

    const h75 = data.seventyFiveHard;
    const startDate = h75?.startDate ?? "2026-06-15";
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    const dayNum = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
    const todayLog = h75?.logs.find(l => l.date === today);

    const walkingLogs = data.workout?.walkingLogs ?? [];
    const todaySteps = walkingLogs.find(l => l.date === today)?.steps ?? 0;

    const done = ["workout","steps","water","mcat","progressPhoto","diet"].filter(k => todayLog?.[k as keyof typeof todayLog]);
    const missing = ["workout","steps","water","mcat","progressPhoto","diet"].filter(k => !todayLog?.[k as keyof typeof todayLog]);

    const context = {
      time: "6pm",
      dayNumber: dayNum,
      done,
      missing,
      todaySteps,
      exposureTherapy: todayLog?.exposureTherapy ?? false,
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are Aya's personal dashboard sending a 6pm evening reminder text.

Write a SHORT reminder (under 100 words) covering:
- What's still missing from her 75 Hard — be specific and direct
- If exposure therapy isn't done, nudge her (it won't restart the clock, just do something)
- One specific action she can take right now (evening walk, photo, drink water, etc.)

Plain text only — no emojis, no bullets, no markdown. Warm but urgent — the day is almost done.
Start with "6pm —"`,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "6pm — check your 75 Hard progress for today before the night gets away from you.";
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
      id: `evening-${Date.now()}`, direction: "outbound" as const, body: text, timestamp: new Date().toISOString(),
    }];
    data.sms = sms;
    const { saveData } = await import("@/lib/db");
    await saveData(data);

    return NextResponse.json({ success: true, text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
