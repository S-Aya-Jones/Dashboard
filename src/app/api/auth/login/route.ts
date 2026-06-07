import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function makeSessionToken(secret: string): string {
  const payload = Date.now().toString();
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const password       = process.env.DASHBOARD_PASSWORD;
  const sessionSecret  = process.env.SESSION_SECRET;

  if (!password || !sessionSecret) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const { password: submitted } = await req.json().catch(() => ({ password: "" }));

  // Constant-time compare to prevent timing attacks
  const a = Buffer.from(submitted  ?? "", "utf8");
  const b = Buffer.from(password,          "utf8");
  let mismatch = a.length !== b.length ? 1 : 0;
  const shorter = Math.min(a.length, b.length);
  for (let i = 0; i < shorter; i++) mismatch |= a[i] ^ b[i];

  if (mismatch !== 0) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = makeSessionToken(sessionSecret);
  const res   = NextResponse.json({ ok: true });
  res.cookies.set("dash_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    maxAge:   60 * 60 * 24 * 30, // 30 days
    path:     "/",
  });
  return res;
}
