import { NextResponse } from "next/server";
import { getGmailTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokens = await getGmailTokens();
    if (!tokens) return NextResponse.json({ connected: false, reason: "no_tokens_in_db" });
    return NextResponse.json({
      connected: true,
      userEmail: tokens.userEmail,
      hasRefreshToken: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
      expired: tokens.expiresAt < new Date(),
    });
  } catch (err) {
    return NextResponse.json({ connected: false, reason: "db_error", error: String(err) });
  }
}
