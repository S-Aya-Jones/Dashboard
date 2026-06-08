import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  const envCheck = {
    TWILIO_ACCOUNT_SID: accountSid ? `✓ set (${accountSid.slice(0, 6)}...)` : "✗ MISSING",
    TWILIO_AUTH_TOKEN:  authToken  ? `✓ set (${authToken.slice(0, 4)}...)` : "✗ MISSING",
    TWILIO_PHONE_NUMBER: from      ? `✓ set (${from})` : "✗ MISSING",
  };

  if (!to) {
    return NextResponse.json({ envCheck, note: "Add ?to=+1XXXXXXXXXX to also test sending" });
  }

  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ envCheck, error: "Missing env vars — cannot send" }, { status: 503 });
  }

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: to, From: from, Body: "Test from Aya's Dashboard! If you got this, SMS is working." });

  try {
    const res  = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    return NextResponse.json({ envCheck, twilioStatus: res.status, twilioResponse: data });
  } catch (e) {
    return NextResponse.json({ envCheck, fetchError: String(e) }, { status: 500 });
  }
}
