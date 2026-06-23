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

// Tones with their own HeyGen Starfish voice (standalone audio-only TTS, no avatar video)
const TONE_HEYGEN_VOICE_ENV: Record<string, string> = {
  truecrime: "HEYGEN_VOICE_ID_TRUECRIME",
  housewives: "HEYGEN_VOICE_ID_HOUSEWIVES",
};

async function speakWithHeygen(text: string, voiceId: string): Promise<Response> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HeyGen not configured" }, { status: 500 });
  }

  const genRes = await fetch("https://api.heygen.com/v3/voices/speech", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  if (!genRes.ok) {
    const detail = await genRes.text();
    console.error("HeyGen speech error:", genRes.status, detail);
    return NextResponse.json({ error: "TTS failed", detail }, { status: genRes.status });
  }

  const { audio_url } = await genRes.json();
  if (!audio_url) {
    return NextResponse.json({ error: "HeyGen returned no audio" }, { status: 500 });
  }

  const audioRes = await fetch(audio_url);
  const audioBuffer = await audioRes.arrayBuffer();

  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  try {
    const { text, tone } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const clean = stripMarkdown(text);

    const heygenEnvKey = tone ? TONE_HEYGEN_VOICE_ENV[tone] : undefined;
    const heygenVoiceId = heygenEnvKey ? process.env[heygenEnvKey] : undefined;
    if (heygenVoiceId) {
      return speakWithHeygen(clean.length > 9000 ? clean.slice(0, 9000) + "." : clean, heygenVoiceId);
    }

    const apiKey  = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });
    }

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
            stability: 0.32,
            similarity_boost: 0.80,
            style: 0.6,
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
