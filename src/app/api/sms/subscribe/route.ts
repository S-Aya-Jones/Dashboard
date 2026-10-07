import { NextRequest, NextResponse } from "next/server";
import { subscribe, normalisePhone, CONFIRM_MSG, type Role } from "@/lib/smsSubscribers";
import { sendSmsTo } from "@/lib/sms";

export const dynamic = "force-dynamic";

// Where the opt-in form actually posts.
//
// The form used to show a confirmation panel and store nothing, which meant
// there was no consent record behind any number — the thing an A2P reviewer
// asks for first. Now the consent, the moment it was given and the address it
// came from are all written down before a single message is sent.
//
// The confirmation text is sent from the same constant the campaign
// registration quotes, so what was registered and what arrives cannot drift.

export async function POST(req: NextRequest) {
  try {
    const { phone, name, role, consent } = await req.json();

    // Consent is the whole point of the endpoint; without it there is nothing
    // to record and nothing that would make a send lawful.
    if (consent !== true) {
      return NextResponse.json({ error: "Consent is required to subscribe." }, { status: 400 });
    }

    const digits = normalisePhone(String(phone ?? ""));
    if (!digits) {
      return NextResponse.json({ error: "That doesn't look like a 10-digit US mobile number." }, { status: 400 });
    }

    // Behind Vercel the client address arrives in a header, not on the socket.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    const sub = await subscribe({
      phone: digits,
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      role: (role === "self" ? "self" : "partner") as Role,
      ip,
    });
    if (!sub) return NextResponse.json({ error: "Couldn't save that number." }, { status: 400 });

    // A failed confirmation doesn't undo consent — it was still given, and the
    // record of it is what matters. Report it so the page can say so.
    const sent = await sendSmsTo(digits, CONFIRM_MSG).catch(() => false);

    return NextResponse.json({
      ok: true,
      confirmationSent: sent,
      subscriber: { phone: sub.phone, role: sub.role, consentAt: sub.consentAt },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
