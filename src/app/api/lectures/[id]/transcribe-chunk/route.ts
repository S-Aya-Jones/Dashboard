import { NextRequest, NextResponse } from "next/server";
import { saveChunkText } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Receives one ~5-minute audio chunk (base64, ≤ ~2MB) and transcribes it
// via OpenAI Whisper. Chunks exist because Vercel caps request bodies at
// 4.5MB and Whisper caps files at 25MB.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set — add it in Vercel → Settings → Environment Variables (used for Whisper transcription)" },
      { status: 400 },
    );
  }

  try {
    const { index, audioBase64 } = await req.json();
    if (index === undefined || !audioBase64) {
      return NextResponse.json({ error: "index and audioBase64 required" }, { status: 400 });
    }

    const buf = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/mpeg" }), `chunk${index}.mp3`);
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Whisper ${res.status}: ${detail.slice(0, 300)}` }, { status: 502 });
    }

    const text = await res.text();
    await saveChunkText(params.id, Number(index), text.trim());
    return NextResponse.json({ ok: true, index: Number(index), chars: text.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
