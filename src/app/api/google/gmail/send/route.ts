import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { threadId, to, subject, body } = await req.json();

  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const message = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n");
    const encoded = Buffer.from(message).toString("base64url");

    await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded, threadId } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
