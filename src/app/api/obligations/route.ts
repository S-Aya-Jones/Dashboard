import { NextRequest, NextResponse } from "next/server";
import {
  listObligations, upsertObligation, completeObligation, deleteObligation,
} from "@/lib/obligations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "1";
    return NextResponse.json({ obligations: await listObligations(all) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Anything with a date: hair every 7 weeks, a product cycle, an appointment.
// Tell it once and the engine handles every reminder from then on.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (b.action === "complete") {
      await completeObligation(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "delete") {
      await deleteObligation(b.id);
      return NextResponse.json({ ok: true });
    }
    if (!b.title || !b.dueAt) {
      return NextResponse.json({ error: "title and dueAt required" }, { status: 400 });
    }
    await upsertObligation({
      source: b.source ?? "life",
      kind: b.kind ?? "appointment",
      title: b.title,
      detail: b.detail ?? "",
      dueAt: new Date(b.dueAt).toISOString(),
      leadDays: Array.isArray(b.leadDays) && b.leadDays.length ? b.leadDays : [7, 3, 1, 0],
      repeatDays: b.repeatDays ? Number(b.repeatDays) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
