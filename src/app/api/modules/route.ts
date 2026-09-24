import { NextRequest, NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";

export const dynamic = "force-dynamic";

// Just the paused-sections list.
//
// Most pages render the sidebar through DashboardShell and can hand it the
// list they already loaded. A dozen older pages mount <Sidebar /> on their own,
// and without this they'd show the default set forever — so turning School back
// on would work on Today and silently not work on Lectures. One small endpoint
// is cheaper than rewriting twelve pages onto the shell.
//
// null means she has never touched the switches, which lib/modules.ts reads as
// "apply the defaults". An empty array means she turned everything on.

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ paused: null });
  try {
    const data = await loadData("aya");
    return NextResponse.json({ paused: data.pausedModules ?? null });
  } catch {
    // A sidebar is not worth failing a page over; fall back to the defaults.
    return NextResponse.json({ paused: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { paused } = await req.json();
    if (!Array.isArray(paused) || paused.some(p => typeof p !== "string")) {
      return NextResponse.json({ error: "paused must be an array of routes" }, { status: 400 });
    }
    const data = await loadData("aya");
    await saveData({ ...data, pausedModules: paused });
    return NextResponse.json({ ok: true, paused });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
