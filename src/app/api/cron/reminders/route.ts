import { NextRequest, NextResponse } from "next/server";
import {
  getDueReminders,
  advanceReminder,
  sendTelegram,
  formatTimeOfDay,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const due = await getDueReminders();
  let sent  = 0;

  for (const r of due) {
    const timeStr = formatTimeOfDay(r.timeOfDay);
    const text = r.body
      ? `⏰ <b>${r.title}</b>\n${r.body}\n\n<i>${timeStr} reminder</i>`
      : `⏰ <b>${r.title}</b>\n\n<i>${timeStr} reminder</i>`;
    await sendTelegram(text);
    await advanceReminder(r);
    sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: due.length });
}
