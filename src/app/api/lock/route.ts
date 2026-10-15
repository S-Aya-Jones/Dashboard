import { NextRequest, NextResponse } from "next/server";
import { getAppKey, setAppKey } from "@/lib/appkeys";
import { COOKIE, DAYS, hashPin, makeToken } from "@/lib/lock";

export const dynamic = "force-dynamic";

const KEY = "APP_PIN_HASH";

async function session(res: NextResponse): Promise<NextResponse> {
  res.cookies.set(COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: DAYS * 86_400,
  });
  return res;
}

/** Whether a PIN exists. Asked by the lock screen to decide what to show. */
export async function GET() {
  const stored = await getAppKey(KEY).catch(() => "");
  const res = NextResponse.json({ locked: Boolean(stored) });
  // No PIN set means nothing is locked, so hand out a session on the spot
  // rather than leaving her bouncing off a gate that is guarding nothing.
  return stored ? res : session(res);
}

export async function POST(req: NextRequest) {
  try {
    const { pin, newPin } = (await req.json()) as { pin?: string; newPin?: string };
    const stored = await getAppKey(KEY).catch(() => "");

    // Setting one for the first time.
    if (!stored) {
      const chosen = String(newPin ?? pin ?? "").trim();
      if (chosen.length < 4) {
        return NextResponse.json({ error: "Use at least 4 digits." }, { status: 400 });
      }
      await setAppKey(KEY, await hashPin(chosen));
      return session(NextResponse.json({ ok: true, set: true }));
    }

    if ((await hashPin(String(pin ?? ""))) !== stored) {
      return NextResponse.json({ error: "That is not it." }, { status: 401 });
    }
    return session(NextResponse.json({ ok: true }));
  } catch {
    return NextResponse.json({ error: "Could not read that." }, { status: 400 });
  }
}
