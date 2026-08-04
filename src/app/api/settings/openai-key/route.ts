import { NextRequest, NextResponse } from "next/server";
import { setAppKey, clearAppKey, appKeyStatus } from "@/lib/appkeys";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await appKeyStatus("OPENAI_API_KEY"));
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (typeof key !== "string" || !key.startsWith("sk-")) {
      return NextResponse.json({ error: "That doesn't look like an OpenAI key — it should start with sk-" }, { status: 400 });
    }

    // Verify with OpenAI before storing so a bad paste fails here, not mid-lecture
    const check = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });
    if (!check.ok) {
      return NextResponse.json(
        { error: `OpenAI rejected that key (${check.status}). Check it was copied fully and has credit.` },
        { status: 400 },
      );
    }

    await setAppKey("OPENAI_API_KEY", key.trim());
    return NextResponse.json({ ok: true, ...(await appKeyStatus("OPENAI_API_KEY")) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAppKey("OPENAI_API_KEY");
  return NextResponse.json({ ok: true });
}
