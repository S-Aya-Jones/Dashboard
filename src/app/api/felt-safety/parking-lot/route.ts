import { NextRequest, NextResponse } from "next/server";
import { getParkingLotEntries, insertParkingLotEntry } from "@/lib/felt-safety-db";

export async function GET() {
  const entries = await getParkingLotEntries();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body  = await req.json();
  const entry = await insertParkingLotEntry(body.content);
  return NextResponse.json({ entry });
}
