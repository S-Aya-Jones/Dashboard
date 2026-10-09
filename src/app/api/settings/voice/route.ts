import { NextRequest, NextResponse } from "next/server";
import { setAppKey, clearAppKey, appKeyStatus } from "@/lib/appkeys";
import { activeProvider, verifyVoiceKey } from "@/lib/tts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    provider: await activeProvider(),
    elevenlabs: await appKeyStatus("ELEVENLABS_API_KEY"),
    voiceId:    await appKeyStatus("ELEVENLABS_VOICE_ID"),
    openai:     await appKeyStatus("OPENAI_API_KEY"),
    transcription: await appKeyStatus("TRANSCRIPTION_API_KEY"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { elevenKey, voiceId, openaiKey, clear } = await req.json();

    if (clear === "elevenlabs") {
      await clearAppKey("ELEVENLABS_API_KEY");
      await clearAppKey("ELEVENLABS_VOICE_ID");
      return NextResponse.json({ ok: true, provider: await activeProvider() });
    }

    // Prove the key works before storing it — otherwise a typo persists and
    // every cue silently falls back to the robot again.
    if (typeof openaiKey === "string" && openaiKey.trim()) {
      const check = await verifyVoiceKey({ openaiKey: openaiKey.trim() });
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      await setAppKey("OPENAI_API_KEY", openaiKey.trim());
      return NextResponse.json({ ok: true, provider: await activeProvider() });
    }

    if (typeof elevenKey === "string" && elevenKey.trim() &&
        typeof voiceId === "string" && voiceId.trim()) {
      const check = await verifyVoiceKey({ elevenKey: elevenKey.trim(), voiceId: voiceId.trim() });
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      await setAppKey("ELEVENLABS_API_KEY", elevenKey.trim());
      await setAppKey("ELEVENLABS_VOICE_ID", voiceId.trim());
      return NextResponse.json({ ok: true, provider: await activeProvider() });
    }

    return NextResponse.json({ error: "Paste a key first." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
