import { NextRequest, NextResponse } from "next/server";

// GET /api/telegram/setup?domain=https://your-app.vercel.app
// Registers the webhook URL with Telegram so it starts forwarding messages
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 503 });

  const domain = req.nextUrl.searchParams.get("domain") ?? req.nextUrl.origin;
  const webhookUrl = `${domain}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
  );
  const data = await res.json();
  return NextResponse.json({ ok: data.ok, description: data.description, webhookUrl });
}
