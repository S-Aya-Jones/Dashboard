import { NextRequest, NextResponse } from "next/server";
import { getAppKey, setAppKey, clearAppKey } from "@/lib/appkeys";
import { sendSms, smsStatus, verifyTwilio, CARRIERS } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...(await smsStatus()), carriers: Object.keys(CARRIERS) });
}

export async function POST(req: NextRequest) {
  try {
    const { phone, carrier, enabled, test, twilioSid, twilioToken, twilioFrom } = await req.json();

    // Credentials are checked against Twilio before being stored, so a typo
    // can't sit there silently failing every send.
    if (typeof twilioSid === "string" && twilioSid.trim() &&
        typeof twilioToken === "string" && twilioToken.trim()) {
      const check = await verifyTwilio(twilioSid.trim(), twilioToken.trim());
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      await setAppKey("TWILIO_ACCOUNT_SID", twilioSid.trim());
      await setAppKey("TWILIO_AUTH_TOKEN", twilioToken.trim());
    }
    if (typeof twilioFrom === "string" && twilioFrom.trim()) {
      const digits = twilioFrom.replace(/[^\d+]/g, "");
      if (!/^\+1\d{10}$/.test(digits)) {
        return NextResponse.json({ error: "The Twilio number needs to look like +16155551234." }, { status: 400 });
      }
      await setAppKey("TWILIO_PHONE_NUMBER", digits);
    }

    if (typeof phone === "string" && phone.trim()) {
      const digits = phone.replace(/\D/g, "").replace(/^1/, "");
      if (digits.length !== 10) {
        return NextResponse.json({ error: "That doesn't look like a 10-digit US number." }, { status: 400 });
      }
      await setAppKey("USER_PHONE_NUMBER", digits);
    }
    if (typeof carrier === "string" && carrier in CARRIERS) {
      await setAppKey("SMS_CARRIER", carrier);
    }
    if (typeof enabled === "boolean") {
      if (enabled) await setAppKey("SMS_ALSO", "1");
      else await clearAppKey("SMS_ALSO");
    }

    if (test) {
      const status = await smsStatus();
      if (!status.twilio && !status.mailReady) {
        return NextResponse.json(
          { error: "Nothing to send with yet. Add Twilio credentials, or set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel for the carrier gateway." },
          { status: 400 }
        );
      }
      const ok = await sendSms("Test from your dashboard. If this landed, texts are working.");
      if (!ok) {
        return NextResponse.json(
          { error: status.twilio
              ? "Twilio rejected it. If the A2P campaign isn't approved yet, US carriers will refuse the traffic."
              : "The gateway rejected it. Check the carrier is right." },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, sent: true, ...(await smsStatus()) });
    }

    return NextResponse.json({ ok: true, ...(await smsStatus()) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
