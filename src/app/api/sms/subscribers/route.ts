import { NextResponse } from "next/server";
import { activeSubscribers, subscriberCounts } from "@/lib/smsSubscribers";

export const dynamic = "force-dynamic";

// Who is on the list, for the Telegram settings screen.
//
// Numbers come back partly masked. This is Aya's own admin view, but a
// subscriber's full number has no reason to travel to a browser just to be
// counted, and the opt-out evidence is the timestamp rather than the digits.

function mask(phone: string): string {
  return phone.length === 10 ? `(${phone.slice(0, 3)}) •••-${phone.slice(6)}` : "•••";
}

export async function GET() {
  try {
    const [subs, counts] = await Promise.all([activeSubscribers(), subscriberCounts()]);
    return NextResponse.json({
      counts,
      subscribers: subs.map(s => ({
        id: s.id,
        name: s.name,
        phone: mask(s.phone),
        role: s.role,
        consentAt: s.consentAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
