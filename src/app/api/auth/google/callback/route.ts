import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, saveGmailTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const BASE = "https://dashboard-phi-six-70.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${BASE}/school-inbox?error=${error ?? "no_code"}`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.access_token) {
      return NextResponse.redirect(`${BASE}/school-inbox?error=token_failed`);
    }

    // Fetch user profile
    let userEmail: string | null = null;
    let userName:  string | null = null;
    try {
      const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then(r => r.json());
      userEmail = profile.email ?? null;
      userName  = profile.name  ?? null;
    } catch { /* non-fatal */ }

    await saveGmailTokens(
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in ?? 3600,
      userEmail,
      userName,
    );

    return NextResponse.redirect(`${BASE}/school-inbox?connected=1`);
  } catch (err) {
    console.error("[google callback]", err);
    return NextResponse.redirect(`${BASE}/school-inbox?error=server_error`);
  }
}
