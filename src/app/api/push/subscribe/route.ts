import { NextRequest, NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const data = await loadData();
    const sms = data.sms ?? { phoneNumber: "", enabled: true, messages: [], reminders: [] };
    sms.pushSubscription = { endpoint, keys };
    data.sms = sms;
    await saveData(data);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const data = await loadData();
    if (data.sms) {
      delete data.sms.pushSubscription;
      await saveData(data);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
