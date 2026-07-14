import { NextRequest, NextResponse } from "next/server";
import { rateRepCard } from "@/lib/felt-safety-db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  await rateRepCard(params.id, Number(body.rating));
  return NextResponse.json({ ok: true });
}
