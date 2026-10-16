import { NextResponse } from "next/server";
import { getRecentInboundLogs } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await getRecentInboundLogs(50);
  return NextResponse.json(logs);
}
