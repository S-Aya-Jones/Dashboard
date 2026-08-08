import { NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { defaultDashboardData } from "@/types/dashboard";

export const dynamic = "force-dynamic";

// GET /api/data
//
// This used to catch every failure and return defaultDashboardData(), which
// meant an unreachable database looked exactly like an empty account. Worse:
// the client accepted those defaults as real, enabled autosave, and would
// have written blank data over her actual records the moment the connection
// came back. A 200 here has to mean "this is her data".
//
// Only a genuinely unconfigured database still returns defaults — that's a
// first-run convenience, not an outage.
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(defaultDashboardData());
  }
  try {
    const data = await loadData("aya");
    return NextResponse.json(data);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "database-unreachable",
        overQuota: raw.includes("402") || raw.toLowerCase().includes("quota"),
        detail: raw.slice(0, 300),
      },
      { status: 503 }
    );
  }
}

// POST /api/data
//
// Reporting ok on a failed write is how you lose data quietly — the client
// believes it saved and moves on. A failed save has to say so.
export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, warning: "DB not configured" });
  }
  try {
    const body = await req.json();
    await saveData({ ...body, userId: "aya" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "save-failed", detail: raw.slice(0, 300) },
      { status: 503 }
    );
  }
}
