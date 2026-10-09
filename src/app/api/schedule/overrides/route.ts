import { NextRequest, NextResponse } from "next/server";
import { addOverrides, overridesBetween, deleteOverride, NewOverride } from "@/lib/scheduleOverrides";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const to = req.nextUrl.searchParams.get("to") ?? "2100-01-01";
    return NextResponse.json({ overrides: await overridesBetween(from, to) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: NewOverride[] = Array.isArray(body) ? body : body.changes ?? [body];
    if (!items.length) return NextResponse.json({ error: "nothing to add" }, { status: 400 });
    return NextResponse.json({ ok: true, overrides: await addOverrides(items) });
  } catch (e) {
    // Validation failures are the user's to fix, so they read as 400 with the
    // reason rather than a server error.
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteOverride(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
