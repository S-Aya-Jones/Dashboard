import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveTokens, fetchUserProfile } from "@/lib/microsoft";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `https://dashboard-phi-six-70.vercel.app/school-inbox?error=${error ?? "no_code"}`,
    );
  }

  try {
    const tokens = await exchangeCode(code);
    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(
        `https://dashboard-phi-six-70.vercel.app/school-inbox?error=${tokens.error ?? "token_exchange_failed"}`,
      );
    }

    // Fetch user profile to store email/name
    let userEmail: string | null = null;
    let userName:  string | null = null;
    try {
      const profile = await fetchUserProfile(tokens.access_token);
      userEmail = profile.mail ?? null;
      userName  = profile.displayName ?? null;
    } catch { /* non-fatal */ }

    await saveTokens(
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in,
      userEmail,
      userName,
    );

    return NextResponse.redirect("https://dashboard-phi-six-70.vercel.app/school-inbox?connected=1");
  } catch (err) {
    console.error("[microsoft callback]", err);
    return NextResponse.redirect(
      `https://dashboard-phi-six-70.vercel.app/school-inbox?error=server_error`,
    );
  }
}
