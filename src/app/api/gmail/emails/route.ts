import { NextResponse } from "next/server";
import {
  getGmailTokens, getFreshGmailToken,
  fetchGmailMessages, upsertGmailEmails, getStoredEmails,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getGmailTokens();
  if (!stored) return NextResponse.json({ connected: false, emails: [] });

  try {
    const token = await getFreshGmailToken();
    if (token) {
      const live = await fetchGmailMessages(token, 30);
      await upsertGmailEmails(live);
    }
  } catch (err) {
    console.error("[gmail sync]", err);
  }

  const emails = await getStoredEmails(50);
  return NextResponse.json({
    connected: true,
    userEmail: stored.userEmail,
    userName:  stored.userName,
    emails,
  });
}
