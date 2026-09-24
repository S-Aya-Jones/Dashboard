import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.redirect(getGoogleAuthUrl());
  } catch {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
  }
}
