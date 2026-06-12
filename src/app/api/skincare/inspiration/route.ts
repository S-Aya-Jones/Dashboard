import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { inspirationBase64, inspirationMime, selfieBase64, selfieMime } = await req.json();
  if (!inspirationBase64) return NextResponse.json({ error: "No inspiration photo" }, { status: 400 });

  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: selfieBase64 ? [
      {
        type: "image",
        source: { type: "base64", media_type: selfieMime ?? "image/jpeg", data: selfieBase64 },
      },
      {
        type: "image",
        source: { type: "base64", media_type: inspirationMime ?? "image/jpeg", data: inspirationBase64 },
      },
      {
        type: "text",
        text: `The first image is Aya (the user). The second image is her inspiration/goal look.

Analyze both images and return ONLY a valid JSON object:
{
  "inspirationDescription": "<2-3 sentences: describe the inspiration person's key aesthetic — skin, hair, features, overall vibe>",
  "similarities": ["<genuine similarity between Aya and the inspiration>"],
  "gapAreas": [
    {
      "area": "<e.g. Skin tone evenness / Hair texture / Brow shape>",
      "current": "<honest description of Aya's current state for this area>",
      "goal": "<what the inspiration has that Aya is working toward>",
      "actionable": "<specific, realistic step to close this gap — product, treatment, or technique>"
    }
  ],
  "matchScore": <0-100, how close is Aya's current look to the inspiration — be honest, most will be 30-60>,
  "achievability": "<high/medium/low — how achievable is this look for Aya given her natural features>",
  "roadmap": "<3-4 sentence practical roadmap: what to focus on first, what takes time, what's realistic in 3 months vs 1 year>",
  "quickWins": ["<change that would make the biggest difference immediately>"]
}`,
      },
    ] : [
      {
        type: "image",
        source: { type: "base64", media_type: inspirationMime ?? "image/jpeg", data: inspirationBase64 },
      },
      {
        type: "text",
        text: `Analyze this inspiration/goal look photo and return ONLY a valid JSON object:
{
  "inspirationDescription": "<2-3 sentences: describe this person's key aesthetic — skin quality, hair, features, overall vibe>",
  "keyFeatures": ["<standout feature of this look>"],
  "skinNotes": "<skin quality, texture, tone, glow — what's notable>",
  "hairNotes": "<hair texture, health, style, color — what's notable>",
  "achievability": "<high/medium/low — how achievable is this look for most people>",
  "roadmap": "<3-4 sentence breakdown of what it would take to achieve this look — products, treatments, timeline>",
  "quickWins": ["<change that would make the biggest immediate difference toward this look>"]
}`,
      },
    ],
  }];

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1000,
      messages,
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
