import { NextResponse } from "next/server";
import { getFeltSafetyStats } from "@/lib/felt-safety-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getFeltSafetyStats();
  return NextResponse.json(stats);
}
