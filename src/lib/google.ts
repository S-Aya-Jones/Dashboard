import { google } from "googleapis";

function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/google/auth/callback`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/google/auth/callback`;
  return "https://dashboard-n0nofpa5t-aya-jones-projects.vercel.app/api/google/auth/callback";
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export async function getAuthedClient() {
  const oauth2 = getOAuth2Client();
  // Prefer the refresh token stored by the in-app Google connect flow
  // (gmail_tokens table — refreshed whenever she reconnects from the
  // dashboard); the GOOGLE_REFRESH_TOKEN env var is the fallback.
  let dbToken: string | null = null;
  try {
    const { getGmailTokens } = await import("@/lib/gmail");
    dbToken = (await getGmailTokens())?.refreshToken ?? null;
  } catch { /* table unavailable — fall back to env */ }
  oauth2.setCredentials({
    refresh_token: dbToken ?? process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2;
}

export function getAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],
    prompt: "consent",
  });
}
