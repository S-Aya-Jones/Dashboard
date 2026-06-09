import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { images, height, weight, age } = await req.json();
  if (!images?.length) return NextResponse.json({ error: "No images provided" }, { status: 400 });

  const context = [
    height ? `Height: ${height}` : "",
    weight ? `Weight: ${weight}` : "",
    age ? `Age: ${age}` : "",
  ].filter(Boolean).join(", ");

  const angleLabels = images.map((img: { label?: string }, i: number) => img.label || `Photo ${i + 1}`).join(", ");

  const prompt = `You are an expert fitness coach, sports medicine professional, and body composition analyst. You have been provided ${images.length} photo(s) of this person from the following angles: ${angleLabels}.

Use ALL provided angles to give the most accurate body composition assessment possible. Multiple angles allow you to assess depth, muscularity, fat distribution, and posture far more accurately than a single photo.

${context ? `User-provided context: ${context}` : ""}

ACCURACY RULE: Only describe what is genuinely visible across the photos. Use all angles together — for example, a side view reveals core and lower back fat that a front view hides. Be honest about what each angle reveals. Do not invent muscle development, but do not discount what clearly exists.

Return ONLY a valid JSON object. All string values must be single-line:

{
  "bodyType": "<Ectomorph/Mesomorph/Endomorph/Skinny Fat/Mixed>",
  "visualAssessment": "<2-3 honest sentences on overall composition using insights from all angles>",
  "bodyFatEstimate": {
    "low": <lower bound % as number>,
    "high": <upper bound % as number>,
    "category": "<Essential/Athletic/Fitness/Average/Above Average>",
    "note": "<what specific visual cues across the angles lead to this estimate>"
  },
  "muscleDefinition": <1-10 score>,
  "compositionScore": <1-10 overall score, average is 4-6>,
  "potentialScore": <realistic achievable score with consistent work>,
  "visibleMuscle": [
    { "group": "<muscle group name>", "development": "<underdeveloped/average/developed>", "note": "<specific observation from any angle>" }
  ],
  "posture": "<posture assessment based on the photos>",
  "strengths": ["<genuine visible strength>"],
  "areas": ["<area with clear room for improvement>"],
  "honestAssessment": "<3-4 sentences of direct truth using all angles: current state, main limiting factors, realistic ceiling>",
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
    const imageBlocks = images.map((img: { imageBase64: string; mimeType?: string }) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: (img.mimeType ?? "image/jpeg") as "image/jpeg", data: img.imageBase64 },
    }));

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
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
