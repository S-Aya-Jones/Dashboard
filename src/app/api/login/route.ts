import { NextRequest, NextResponse } from "next/server";
import { COOKIE, SESSION_DAYS, sessionValue } from "@/lib/pin";

export const dynamic = "force-dynamic";

// Deliberately slow to hammer: a 4-digit PIN is only 10,000 guesses, so the
// delay below is what makes the space expensive to walk rather than the PIN's
// own length.
const DELAY_MS = 400;

export async function POST(req: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) {
    return NextResponse.json({ error: "No PIN is configured yet." }, { status: 503 });
  }

  const { pin: supplied } = await req.json().catch(() => ({ pin: "" }));
  await new Promise(r => setTimeout(r, DELAY_MS));

  if (typeof supplied !== "string" || supplied !== pin) {
    return NextResponse.json({ error: "That PIN isn't right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: await sessionValue(pin),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
