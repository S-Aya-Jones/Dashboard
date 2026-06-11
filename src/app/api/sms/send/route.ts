import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// eslint-disable-next-line no-control-regex
function stripEmojis(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const phone = process.env.USER_PHONE_NUMBER ?? "6156811609";

  if (!user || !pass) return NextResponse.json({ error: "Gmail not configured" }, { status: 503 });

  const digits = phone.replace(/\D/g, "").replace(/^1/, "");
  const to = `${digits}@tmomail.net`;
  const cleanMessage = stripEmojis(message);

  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

  try {
    await transporter.sendMail({ from: user, to, subject: " ", text: cleanMessage });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
