import { NextRequest, NextResponse } from "next/server";
import { completeRepCard } from "@/lib/felt-safety-db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const completion = await completeRepCard(
    params.id, Number(body.beforeScore), Number(body.afterScore), body.note
  );
  return NextResponse.json({ completion });
}
