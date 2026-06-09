import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";

export async function GET() {
  const token = process.env.GOOGLE_REFRESH_TOKEN ?? "";
  const preview = token ? `${token.slice(0, 10)}...${token.slice(-6)}` : "NOT SET";

  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({ status: "ok", tokenPreview: preview });
  } catch (e: unknown) {
    return NextResponse.json({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      tokenPreview: preview,
    });
  }
}
