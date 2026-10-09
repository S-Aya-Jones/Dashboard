import { NextRequest, NextResponse } from "next/server";
import { getFreshGmailToken, gmailReply, gmailMarkRead } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { messageId, threadId, to, subject, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const token = await getFreshGmailToken();
  if (!token) return NextResponse.json({ error: "not connected" }, { status: 401 });

  const ok = await gmailReply(token, threadId, to, subject, body);
  if (ok) await gmailMarkRead(token, messageId).catch(() => {});
  return NextResponse.json({ ok });
}
