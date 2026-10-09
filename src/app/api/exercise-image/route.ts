import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Demo frames come from free-exercise-db on jsDelivr. Serving them through
// our own origin means they load on the same connection as the app and get
// cached at the edge, so a session mid-set never waits on a third party.
// The path is validated rather than proxied blind.
const BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";
const SAFE_PATH = /^[A-Za-z0-9_\-.()/]+\/\d+\.jpg$/;

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("p") ?? "";

  // No traversal, no absolute URLs, no surprises — just Folder_Name/0.jpg.
  if (!SAFE_PATH.test(path) || path.includes("..")) {
    return new NextResponse("bad path", { status: 400 });
  }

  try {
    const upstream = await fetch(`${BASE}/${path}`, { cache: "no-store" });
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
        // These frames are immutable — pinned to a commit-less tag but the
        // dataset itself is stable.
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
