import { NextResponse } from "next/server";
import {
  getGmailTokens, getFreshGmailToken,
  fetchGmailMessages, upsertGmailEmails, getStoredEmails,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getGmailTokens();
  if (!stored) return NextResponse.json({ connected: false, emails: [] });

  let syncError: string | null = null;
  try {
    const token = await getFreshGmailToken();
    if (token) {
      const live = await fetchGmailMessages(token, 30);
      await upsertGmailEmails(live);
    } else {
      syncError = "Could not refresh Gmail token — please reconnect.";
    }
  } catch (err) {
    console.error("[gmail sync]", err);
    syncError = err instanceof Error ? err.message : String(err);
  }

  const emails = await getStoredEmails(50);
  return NextResponse.json({
    connected: true,
    userEmail: stored.userEmail,
    userName:  stored.userName,
    emails,
    ...(syncError ? { syncError } : {}),
  });
}
