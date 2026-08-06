import { NextRequest, NextResponse } from "next/server";
import { setAppKey, clearAppKey, appKeyStatus } from "@/lib/appkeys";
import { verifySpoonacularKey } from "@/lib/recipes";

export const dynamic = "force-dynamic";

const NAME = "SPOONACULAR_API_KEY";

export async function GET() {
  return NextResponse.json(await appKeyStatus(NAME));
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    const trimmed = typeof key === "string" ? key.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "Paste your key first." }, { status: 400 });

    const check = await verifySpoonacularKey(trimmed);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    await setAppKey(NAME, trimmed);
    return NextResponse.json({ ok: true, ...(await appKeyStatus(NAME)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAppKey(NAME);
  return NextResponse.json({ ok: true });
}
