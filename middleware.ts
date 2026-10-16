import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifyToken, isOpen } from "@/lib/lock";

// The gate.
//
// Deliberately thin, and deliberately does not look at the database. Middleware
// runs on every request including the ones for scripts and images, and a query
// on each of those is Neon compute time she is billed for by the hour.
//
// So it only asks one question: is there a valid session cookie. Everything
// else, including whether a PIN exists at all, is decided once at /lock, which
// is a page and can afford a query. With no PIN set, /lock issues a session
// immediately and sends her back, so the whole thing costs one redirect on a
// first visit and nothing after that.

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isOpen(pathname)) return NextResponse.next();

  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/lock";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets are served without passing through here at all.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|mp3|mp4)$).*)"],
};
