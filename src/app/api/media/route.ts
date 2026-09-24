import { NextRequest, NextResponse } from "next/server";
import { putMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

// Store an image and hand back its id.
//
// Everything that shows a photo goes through here rather than putting base64
// into the dashboard blob. The blob is read whole on every page load and
// written whole on every change; a handful of photos inside it is what
// exhausted the database transfer quota once already.
export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json();
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "expected an image data URL" }, { status: 400 });
    }
    // ~1.4MB of base64 is a generous ceiling for a thumbnail and well under
    // Vercel's body cap.
    if (dataUrl.length > 1_400_000) {
      return NextResponse.json({ error: "that image is too large — shrink it first" }, { status: 413 });
    }

    const id = `m-${Math.random().toString(36).slice(2, 12)}`;
    const stored = await putMedia(id, dataUrl);
    if (!stored) return NextResponse.json({ error: "couldn't store that image" }, { status: 500 });

    return NextResponse.json({ mediaId: stored });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
