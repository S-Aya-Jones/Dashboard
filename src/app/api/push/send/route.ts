import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  if (!vapidConfigured) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const title: string = body.title ?? "Aya's Dashboard";
    const message: string = body.message ?? "";
    const url: string = body.url ?? "/";

    const data = await loadData();
    const sub = data.sms?.pushSubscription;
    if (!sub) {
      return NextResponse.json({ error: "No push subscription stored" }, { status: 404 });
    }

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({ title, message, url }),
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode ?? 500;
    // 410 Gone means subscription expired — clean it up
    if (status === 410) {
      try {
        const data = await loadData();
        if (data.sms) {
          delete data.sms.pushSubscription;
          const { saveData } = await import("@/lib/db");
          await saveData(data);
        }
      } catch { /* non-fatal */ }
    }
    return NextResponse.json({ error: String(e) }, { status });
  }
}
