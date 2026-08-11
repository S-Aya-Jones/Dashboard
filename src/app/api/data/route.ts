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
// A tab that has been open a while holds a whole copy of her data in memory,
// and every save writes the whole blob. So a stale tab doesn't lose one edit —
// it silently reverts everything changed elsewhere since it loaded. That is how
// a routine written from another device disappears without any error.
//
// The client sends the updatedAt it loaded. If the stored one has moved on, the
// write is refused and the client is told to reload rather than overwrite.
export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, warning: "DB not configured" });
  }
  try {
    const body = await req.json();

    if (typeof body.baseUpdatedAt === "string") {
      const current = await loadData("aya");
      if (current.updatedAt && current.updatedAt !== body.baseUpdatedAt) {
        return NextResponse.json(
          {
            ok: false,
            error: "stale",
            serverUpdatedAt: current.updatedAt,
            detail: "This page is out of date — something changed elsewhere. Reload before saving.",
          },
          { status: 409 },
        );
      }
    }

    // baseUpdatedAt is a transport concern; it must not be stored.
    const payload = { ...body };
    delete payload.baseUpdatedAt;
    await saveData({ ...payload, userId: "aya" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "save-failed", detail: raw.slice(0, 300) },
      { status: 503 }
    );
  }
}
