import { getAppKey } from "@/lib/appkeys";

// The coach's voice.
//
// This used to be ElevenLabs or nothing, and since the ElevenLabs env vars
// were never set it was always nothing — every cue fell through to the
// browser's built-in speech synthesis, which is the robotic voice.
//
// Now it tries real voices in order and only gives up at the end. OpenAI's
// tts-1 is the practical default: the transcription key already in the app is
// usually an OpenAI key, so it costs nothing extra to set up and sounds
// nothing like the browser.

export type TtsProvider = "elevenlabs" | "openai" | null;

async function key(...names: string[]): Promise<string | null> {
  for (const n of names) {
    const v = await getAppKey(n);
    if (v) return v;
  }
  return null;
}

/** Which real voice is available, if any. */
export async function activeProvider(): Promise<TtsProvider> {
  const eleven = await key("ELEVENLABS_API_KEY");
  const voice  = await key("ELEVENLABS_VOICE_ID");
  if (eleven && voice) return "elevenlabs";

  const openai = await key("OPENAI_API_KEY", "TRANSCRIPTION_API_KEY");
  // A whisper-api.com key does transcription only — it can't speak.
  if (openai && !openai.startsWith("wai_")) return "openai";

  return null;
}

async function speakElevenLabs(text: string): Promise<ArrayBuffer> {
  const apiKey  = (await key("ELEVENLABS_API_KEY"))!;
  const voiceId = (await key("ELEVENLABS_VOICE_ID"))!;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    cache: "no-store",
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.8,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

// A warm, even voice that holds up over a gym speaker. "nova" and "shimmer"
// are the two that don't sound like a newsreader.
const OPENAI_VOICE = "nova";

async function speakOpenAI(text: string, style: CueStyle): Promise<ArrayBuffer> {
  const apiKey = (await key("OPENAI_API_KEY", "TRANSCRIPTION_API_KEY"))!;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      model: "tts-1",
      voice: OPENAI_VOICE,
      input: text,
      // Cues land better a touch quicker than conversational pace; a rest
      // countdown wants to be calmer.
      speed: style === "rest" ? 0.95 : 1.06,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

export type CueStyle = "cue" | "rest" | "count";

/**
 * Speak a line. Throws only when no real voice is configured at all, which
 * the client treats as its signal to use the system voice.
 */
export async function speak(text: string, style: CueStyle = "cue"): Promise<ArrayBuffer> {
  const provider = await activeProvider();
  if (!provider) throw new Error("no-provider");

  const clean = text.replace(/<[^>]+>/g, "").slice(0, 900);

  if (provider === "elevenlabs") {
    try {
      return await speakElevenLabs(clean);
    } catch {
      // A dead ElevenLabs quota shouldn't drop her to the robot if OpenAI
      // is sitting right there.
      const openai = await key("OPENAI_API_KEY", "TRANSCRIPTION_API_KEY");
      if (openai && !openai.startsWith("wai_")) return speakOpenAI(clean, style);
      throw new Error("no-provider");
    }
  }

  return speakOpenAI(clean, style);
}

/** Check a key works before it gets stored, so a bad paste never persists. */
export async function verifyVoiceKey(
  opts: { openaiKey?: string } | { elevenKey: string; voiceId: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    if ("openaiKey" in opts && opts.openaiKey) {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.openaiKey}`, "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ model: "tts-1", voice: OPENAI_VOICE, input: "Voice check.", response_format: "mp3" }),
      });
      if (res.status === 401) return { ok: false, error: "OpenAI rejected that key." };
      if (res.status === 429) return { ok: false, error: "That key is out of quota." };
      if (!res.ok) return { ok: false, error: `OpenAI replied ${res.status}.` };
      return { ok: true };
    }

    if ("elevenKey" in opts) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": opts.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        cache: "no-store",
        body: JSON.stringify({ text: "Voice check.", model_id: "eleven_turbo_v2_5" }),
      });
      if (res.status === 401) return { ok: false, error: "ElevenLabs rejected that key." };
      if (res.status === 404) return { ok: false, error: "That voice ID doesn't exist on the account." };
      if (!res.ok) return { ok: false, error: `ElevenLabs replied ${res.status}.` };
      return { ok: true };
    }

    return { ok: false, error: "Nothing to check." };
  } catch {
    return { ok: false, error: "Couldn't reach the voice service to check the key." };
  }
}
