import { NextResponse } from "next/server";
import { speak, activeProvider, type CueStyle } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Which voice is in play, so the client knows whether to bother asking.
export async function GET() {
  const provider = await activeProvider();
  return NextResponse.json({ provider, real: provider !== null });
}

export async function POST(req: Request) {
  try {
    const { text, style } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const audio = await speak(text, (style as CueStyle) ?? "cue");
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        // Cues repeat constantly across a session — let the browser keep them.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS failed";
    // 503 rather than 500: it's a missing voice, not a broken route, and the
    // client uses it to fall back to the system voice quietly.
    const status = msg === "no-provider" ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
