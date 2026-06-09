import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, height, weight, age } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const context = [
    height ? `Height: ${height}` : "",
    weight ? `Weight: ${weight}` : "",
    age ? `Age: ${age}` : "",
  ].filter(Boolean).join(", ");

  const prompt = `You are an expert fitness coach, sports medicine professional, and body composition analyst. Analyze the visible body composition in this photo. Be honest and specific — this is for fitness tracking and improvement.

${context ? `User-provided context: ${context}` : ""}

ACCURACY RULE: Only describe what is genuinely visible. Do not invent muscle development that is not there, but also do not under-credit what clearly exists. Body fat % is a visual estimate — give an honest range, not a number you cannot actually verify.

Return ONLY a valid JSON object. All string values must be single-line:

{
  "bodyType": "<Ectomorph/Mesomorph/Endomorph/Skinny Fat/Mixed>",
  "visualAssessment": "<2-3 honest sentences on what you see: fat distribution, visible muscle, overall composition>",
  "bodyFatEstimate": {
    "low": <lower bound % as number>,
    "high": <upper bound % as number>,
    "category": "<Essential/Athletic/Fitness/Average/Above Average>",
    "note": "<what specific visual cues lead to this estimate>"
  },
  "muscleDefinition": <1-10 score>,
  "compositionScore": <1-10 overall composition score — be calibrated, average is 4-6>,
  "potentialScore": <realistic achievable score with consistent work>,
  "visibleMuscle": [
    { "group": "<muscle group name>", "development": "<underdeveloped/average/developed>", "note": "<specific observation>" }
  ],
  "strengths": ["<genuine visible strength>"],
  "areas": ["<area with clear room for improvement>"],
  "honestAssessment": "<3-4 sentences of direct truth: current state, main limiting factors, realistic ceiling>",
  "protocol": {
    "training": ["<specific training recommendation based on what you see>"],
    "diet": ["<specific diet adjustment>"],
    "recovery": ["<recovery or lifestyle tip>"]
  },
  "roadmap": {
    "thirtyDay": {
      "focus": "<highest-impact focus for month 1>",
      "expectedChange": "<realistic visible change in 30 days>",
      "actions": ["<specific action>", "<specific action>", "<specific action>", "<specific action>"]
    },
    "ninetyDay": {
      "focus": "<month 3 focus>",
      "expectedChange": "<realistic 90-day visible change>",
      "actions": ["<specific action>", "<specific action>", "<specific action>", "<specific action>"]
    },
    "sixMonth": {
      "focus": "<6-month goal>",
      "expectedChange": "<what they could look like at 6 months with full commitment>",
      "actions": ["<specific action>", "<specific action>", "<specific action>", "<specific action>"]
    }
  }
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType ?? "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const cleaned = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    );

    let analysis;
    try { analysis = JSON.parse(cleaned); }
    catch { throw new Error("Response JSON malformed — try again"); }

    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
