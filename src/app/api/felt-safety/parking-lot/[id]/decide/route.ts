import { NextRequest, NextResponse } from "next/server";
import { decideParkingLotEntry } from "@/lib/felt-safety-db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body  = await req.json();
  const entry = await decideParkingLotEntry(params.id, body.decision);
  return NextResponse.json({ entry });
}
