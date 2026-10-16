import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

// Photos are served as real images rather than base64 inside JSON, so the
// browser caches them and a save never carries them back up the wire.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return new NextResponse("bad id", { status: 400 });
  }

  const m = await getMedia(id);
  if (!m) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(m.buffer), {
    headers: {
      "Content-Type": m.mime,
      // A stored photo never changes under the same id.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
