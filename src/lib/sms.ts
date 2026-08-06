import nodemailer from "nodemailer";
import { getAppKey } from "@/lib/appkeys";

// Texts go out through the carrier's email-to-SMS gateway. There is no
// Twilio account to register and no A2P campaign to get approved — the
// message is an email addressed to <number>@<carrier gateway>, and the
// carrier turns it into a text.
//
// Number, carrier and the on/off switch are stored in app_keys so they can be
// changed from the app. The Gmail credentials stay in Vercel env, because a
// mailbox password does not belong in a settings form.

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
  return {
    enabled,
    carrier,
    mailReady,
    // Last four only — enough to confirm it's the right phone.
    phoneHint: phone ? `•••-•••-${phone.slice(-4)}` : null,
    ready: enabled && mailReady && Boolean(phone),
  };
}

/** True when the daily notifications should also go out as a text. */
export async function smsAlsoEnabled(): Promise<boolean> {
  if (process.env.SMS_ALSO === "1") return true;
  return (await getAppKey("SMS_ALSO")) === "1";
}

export async function sendSms(message: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return false;

  const phone   = await setting("USER_PHONE_NUMBER", process.env.USER_PHONE_NUMBER ?? "");
  const carrier = (await setting("SMS_CARRIER", process.env.SMS_CARRIER ?? "tmobile")).toLowerCase();
  const domain  = CARRIERS[carrier] ?? CARRIERS.tmobile;
  const digits  = phone.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length !== 10) return false;

  // Carrier gateways truncate hard — keep it inside one or two segments.
  const body = stripEmojis(message).slice(0, 300);

  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: user, to: `${digits}@${domain}`, subject: " ", text: body });
    return true;
  } catch {
    return false;
  }
}
