import { NextRequest, NextResponse } from "next/server";
import { saveChunkText } from "@/lib/lectures";
import { getAppKey } from "@/lib/appkeys";
import { transcribeAudio } from "@/lib/transcribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Receives one ~5-minute audio chunk (base64, ≤ ~2MB) and transcribes it.
// Chunks exist because Vercel caps request bodies at 4.5MB.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const key =
    (await getAppKey("TRANSCRIPTION_API_KEY")) ?? (await getAppKey("OPENAI_API_KEY"));
  if (!key) {
    return NextResponse.json({ error: "NO_TRANSCRIPTION_KEY" }, { status: 400 });
  }

  try {
    const { index, audioBase64 } = await req.json();
    if (index === undefined || !audioBase64) {
      return NextResponse.json({ error: "index and audioBase64 required" }, { status: 400 });
    }

    const buf = Buffer.from(audioBase64, "base64");
    const text = await transcribeAudio(key, buf, `chunk${index}.mp3`);

    await saveChunkText(params.id, Number(index), text);
    return NextResponse.json({ ok: true, index: Number(index), chars: text.length });
  } catch (e) {
    const raw = String(e);
    // A revoked or rotated key is the common failure here, and the provider's
    // reply is a wall of JSON with the key echoed back into it. Say the one
    // thing she can act on instead.
    if (/\b401\b|invalid_api_key|Incorrect API key/i.test(raw)) {
      return NextResponse.json(
        { error: "Your transcription key was rejected — it's been rotated or revoked. Paste a current key in Settings, then upload the recording again." },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: raw.slice(0, 400) }, { status: 502 });
  }
}
