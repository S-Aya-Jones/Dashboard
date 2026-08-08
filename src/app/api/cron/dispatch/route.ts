import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import { runDispatch } from "@/lib/spine";

export const dynamic = "force-dynamic";

// The single entry point for all scheduled notifications.
// Ping this every ~5 minutes (cron-job.org) — no auth, like urgent-check;
// the cron_runs table makes every send exactly-once per slot per day.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDispatch(req.nextUrl.origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
