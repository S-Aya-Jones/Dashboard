import { NextRequest, NextResponse } from "next/server";
import { getCheckins, insertCheckin } from "@/lib/felt-safety-db";

export async function GET() {
  const checkins = await getCheckins();
  return NextResponse.json({ checkins });
}

export async function POST(req: NextRequest) {
  const body    = await req.json();
  const checkin = await insertCheckin(body.answer, body.dayRating);
  return NextResponse.json({ checkin });
}
