import { NextRequest, NextResponse } from "next/server";
import {
  getGmailTokens, getFreshGmailToken,
  fetchGmailMessages, upsertGmailEmails, getStoredEmails, getStoredEmailCount,
  categorizeEmail, gmailTrash,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit  = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  const stored = await getGmailTokens();
  if (!stored) return NextResponse.json({ connected: false, emails: [], total: 0 });

  let syncError: string | null = null;
  let trashed = 0;
  try {
    const token = await getFreshGmailToken();
    if (token) {
      const live = await fetchGmailMessages(token, 50);
      const toStore = [];
      for (const email of live) {
        const cat = categorizeEmail(email);
        if (cat === "spam") {
          gmailTrash(token, email.id).catch(() => {}); // fire-and-forget, non-blocking
          trashed++;
        } else {
          toStore.push(email);
        }
      }
      await upsertGmailEmails(toStore);
    } else {
      syncError = "Could not refresh Gmail token — please reconnect.";
    }
  } catch (err) {
    console.error("[gmail sync]", err);
    syncError = err instanceof Error ? err.message : String(err);
  }

  const [emails, total] = await Promise.all([
    getStoredEmails(limit, offset),
    getStoredEmailCount(),
  ]);

  return NextResponse.json({
    connected: true,
    userEmail: stored.userEmail,
    userName:  stored.userName,
    emails,
    total,
    trashed,
    ...(syncError ? { syncError } : {}),
  });
}
