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

  try {
    const token = await getFreshAccessToken();
    if (token) {
      const live = await fetchEmails(token, 30);
      await upsertEmails(live);
    }
  } catch { /* fall through to cached */ }

  const emails = await getStoredEmails(50);
  return NextResponse.json({
    connected: true,
    userEmail: stored.userEmail,
    userName:  stored.userName,
    emails,
  });
}
