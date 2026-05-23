import { NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { defaultDashboardData } from "@/types/dashboard";

export const dynamic = "force-dynamic";

// GET /api/data  — loads the dashboard data (falls back to in-memory default if no DB)
export async function GET() {
  try {
    const data = await loadData("aya");
    return NextResponse.json(data);
  } catch {
    // If DB is not configured yet, return default data so the UI still works
    return NextResponse.json(defaultDashboardData());
  }
}

// POST /api/data  — saves the entire dashboard data blob
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await saveData({ ...body, userId: "aya" });
    return NextResponse.json({ ok: true });
  } catch {
    // If DB not configured, silently succeed (data lives in client state)
    return NextResponse.json({ ok: true, warning: "DB not configured" });
  }
}
