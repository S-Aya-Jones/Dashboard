import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;

    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#e0e0ff">
        <h2 style="color:#7C5CFC">Google Auth Complete!</h2>
        <p>Copy this refresh token and add it to Vercel as <b>GOOGLE_REFRESH_TOKEN</b>:</p>
        <div style="background:#0d0d1a;padding:16px;border-radius:8px;border:1px solid #7C5CFC;word-break:break-all;margin:16px 0">
          ${refreshToken ?? "No refresh token returned — try re-authorizing"}
        </div>
        <p style="color:#999">Once added to Vercel env vars and redeployed, close this tab and refresh your dashboard.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
