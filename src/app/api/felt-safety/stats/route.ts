import { NextResponse } from "next/server";
import { getFeltSafetyStats } from "@/lib/felt-safety-db";

export async function GET() {
  const stats = await getFeltSafetyStats();
  return NextResponse.json(stats);
}
