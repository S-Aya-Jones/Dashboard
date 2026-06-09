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

  const prompt = `You are a brutally honest aesthetic analyst, dermatologist, and hair stylist. Your job is to give real, unfiltered feedback — not flattery. The person asking WANTS honest truth so they can actually improve. Do not sugarcoat. Do not say "beautiful" unless it's genuinely true. Call out real problems directly. Be specific about what's holding them back and what their realistic potential is if they put in the work.

${routineContext}
${checkInContext}

Return ONLY a JSON object with exactly this structure:

{
  "skinScore": <number 0-100, be honest — average skin is 50-65>,
  "overallRating": <number 1-10 with one decimal — be calibrated: most people are 4-7, reserve 8+ for genuinely above average>,
  "apparentAge": {
    "estimated": <number — the age this person appears based on skin, features, and hair>,
    "note": "<be specific: what exact features are aging or youthening them>"
  },
  "skinAssessment": {
    "summary": "<honest 2-3 sentence overview — name the actual problems visible>",
    "texture": "<specific texture assessment — mention unevenness, pores, roughness if present>",
    "hydration": "<honest hydration assessment>",
    "concerns": ["<real concern>", ...],
    "strengths": ["<genuine strength only>", ...]
  },
  "featureAnalysis": {
    "summary": "<honest 2-3 sentences — what's working and what isn't, be direct>",
    "faceShape": "<oval/round/square/heart/diamond/oblong>",
    "harmony": "<specific harmony assessment — note any asymmetry, proportion issues>",
    "standouts": ["<genuinely notable feature>", ...],
    "areas": ["<specific area holding them back>", ...]
  },
  "hairstyleAnalysis": {
    "currentStyle": "<exact description of current hairstyle>",
    "suitsFaceShape": <true or false>,
    "suitabilityNote": "<be direct about whether it works or not and exactly why>",
    "recommendedStyles": [
      { "name": "<hairstyle name>", "why": "<specific reason for their face shape>" },
      { "name": "<hairstyle name>", "why": "<specific reason>" },
      { "name": "<hairstyle name>", "why": "<specific reason>" }
    ],
    "colorRecommendations": ["<specific color that would complement their skin tone>", ...],
    "stylingTips": ["<specific actionable tip>", ...],
    "avoid": ["<style or habit that's actively hurting their look and why>", ...]
  },
  "protocol": {
    "immediate": ["<action to take this week>", ...],
    "routineAdjustments": ["<specific product or routine change>", ...],
    "lifestyle": ["<lifestyle change that will visibly impact appearance>", ...],
    "treatments": ["<professional treatment worth investing in>", ...]
  },
  "roadmap": {
    "honestAssessment": "<2-3 sentences of unfiltered truth: where they currently are, what's realistically holding them back, and what their ceiling looks like if they commit — do not be mean but do not lie>",
    "currentRating": <their current overall rating number>,
    "potentialRating": <realistic achievable rating with consistent effort — be honest, most people can gain 1-2 points max>,
    "thirtyDay": {
      "focus": "<the single most impactful thing to focus on this month>",
      "expectedChange": "<what will visibly improve in 30 days if they commit>",
      "actions": ["<specific daily/weekly action>", "<specific action>", "<specific action>", "<specific action>"]
    },
    "ninetyDay": {
      "focus": "<what to tackle after the 30-day foundation is built>",
      "expectedChange": "<realistic visible changes by month 3>",
      "actions": ["<specific action>", "<specific action>", "<specific action>", "<specific action>"]
    },
    "sixMonth": {
      "focus": "<the longer-term investments worth making>",
      "expectedChange": "<what they could realistically look like in 6 months with full commitment>",
      "actions": ["<specific action>", "<specific action>", "<specific action>", "<specific action>"]
    }
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
