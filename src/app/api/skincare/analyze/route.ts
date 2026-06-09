import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, products, checkIns } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const routineContext = products?.length
    ? `Current skincare routine:\n${products.map((p: { name: string; brand?: string; routine: string; isTesting?: boolean }) =>
        `- ${p.name}${p.brand ? ` (${p.brand})` : ""} — ${p.routine}${p.isTesting ? " [testing]" : ""}`
      ).join("\n")}`
    : "No skincare routine logged yet.";

  const checkInContext = checkIns?.length
    ? `Recent skin check-ins:\n${checkIns.slice(-5).map((c: { date: string; observations: string; breakouts?: boolean }) =>
        `- ${c.date}: ${c.observations}${c.breakouts ? " (breakout)" : ""}`
      ).join("\n")}`
    : "No check-in history yet.";

  const prompt = `You are a professional aesthetic and skincare analyst. Analyze this photo and provide a structured beauty assessment. Be specific, honest, and constructive — like a knowledgeable dermatologist friend.

${routineContext}

${checkInContext}

Return your analysis as a JSON object with exactly this structure:
{
  "skinScore": <number 0-100>,
  "skinAssessment": {
    "summary": "<2-3 sentence overview of current skin condition>",
    "texture": "<assessment of skin texture>",
    "hydration": "<hydration level assessment>",
    "concerns": ["<concern 1>", "<concern 2>", ...],
    "strengths": ["<strength 1>", "<strength 2>", ...]
  },
  "featureAnalysis": {
    "summary": "<2-3 sentence overview of facial features>",
    "harmony": "<facial harmony and proportion notes>",
    "standouts": ["<notable feature 1>", "<notable feature 2>", ...],
    "areas": ["<area to enhance 1>", "<area to enhance 2>", ...]
  },
  "protocol": {
    "immediate": ["<action to take now 1>", "<action 2>", ...],
    "routineAdjustments": ["<routine change 1>", "<routine change 2>", ...],
    "lifestyle": ["<lifestyle tip 1>", "<lifestyle tip 2>", ...],
    "treatments": ["<professional treatment to consider 1>", ...]
  }
}

Return only the JSON, no other text.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType ?? "image/jpeg", data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (!analysis) throw new Error("No valid analysis returned");

    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
