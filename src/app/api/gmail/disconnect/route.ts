import { NextResponse } from "next/server";
import { clearGmailTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearGmailTokens();
  return NextResponse.json({ ok: true });
}
