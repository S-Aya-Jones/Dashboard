import { NextResponse } from "next/server";
import { getGmailTokens, getFreshGmailToken } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Whether Google is actually connected, and if not, why — in words that name
// the fix rather than the symptom.
//
// "Your email keeps disconnecting" had no answer inside the app before this:
// a failed token refresh returned a bare null and everything downstream just
// rendered as not-connected. The reason is now recorded when it happens and
// translated here.

interface Diagnosis {
  reason: string;
  detail: string;
  fix: string;
  /** True when reconnecting alone won't hold — something has to change first. */
  recurring: boolean;
}

function diagnose(code: string | null): Diagnosis | null {
  if (!code) return null;

  // The one that produces a weekly disconnect. Google expires refresh tokens
  // after 7 days for OAuth clients whose consent screen is still in Testing,
  // so reconnecting works and then stops working a week later, forever.
  if (code === "invalid_grant") {
    return {
      reason: "Google revoked the connection",
      detail:
        "This is what a 7-day expiry looks like. Google expires refresh tokens after a week for apps whose OAuth consent screen is still in Testing mode — so reconnecting works, then drops again the following week.",
      fix:
        "In Google Cloud Console → APIs & Services → OAuth consent screen, set Publishing status to 'In production'. Then reconnect once and it stops expiring. Changing your Google password or removing the app under myaccount.google.com/permissions also revokes it.",
      recurring: true,
    };
  }

  if (code === "no_refresh_token") {
    return {
      reason: "Connected without a refresh token",
      detail: "Google only issues one on the first approval, so a re-approval that skipped the consent screen leaves no way to renew.",
      fix: "Reconnect below — the link forces the consent screen, which is what makes Google hand back a refresh token.",
      recurring: false,
    };
  }

  if (code === "invalid_client" || code === "unauthorized_client") {
    return {
      reason: "The app's Google credentials are wrong",
      detail: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET doesn't match the OAuth client, or the client was deleted.",
      fix: "Check both values in Vercel against Google Cloud Console → Credentials, then redeploy.",
      recurring: true,
    };
  }

  if (code.startsWith("http_")) {
    return {
      reason: "Google couldn't be reached",
      detail: `Google's token endpoint returned ${code.replace("http_", "")}. Usually temporary.`,
      fix: "Try again in a few minutes. If it persists, reconnect below.",
      recurring: false,
    };
  }

  return {
    reason: "The connection failed to renew",
    detail: `Google returned "${code}".`,
    fix: "Reconnect below.",
    recurring: false,
  };
}

export async function GET() {
  try {
    const stored = await getGmailTokens();
    if (!stored) {
      return NextResponse.json({ connected: false, everConnected: false, diagnosis: null });
    }

    // Actually exercise it rather than trusting the stored expiry — the whole
    // point is to know now, not to find out when something silently returns
    // nothing.
    const token = await getFreshGmailToken();
    const after = await getGmailTokens();

    return NextResponse.json({
      connected: Boolean(token),
      everConnected: true,
      email: stored.userEmail,
      name: stored.userName,
      expiresAt: stored.expiresAt.toISOString(),
      lastErrorAt: after?.lastErrorAt ?? null,
      diagnosis: token ? null : diagnose(after?.lastError ?? null),
    });
  } catch (e) {
    return NextResponse.json(
      { connected: false, everConnected: true, error: String(e).slice(0, 200) },
      { status: 200 },
    );
  }
}
