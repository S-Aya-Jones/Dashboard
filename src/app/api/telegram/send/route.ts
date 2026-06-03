import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, chatId } = await req.json();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 503 });
  if (!chatId || !message) return NextResponse.json({ error: "Missing chatId or message" }, { status: 400 });

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 });
    return NextResponse.json({ success: true, messageId: data.result?.message_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
