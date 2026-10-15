// The lock on the front door.
//
// She is writing a journal in here, and prayers, and what her anxiety was doing
// on the way home. None of that was behind anything.
//
// Three decisions worth stating, because each of them could have gone the other
// way and the wrong choice is hard to notice until it bites.
//
// It fails open, not closed. If no PIN has been set, nothing is locked. An
// earlier attempt at this was wired to an environment variable and would have
// locked her out of her own dashboard the moment that variable went missing in
// a deploy, which is exactly the sort of thing that happens on a Friday night.
// A lock she cannot open is worse than no lock at all, because the data is
// still there and she is the only person now unable to reach it.
//
// The PIN lives in the database rather than in the environment, for the same
// reason the Twilio keys were moved there: she can change it from a screen,
// and a redeploy cannot lose it.
//
// The cookie is signed with a key derived from DATABASE_URL. That is a secret
// the server already has everywhere it needs one, including the edge runtime
// the middleware runs in, so the lock needs nothing added to Vercel to work. It
// is never sent to the browser and the PIN is never stored in the clear.

const COOKIE = "aya_session";
const DAYS = 30;

function enc(s: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(s);
  // Copied into a plain ArrayBuffer because Web Crypto wants one, and the
  // encoder's view is not guaranteed to be backed by exactly that.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", k, enc(message)));
}

function signingKey(): string {
  // Not the connection string itself in any output: only ever an HMAC key.
  return process.env.DATABASE_URL ?? "no-database-url";
}

/** What gets stored, so the PIN itself never is. */
export async function hashPin(pin: string): Promise<string> {
  return hmac(signingKey(), `pin:${pin.trim()}`);
}

/** A session token: when it expires, and a signature over that. */
export async function makeToken(): Promise<string> {
  const expires = Date.now() + DAYS * 86_400_000;
  const sig = await hmac(signingKey(), `session:${expires}`);
  return `${expires}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiresRaw, sig] = token.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const want = await hmac(signingKey(), `session:${expires}`);
  // Length is fixed and both sides are hex, so a plain comparison leaks
  // nothing useful here, but constant time costs nothing either.
  if (sig?.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= sig.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export { COOKIE, DAYS };

/**
 * Paths that must stay reachable without a session.
 *
 * Twilio and the cron pinger cannot log in, and the opt in, terms and privacy
 * pages are public by obligation: the campaign registration points carriers at
 * them, and a locked consent page is a failed audit.
 */
export const OPEN_PATHS = [
  "/api/sms/",
  "/api/cron/",
  "/api/lock",
  "/lock",
  "/sms-opt-in",
  "/terms",
  "/privacy",
  "/manifest",
  "/favicon",
  "/icon",
  "/apple-icon",
];

export function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p));
}
