import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const TMOBILE_GATEWAY = "tmomail.net";

function getEmailGatewayAddress(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "").replace(/^1/, "");
  return `${digits}@${TMOBILE_GATEWAY}`;
}

async function sendViaEmail(message: string): Promise<{ success: boolean; error?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { success: false, error: "Gmail not configured" };

  const to = getEmailGatewayAddress(process.env.USER_PHONE_NUMBER ?? "6156811609");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: user,
      to,
      subject: "",
      text: message,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

async function sendViaTwilio(message: string, to: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) return { success: false, error: "Twilio not configured" };

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: to, From: from, Body: message });

  const res  = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message ?? "Twilio error" };
  return { success: true };
}

export async function POST(req: NextRequest) {
  const { message, to, forceMethod } = await req.json();
  if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  const phone = to ?? process.env.USER_PHONE_NUMBER ?? "6156811609";

  // Try email gateway first unless Twilio is forced
  if (forceMethod !== "twilio") {
    const emailResult = await sendViaEmail(message);
    if (emailResult.success) {
      return NextResponse.json({ success: true, method: "email-gateway" });
    }
    // Fall through to Twilio
  }

  const twilioResult = await sendViaTwilio(message, phone);
  if (twilioResult.success) return NextResponse.json({ success: true, method: "twilio" });

  return NextResponse.json({ error: twilioResult.error ?? "All methods failed" }, { status: 500 });
}
