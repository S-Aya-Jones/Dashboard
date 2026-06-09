import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, products, checkIns } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const routineContext = products?.length
    ? `Current skincare routine:\n${products.map((p: { name: string; brand?: string; routine: string; isTesting?: boolean }) =>
        `- ${p.name}${p.brand ? ` (${p.brand})` : ""} - ${p.routine}${p.isTesting ? " [testing]" : ""}`
      ).join("\n")}`
    : "No skincare routine logged yet.";

  const checkInContext = checkIns?.length
    ? `Recent skin check-ins:\n${checkIns.slice(-5).map((c: { date: string; observations: string; breakouts?: boolean }) =>
        `- ${c.date}: ${c.observations}${c.breakouts ? " (breakout)" : ""}`
      ).join("\n")}`
    : "No check-in history yet.";

  const prompt = `You are a brutally honest aesthetic analyst, dermatologist, and hair stylist. Your job is to give real, unfiltered feedback, not flattery. The person asking WANTS honest truth so they can actually improve. Do not sugarcoat. Call out real problems directly. Be specific about what is holding them back and what their realistic potential is.

CRITICAL ACCURACY RULE: Only describe features you can ACTUALLY SEE in the photo. Do NOT invent negatives or assume problems that are not visible. If someone has full lips, say full lips. If someone has clear skin, say clear skin. Being honest means being accurate — fabricating flaws is worse than flattery. Describe each feature as it genuinely appears. If the photo angle or lighting limits your view of something, say so rather than guessing.

${routineContext}
${checkInContext}

Return ONLY a valid JSON object with exactly this structure. All string values must be on a single line with no literal newline characters inside them:

{
  "skinScore": <number 0-100, average skin is 50-65>,
  "overallRating": <number 1-10 with one decimal, most people are 4-7, reserve 8+ for genuinely above average>,
  "apparentAge": {
    "estimated": <number, age this person appears based on skin, features, and hair>,
    "note": "<specific: what exact features are aging or youthening them>"
  },
  "skinAssessment": {
    "summary": "<honest 2-3 sentence overview, name actual problems visible>",
    "texture": "<specific texture assessment, mention unevenness, pores, roughness if present>",
    "hydration": "<honest hydration assessment>",
    "concerns": ["<real concern>", "<real concern>"],
    "strengths": ["<genuine strength only>"]
  },
  "featureAnalysis": {
    "summary": "<honest 2-3 sentences, what is working and what is not, be direct>",
    "faceShape": "<oval/round/square/heart/diamond/oblong>",
    "harmony": "<specific harmony assessment, note any asymmetry, proportion issues>",
    "standouts": ["<genuinely notable feature>"],
    "areas": ["<specific area holding them back>"]
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
    "colorRecommendations": ["<specific color that would complement their skin tone>"],
    "stylingTips": ["<specific actionable tip>"],
    "avoid": ["<style or habit that is actively hurting their look and why>"]
  },
  "protocol": {
    "immediate": ["<action to take this week>"],
    "routineAdjustments": ["<specific product or routine change>"],
    "lifestyle": ["<lifestyle change that will visibly impact appearance>"],
    "treatments": ["<professional non-surgical treatment worth investing in>"]
  },
  "surgicalConsiderations": {
    "highYield": [
      { "name": "<procedure name>", "impact": "<exactly what this addresses on their specific face>", "cost": "<rough cost range e.g. $500-1500>", "timing": "<when to consider e.g. after building skincare foundation>" }
    ],
    "longTerm": [
      { "name": "<procedure name>", "impact": "<what this specifically addresses for them>", "cost": "<rough cost range>", "timing": "<longer-term consideration after high-yield steps>" }
    ],
    "notRecommended": ["<procedure that would be wrong for their specific features and why>"]
  },
  "roadmap": {
    "honestAssessment": "<2-3 sentences of unfiltered truth: where they currently are, what is holding them back, and what their ceiling looks like if they commit>",
    "currentRating": <their current overall rating number>,
    "potentialRating": <realistic achievable rating with consistent skincare and lifestyle effort, most people gain 1-2 points max>,
    "absoluteCeiling": <maximum realistic rating with optimal non-surgical AND surgical interventions combined, be honest>,
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
      max_tokens: 4096,
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
    if (!jsonMatch) throw new Error("No JSON found in response");

    // Escape literal control chars inside JSON string values
    const cleaned = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
      match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    );

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      throw new Error("Response JSON malformed — try again");
    }
    if (!analysis) throw new Error("No valid analysis returned");

    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
