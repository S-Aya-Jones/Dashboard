import { NextRequest, NextResponse } from "next/server";
import { insertTwitchLog, getTwitchLogs } from "@/lib/felt-safety-db";

export async function GET() {
  try {
    const logs = await getTwitchLogs();
    return NextResponse.json({ logs });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const log = await insertTwitchLog({
      id:          crypto.randomUUID(),
      triggerType: body.triggerType,
      intensity:   Number(body.intensity),
      acted:       Boolean(body.acted),
      note:        body.note || undefined,
    });
    return NextResponse.json({ log });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
