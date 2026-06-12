import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/google";

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "in:inbox";
  const maxResults = parseInt(searchParams.get("maxResults") ?? "30");
  const threadId = searchParams.get("threadId");

  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    if (threadId) {
      const thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
      return NextResponse.json(thread.data);
    }

    const list = await gmail.users.threads.list({ userId: "me", q, maxResults, labelIds: ["INBOX"] });
    const threads = list.data.threads ?? [];

    const summaries = await Promise.all(
      threads.map(async (t) => {
        const detail = await gmail.users.threads.get({ userId: "me", id: t.id!, format: "metadata", metadataHeaders: ["Subject", "From", "Date"] });
        const msg = detail.data.messages?.[0];
        const headers = msg?.payload?.headers ?? [];
        const get = (name: string) => headers.find(h => h.name === name)?.value ?? "";
        const unread = msg?.labelIds?.includes("UNREAD") ?? false;
        return {
          id: t.id,
          snippet: detail.data.snippet ?? "",
          subject: get("Subject") || "(no subject)",
          from: get("From"),
          date: get("Date"),
          unread,
          messageCount: detail.data.messages?.length ?? 1,
          labelIds: msg?.labelIds ?? [],
        };
      })
    );
    return NextResponse.json({ threads: summaries });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { threadIds } = await req.json();
  if (!threadIds?.length) return NextResponse.json({ error: "No threadIds" }, { status: 400 });

  try {
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    await Promise.all(threadIds.map((id: string) => gmail.users.threads.trash({ userId: "me", id })));
    return NextResponse.json({ success: true, deleted: threadIds.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
