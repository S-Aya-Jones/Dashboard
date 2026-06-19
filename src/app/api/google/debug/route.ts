import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";

export async function GET() {
  const token = process.env.GOOGLE_REFRESH_TOKEN ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

  const info = {
    tokenPreview: token ? `${token.slice(0, 10)}...${token.slice(-6)}` : "NOT SET",
    clientIdPreview: clientId ? `${clientId.slice(0, 12)}...${clientId.slice(-8)}` : "NOT SET",
    clientSecretPreview: clientSecret ? `${clientSecret.slice(0, 10)}...${clientSecret.slice(-4)}` : "NOT SET",
  };

  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({ status: "ok", ...info });
  } catch (e: unknown) {
    return NextResponse.json({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      ...info,
    });
  }
}
