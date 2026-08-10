import { NextResponse } from "next/server";
import {
  getFreshAccessToken, getStoredTokens,
  fetchEmails, upsertEmails, getStoredEmails,
} from "@/lib/microsoft";

export const dynamic = "force-dynamic";

export async function GET() {
  const stored = await getStoredTokens();
  if (!stored) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  // A sync that fails silently is why school mail could stop arriving without
  // anything on screen changing. Cached mail is still served, but the failure
  // is reported alongside it.
  let syncError: string | null = null;
  try {
    const token = await getFreshAccessToken();
    if (!token) throw new Error("Outlook sign-in has expired — reconnect the school account.");
    const live = await fetchEmails(token, 30);
    await upsertEmails(live);
  } catch (e) {
    syncError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  const emails = await getStoredEmails(50);
  return NextResponse.json({
    connected: true,
    syncError,
    userEmail: stored.userEmail,
    userName:  stored.userName,
    emails,
  });
}
