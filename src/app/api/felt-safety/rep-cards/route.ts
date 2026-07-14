import { NextRequest, NextResponse } from "next/server";
import { getRepCards, insertRepCard } from "@/lib/felt-safety-db";

export async function GET() {
  const cards = await getRepCards();
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const card = await insertRepCard({
    id: crypto.randomUUID(),
    title: body.title, instruction: body.instruction,
    tier: body.tier ?? 1, category: body.category ?? "general",
    custom: true, active: true,
  });
  return NextResponse.json({ card });
}
