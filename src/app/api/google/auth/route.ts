import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set" }, { status: 503 });
  }
  const url = getAuthUrl();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/google/auth/callback` : null)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/google/auth/callback` : null)
    ?? "fallback";
  return NextResponse.json({ url, redirectUri });
}
