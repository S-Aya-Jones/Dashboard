import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendViaCarrier, twilioCredentials } from "@/lib/sms";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Twilio reports final delivery here. It matters because creating a message
// only queues it — a send blocked by an unapproved A2P campaign comes back as
// error 30034 minutes later, not at send time. Without this, a notification
// would silently never arrive.
//
// On a terminal failure the same text goes out through the carrier gateway
// instead, so the message still lands.

/**
 * Twilio signs every webhook. Verifying it means this route can't be used by
 * anyone else to make the app send texts.
 */
function validSignature(url: string, params: Record<string, string>, signature: string, token: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const creds = await twilioCredentials();
  if (!creds) return NextResponse.json({ ok: true });

  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });

  const signature = req.headers.get("x-twilio-signature") ?? "";
  // Twilio signs the URL it was configured with, which is the public one.
  const base = process.env.PUBLIC_BASE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!signature || !validSignature(`${base}/api/sms/status`, params, signature, creds.token)) {
    return NextResponse.json({ error: "bad signature" }, { status: 403 });
  }

  const status = params.MessageStatus;
  if (status !== "failed" && status !== "undelivered") {
    return NextResponse.json({ ok: true });
  }

  // Fetch the body from Twilio rather than trusting anything in the webhook.
  let body = "";
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages/${encodeURIComponent(params.MessageSid)}.json`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}` },
        cache: "no-store",
      }
    );
    if (res.ok) body = (await res.json())?.body ?? "";
  } catch { /* fall through to the notice below */ }

  const code = params.ErrorCode;
  const blocked = code === "30034";

  if (body) await sendViaCarrier(body);

  await sendTelegram(
    blocked
      ? "That text didn't go out — Twilio blocked it because the A2P campaign isn't approved yet (error 30034). Sent it through the carrier gateway instead."
      : `A text failed to deliver${code ? ` (Twilio error ${code})` : ""}. Sent it through the carrier gateway instead.`
  ).catch(() => {});

  return NextResponse.json({ ok: true, fellBack: Boolean(body) });
}
