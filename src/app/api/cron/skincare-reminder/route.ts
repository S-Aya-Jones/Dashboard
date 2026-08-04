import { NextRequest, NextResponse } from "next/server";
import { loadData } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";
import { sendPushNotification } from "@/lib/push";

export const dynamic = "force-dynamic";

// Fires at 7:55pm Central — the hand-off from study blocks into the
// skincare hour (8–9pm) that closes the day before 9pm lights-out.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const text =
      "7:55 — study blocks are done. Skincare hour starts now: " +
      "phone on the charger, call your boo while you do your routine, " +
      "gym bag + clothes laid out for the morning. Lights out at 9. 🧴✨";

    await sendTelegram(text);

    const data = await loadData();
    await sendPushNotification(data, "Skincare Hour", text);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
