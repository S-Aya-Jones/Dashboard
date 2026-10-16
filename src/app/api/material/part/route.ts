import { NextRequest, NextResponse } from "next/server";
import { putPart } from "@/lib/courseMaterial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One slice of a base64 PDF. Vercel caps a request body at 4.5MB and base64
// inflates by a third, so a shared study guide arrives in pieces — the same
// reason lecture audio and lecture decks do.
export async function POST(req: NextRequest) {
  try {
    const { key, idx, data } = await req.json();
    if (typeof key !== "string" || !/^[a-z0-9-]{6,64}$/i.test(key)) {
      return NextResponse.json({ error: "bad key" }, { status: 400 });
    }
    if (typeof idx !== "number" || typeof data !== "string" || !data) {
      return NextResponse.json({ error: "idx and data required" }, { status: 400 });
    }
    await putPart(key, idx, data);
    return NextResponse.json({ ok: true, idx });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
