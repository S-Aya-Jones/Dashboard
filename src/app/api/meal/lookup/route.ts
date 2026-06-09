import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { name, amount } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "No ingredient name" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Give me the nutritional info for: "${amount ? `${amount} of ` : ""}${name}"

Estimate on the HIGH END. Return ONLY a JSON object, no other text:
{"name":"<food name>","amount":"<portion>","grams":<number>,"calories":<number>,"protein":<number>,"carbs":<number>,"fat":<number>,"fiber":<number>}`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) throw new Error("No data returned");

    const ingredient = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ingredient });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
