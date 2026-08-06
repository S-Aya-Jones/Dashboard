import nodemailer from "nodemailer";

// Texts go out through the carrier's email-to-SMS gateway (already used by
// /api/sms/send). Gateways drop non-ASCII, so emoji are stripped first.

// eslint-disable-next-line no-control-regex
const stripEmojis = (t: string) => t.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();

const GATEWAYS: Record<string, string> = {
  tmobile: "tmomail.net",
  att: "txt.att.net",
  verizon: "vtext.com",
  sprint: "messaging.sprintpcs.com",
  googlefi: "msg.fi.google.com",
};

export async function sendSms(message: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return false;

  const phone = process.env.USER_PHONE_NUMBER ?? "6156811609";
  const carrier = (process.env.SMS_CARRIER ?? "tmobile").toLowerCase();
  const domain = GATEWAYS[carrier] ?? GATEWAYS.tmobile;
  const digits = phone.replace(/\D/g, "").replace(/^1/, "");

  // Carrier gateways truncate hard — keep it inside one or two segments
  const body = stripEmojis(message).slice(0, 300);

  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: user, to: `${digits}@${domain}`, subject: " ", text: body });
    return true;
  } catch {
    return false;
  }
}
