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

  const prompt = `You are a professional aesthetic analyst, dermatologist, and hair stylist combined. Analyze this photo thoroughly and return a complete beauty assessment. Be specific, honest, encouraging, and constructive.

${routineContext}
${checkInContext}

Return ONLY a JSON object with exactly this structure:

{
  "skinScore": <number 0-100>,
  "overallRating": <number 1-10 with one decimal, e.g. 7.4>,
  "apparentAge": {
    "estimated": <number — the age this person appears>,
    "note": "<brief note on what's aging or youthening their appearance>"
  },
  "skinAssessment": {
    "summary": "<2-3 sentence overview>",
    "texture": "<texture assessment>",
    "hydration": "<hydration level>",
    "concerns": ["<concern>", ...],
    "strengths": ["<strength>", ...]
  },
  "featureAnalysis": {
    "summary": "<2-3 sentence overview of facial features>",
    "faceShape": "<oval/round/square/heart/diamond/oblong>",
    "harmony": "<harmony and proportion notes>",
    "standouts": ["<notable feature>", ...],
    "areas": ["<area that could be enhanced>", ...]
  },
  "hairstyleAnalysis": {
    "currentStyle": "<description of current hairstyle — length, texture, shape, color>",
    "suitsFaceShape": <true or false>,
    "suitabilityNote": "<why or why not the current style works for their face shape>",
    "recommendedStyles": [
      { "name": "<hairstyle name>", "why": "<why it would suit them>" },
      { "name": "<hairstyle name>", "why": "<why it would suit them>" },
      { "name": "<hairstyle name>", "why": "<why it would suit them>" }
    ],
    "colorRecommendations": ["<color recommendation>", ...],
    "stylingTips": ["<tip>", ...],
    "avoid": ["<style or technique to avoid and why>", ...]
  },
  "protocol": {
    "immediate": ["<action>", ...],
    "routineAdjustments": ["<routine change>", ...],
    "lifestyle": ["<lifestyle tip>", ...],
    "treatments": ["<professional treatment>", ...]
  }
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
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
