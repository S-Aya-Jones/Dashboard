import { NextRequest, NextResponse } from "next/server";
import { toggleReminder, deleteReminder } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  await toggleReminder(id, body.active);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteReminder(id);
  return NextResponse.json({ ok: true });
}
