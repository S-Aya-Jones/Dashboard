import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Recipe photos come from a third-party host. Serving them through our own
// origin means one set of connections, no mixed-content or referrer-policy
// surprises, and the CDN can cache them. The host allowlist keeps this from
// becoming an open proxy.
const ALLOWED = new Set([
  "www.themealdb.com",
  "themealdb.com",
  "img.spoonacular.com",
  "spoonacular.com",
]);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new NextResponse("missing u", { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.has(url.hostname)) {
    return new NextResponse("host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(url.toString(), { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("upstream error", { status: 502 });
    }
    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return new NextResponse("not an image", { status: 415 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": type,
        // Recipe photos never change under the same URL.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
