import webpush from "web-push";
import { DashboardData } from "@/types/dashboard";
import { loadData, saveData } from "@/lib/db";

const vapidConfigured =
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function sendPushNotification(data: DashboardData, title: string, message: string, url = "/") {
  if (!vapidConfigured) return;
  const sub = data.sms?.pushSubscription;
  if (!sub) return;

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({ title, message, url }),
    );
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 410) {
      const fresh = await loadData();
      if (fresh.sms) {
        delete fresh.sms.pushSubscription;
        await saveData(fresh);
      }
    }
  }
}
