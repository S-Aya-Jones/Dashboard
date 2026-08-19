import { NextResponse } from "next/server";
import { getAppKey } from "@/lib/appkeys";

export const dynamic = "force-dynamic";

// The number people text is public by definition — it's printed on the
// consent page. Serving it means /sms-opt-in shows the real number as soon as
// Twilio is configured, instead of a placeholder that reads as unfinished to
// an A2P reviewer.
export async function GET() {
  const raw =
    (await getAppKey("TWILIO_PHONE_NUMBER")) ??
    process.env.TWILIO_PHONE_NUMBER ??
    process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ??
    null;

  if (!raw) return NextResponse.json({ number: null, display: null });

  const d = raw.replace(/\D/g, "").replace(/^1/, "");
  const display = d.length === 10
    ? `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : raw;

  return NextResponse.json({ number: raw, display });
}
