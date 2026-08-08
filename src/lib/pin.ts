// The session cookie for PIN entry.
//
// Deliberately dependency-free and Web Crypto only, because the check runs in
// middleware on the edge, where Node's crypto and the database are both out of
// reach. Hitting the database on every request to validate a session would
// reintroduce the traffic problem that took the site down.

export const COOKIE = "aya_session";

/** Days a successful PIN entry is remembered for. */
export const SESSION_DAYS = 60;

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The cookie value a correct PIN produces. Salted with a fixed application
 * string so the cookie is not a bare hash of the PIN — that would be trivially
 * reversible against a rainbow table for a 4–6 digit number.
 */
export async function sessionValue(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`aya-dashboard:v1:${pin}`);
  return hex(await crypto.subtle.digest("SHA-256", data));
}

/** Length-independent comparison, so a wrong cookie leaks nothing by timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
