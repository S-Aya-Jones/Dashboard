import { NextRequest, NextResponse } from "next/server";
import {
  keywordOf, optOut, subscribe, findByPhone, normalisePhone,
  STOP_MSG, HELP_MSG, CONFIRM_MSG,
} from "@/lib/smsSubscribers";

export const dynamic = "force-dynamic";

// Twilio's inbound webhook: STOP, START and HELP.
//
// Point Twilio's "A message comes in" at this URL for the campaign number.
//
// Twilio does answer STOP itself at the carrier level, but that only stops its
// own sending — this application would carry on queueing messages for a number
// that has withdrawn consent, and the opt-out would be invisible to the one
// place a reviewer or a regulator would look. So the withdrawal is recorded
// here too, per number, taking effect immediately and independently of every
// other subscriber.
//
// Replies go back as TwiML rather than as a fresh API call, so a STOP is
// answered on the same connection even if the send path is blocked.

function twiml(message: string | null) {
  const body = message
    ? `<Response><Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message></Response>`
    : "<Response/>";
  return new NextResponse(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = String(form.get("From") ?? "");
    const body = String(form.get("Body") ?? "");

    const phone = normalisePhone(from);
    if (!phone) return twiml(null);

    switch (keywordOf(body)) {
      case "stop":
        await optOut(phone);
        return twiml(STOP_MSG);

      case "start": {
        // Re-subscribing writes a fresh consent timestamp. The previous one was
        // withdrawn and no longer says anything true.
        const existing = await findByPhone(phone);
        await subscribe({ phone, name: existing?.name ?? null, role: existing?.role ?? "partner", ip: null });
        return twiml(CONFIRM_MSG);
      }

      case "help":
        return twiml(HELP_MSG);

      default:
        // Anything else is a person talking to a robot. Say nothing rather than
        // send an unsolicited message to a number that didn't ask for one.
        return twiml(null);
    }
  } catch {
    return twiml(null);
  }
}
