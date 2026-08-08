import { NextRequest, NextResponse } from "next/server";
import { COOKIE, sessionValue, safeEqual } from "@/lib/pin";

// A PIN in front of everything personal.
//
// Until now every route answered anyone who had the URL — finances, credit,
// anxiety check-ins and the exposure log included, and POST /api/data would
// let a stranger overwrite the lot. The URL is not a secret: partner links
// live on this same domain, and trimming one back to the host is an ordinary
// thing to do.
//
// Fail closed. With no PIN configured the site serves only the setup notice,
// because an auth check that waves everything through when misconfigured is
// the failure mode that matters.

// Reachable without the PIN, by necessity:
//   partner + notes   — the whole point is that someone else opens them
//   media             — those pages render avatars and images through it
//   sms-opt-in/terms/privacy + api/sms — Twilio's reviewer and its webhooks
//   cron              — an external scheduler calls it, guarded by its own secret
const PUBLIC_PREFIXES = [
  "/login", "/api/login", "/locked",
  "/partner/", "/api/partner/",
  "/notes/", "/api/notes/",
  "/api/media/",
  "/sms-opt-in", "/terms", "/privacy", "/api/sms/",
  "/api/cron/",
];

const PUBLIC_EXACT = new Set([
  "/robots.txt", "/manifest.webmanifest", "/favicon.ico", "/sitemap.xml",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (/^\/(icon|apple-icon|_next|_vercel)/.test(pathname)) return true;
  if (/\.(png|jpg|jpeg|svg|webp|ico|txt|webmanifest)$/.test(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const pin = process.env.APP_PIN;
  if (!pin) {
    if (pathname === "/locked") return NextResponse.next();
    return NextResponse.redirect(new URL("/locked", req.url));
  }

  const cookie = req.cookies.get(COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionValue(pin))) {
    return NextResponse.next();
  }

  // An API call gets a status it can act on; a page gets the PIN screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "locked", detail: "Enter your PIN." }, { status: 401 });
  }
  const to = new URL("/login", req.url);
  to.searchParams.set("next", pathname + search);
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
