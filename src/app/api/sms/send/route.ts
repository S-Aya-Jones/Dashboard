import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, to } = await req.json();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }
  if (!to || !message) {
    return NextResponse.json({ error: "Missing to or message" }, { status: 400 });
  }

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: to, From: from, Body: message });

  try {
    const res  = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message ?? "Twilio error" }, { status: res.status });
    return NextResponse.json({ success: true, sid: data.sid });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
