import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

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
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });

    // Which account's calendars does this token actually see?
    let calendars: Array<{ name: string; primary: boolean }> = [];
    let calendarError: string | null = null;
    try {
      const cal = google.calendar({ version: "v3", auth });
      const list = await cal.calendarList.list();
      calendars = (list.data.items ?? []).map(c => ({
        name: c.summary ?? "(unnamed)",
        primary: !!c.primary,
      }));
    } catch (ce) {
      calendarError = ce instanceof Error ? ce.message : String(ce);
    }

    return NextResponse.json({
      status: "ok",
      connectedAccount: profile.data.emailAddress ?? "(unknown)",
      calendars,
      calendarError,
      ...info,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      ...info,
    });
  }
}
