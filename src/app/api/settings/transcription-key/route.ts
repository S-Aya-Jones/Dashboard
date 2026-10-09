import { NextRequest, NextResponse } from "next/server";
import { setAppKey, clearAppKey, appKeyStatus, getAppKey } from "@/lib/appkeys";
import { verifyKey, detectProvider } from "@/lib/transcribe";

export const dynamic = "force-dynamic";

const NAME = "TRANSCRIPTION_API_KEY";

export async function GET(req: NextRequest) {
  const status = await appKeyStatus(NAME);
  const key = await getAppKey(NAME);

  // A stored key is not a working key — it can be rotated or revoked at the
  // provider long after it was saved. Callers that are about to rely on it ask
  // for ?verify=1 so the UI reports what the provider actually says.
  let valid: boolean | null = null;
  if (key && req.nextUrl.searchParams.get("verify")) {
    valid = (await verifyKey(key)).ok;
  }

  return NextResponse.json({
    ...status,
    provider: key ? detectProvider(key) : null,
    valid,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    const trimmed = typeof key === "string" ? key.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "Paste your key first." }, { status: 400 });
    }

    const check = await verifyKey(trimmed);
    if (!check.ok) {
      return NextResponse.json({ error: check.error ?? "That key was rejected." }, { status: 400 });
    }

    await setAppKey(NAME, trimmed);
    return NextResponse.json({ ok: true, provider: check.provider, ...(await appKeyStatus(NAME)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAppKey(NAME);
  return NextResponse.json({ ok: true });
}
