import nodemailer from "nodemailer";
import { getAppKey } from "@/lib/appkeys";

// Two ways to put a text on her phone, tried in order.
//
// Twilio is the good one: real delivery receipts, no carrier throttling, and
// it doesn't depend on a mailbox. It needs an approved A2P 10DLC campaign
// before US carriers will accept traffic — see /sms-opt-in, which is the
// consent page that registration is judged on.
//
// The carrier email-to-SMS gateway is the fallback and needs no registration
// at all: the message is an email addressed to <number>@<carrier gateway> and
// the carrier turns it into a text. Less reliable, but it works today.
//
// Either way Telegram always gets the message first — that copy is the record.

// eslint-disable-next-line no-control-regex
const stripEmojis = (t: string) => t.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();

export const CARRIERS: Record<string, string> = {
  tmobile:  "tmomail.net",
  att:      "txt.att.net",
  verizon:  "vtext.com",
  sprint:   "messaging.sprintpcs.com",
  googlefi: "msg.fi.google.com",
  uscellular: "email.uscc.net",
  boost:    "sms.myboostmobile.com",
  cricket:  "sms.cricketwireless.net",
  metro:    "mymetropcs.com",
};

async function setting(name: string, fallback = ""): Promise<string> {
  return (await getAppKey(name)) ?? fallback;
}

/** Everything the settings screen needs, with no secrets in it. */
export async function smsStatus() {
  const phone   = await setting("USER_PHONE_NUMBER");
  const carrier = (await setting("SMS_CARRIER", "tmobile")).toLowerCase();
  const enabled = (await setting("SMS_ALSO")) === "1";
  const mailReady = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const twilio = await twilioConfigured();
  return {
    enabled,
    carrier,
    mailReady,
    twilio,
    provider: twilio ? "twilio" : mailReady ? "carrier" : null,
    // Last four only — enough to confirm it's the right phone.
    phoneHint: phone ? `•••-•••-${phone.slice(-4)}` : null,
    ready: enabled && (twilio || mailReady) && Boolean(phone),
  };
}

/** True when the daily notifications should also go out as a text. */
export async function smsAlsoEnabled(): Promise<boolean> {
  if (process.env.SMS_ALSO === "1") return true;
  return (await getAppKey("SMS_ALSO")) === "1";
}

async function sendViaTwilio(body: string, to: string): Promise<boolean> {
  const sid   = await setting("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID ?? "");
  const token = await setting("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN ?? "");
  const from  = await setting("TWILIO_PHONE_NUMBER", process.env.TWILIO_PHONE_NUMBER ?? "");
  if (!sid || !token || !from) return false;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
      body: new URLSearchParams({ To: `+1${to}`, From: from, Body: body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function twilioConfigured(): Promise<boolean> {
  return Boolean(
    (await setting("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID ?? "")) &&
    (await setting("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN ?? "")) &&
    (await setting("TWILIO_PHONE_NUMBER", process.env.TWILIO_PHONE_NUMBER ?? ""))
  );
}

/** Check the credentials before storing them so a bad paste can't persist. */
export async function verifyTwilio(sid: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, error: "Twilio rejected that SID or auth token." };
    if (res.status === 404) return { ok: false, error: "No Twilio account with that SID." };
    if (!res.ok) return { ok: false, error: `Twilio replied ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Twilio to check the credentials." };
  }
}

export async function sendSms(message: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  const phone   = await setting("USER_PHONE_NUMBER", process.env.USER_PHONE_NUMBER ?? "");
  const carrier = (await setting("SMS_CARRIER", process.env.SMS_CARRIER ?? "tmobile")).toLowerCase();
  const domain  = CARRIERS[carrier] ?? CARRIERS.tmobile;
  const digits  = phone.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length !== 10) return false;

  // Twilio first when it's set up; it's the one that actually reports back.
  // It segments long messages and handles unicode, so it gets the real text —
  // the stripping below is a carrier-gateway limitation, not a general one.
  if (await sendViaTwilio(message.replace(/<[^>]+>/g, "").slice(0, 1200), digits)) return true;

  if (!user || !pass) return false;

  // Carrier gateways truncate hard and drop non-ASCII.
  const body = stripEmojis(message).slice(0, 300);

  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: user, to: `${digits}@${domain}`, subject: " ", text: body });
    return true;
  } catch {
    return false;
  }
}
