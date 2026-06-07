import { NextResponse } from "next/server";

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

    const apiKey  = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });
    }

    const clean     = stripMarkdown(text);
    // ElevenLabs has a ~5000 char practical limit for turbo; cap generously
    const truncated = clean.length > 4500 ? clean.slice(0, 4500) + "." : clean;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: truncated,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.80,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("ElevenLabs error:", response.status, detail);
      return NextResponse.json(
        { error: "TTS failed", detail },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Speak route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
