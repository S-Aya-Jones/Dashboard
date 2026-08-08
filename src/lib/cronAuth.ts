import { NextRequest } from "next/server";

// Cron endpoints sit outside the PIN, because an external scheduler calls them.
// That makes them the one remaining way a stranger with the URL could act on
// this account — triggering her Telegram and text messages at will.
//
// Enforced only once CRON_SECRET is set, so turning it on is a setting rather
// than a redeploy that silently stops every notification. Leaving it unset is
// the current behaviour, not a regression.
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const supplied =
    req.nextUrl.searchParams.get("key") ??
    req.headers.get("x-cron-key") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (supplied.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= supplied.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
