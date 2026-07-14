import { NextRequest, NextResponse } from "next/server";
import { getMantras, insertMantra } from "@/lib/felt-safety-db";

export async function GET(req: NextRequest) {
  const faithMode = req.nextUrl.searchParams.get("faith");
  const mantras   = await getMantras(faithMode === null ? undefined : faithMode === "true");
  return NextResponse.json({ mantras });
}

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const mantra = await insertMantra(body.text, Boolean(body.faithFlag));
  return NextResponse.json({ mantra });
}
