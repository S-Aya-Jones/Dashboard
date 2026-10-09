import { NextResponse } from "next/server";
import { speak } from "@/lib/tts";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")        // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1")     // italic
    .replace(/`([^`]+)`/g, "$1")       // inline code
    .replace(/^\|.+\|$/gm, "")         // table rows
    .replace(/^[-=]{3,}$/gm, "")       // hr
    .replace(/⚠️/g, "Warning:")
    .replace(/→|↓|↑|←/g, "to")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+/gm, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Same provider chain as the workout coach — this route used to be
    // ElevenLabs-or-nothing, and nothing is what it had.
    const audio = await speak(stripMarkdown(text).slice(0, 4000), "cue");
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS failed";
    return NextResponse.json({ error: msg }, { status: msg === "no-provider" ? 503 : 502 });
  }
}
