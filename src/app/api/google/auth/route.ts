import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set" }, { status: 503 });
  }
  // Send the browser straight to Google's consent screen — no JSON detour
  return NextResponse.redirect(getAuthUrl());
}
