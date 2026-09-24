import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/microsoft";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "MICROSOFT_CLIENT_ID not configured" }, { status: 500 });
  }
}
