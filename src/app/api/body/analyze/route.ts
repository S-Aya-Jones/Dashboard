import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const GOAL_BODY_LABELS: Record<string, string> = {
  "athletic-lean": "Athletic & Lean (defined muscles, low body fat, strong)",
  "hourglass": "Hourglass (cinched waist, full glutes and chest, feminine curves)",
  "toned-fit": "Toned & Fit (visible muscle tone, healthy weight, energetic)",
  "slim-trim": "Slim & Trim (lean frame, minimal bulk, light and agile)",
  "curvy-fit": "Curvy & Fit (full curves with muscle definition underneath)",
  "bodybuilder": "Bodybuilder (maximum muscle mass, very low body fat, stage-ready)",
};

export async function POST(req: NextRequest) {
  const { images, height, weight, age, goalBodyType } = await req.json();
  if (!images?.length) return NextResponse.json({ error: "No images provided" }, { status: 400 });

  const context = [
    height ? `Height: ${height}` : "",
    weight ? `Weight: ${weight}` : "",
    age ? `Age: ${age}` : "",
  ].filter(Boolean).join(", ");

  const angleLabels = images.map((img: { label?: string }, i: number) => img.label || `Photo ${i + 1}`).join(", ");

  const goalSection = goalBodyType ? `
GOAL BODY TYPE REQUESTED: ${GOAL_BODY_LABELS[goalBodyType] || goalBodyType}

You MUST include a "goalBodyAssessment" field in your JSON response assessing:
1. How feasible this goal is for THIS specific person based on their visible genetics, body type, current state
2. A specific calorie plan to get there (calculate based on height/weight if provided, otherwise estimate from visual)
3. A detailed workout plan structure

Be honest — if their genetics make this very hard, say so. If they're already close, say so. Give real numbers.` : "";

  const prompt = `You are an expert fitness coach, sports medicine professional, and body composition analyst. You have been provided ${images.length} photo(s) of this person from the following angles: ${angleLabels}.

Use ALL provided angles to give the most accurate body composition assessment possible.

${context ? `User-provided context: ${context}` : ""}
${goalSection}

ACCURACY RULE: Only describe what is genuinely visible. Be honest. Do not invent muscle development, but do not discount what clearly exists.

Return ONLY a valid JSON object. All string values must be single-line (no newlines inside strings):

{
  "bodyType": "<Ectomorph/Mesomorph/Endomorph/Skinny Fat/Mixed>",
  "visualAssessment": "<2-3 honest sentences on overall composition>",
  "bodyFatEstimate": {
    "low": <number>,
    "high": <number>,
    "category": "<Essential/Athletic/Fitness/Average/Above Average>",
    "note": "<visual cues that led to this estimate>"
  },
  "muscleDefinition": <1-10>,
  "compositionScore": <1-10>,
  "potentialScore": <1-10>,
  "visibleMuscle": [
    { "group": "<name>", "development": "<underdeveloped/average/developed>", "note": "<observation>" }
  ],
  "posture": "<posture assessment>",
  "strengths": ["<strength>"],
  "areas": ["<area for improvement>"],
  "honestAssessment": "<3-4 sentences of direct truth: current state, limiting factors, realistic ceiling>",
  "protocol": {
    "training": ["<recommendation>"],
    "diet": ["<recommendation>"],
    "recovery": ["<tip>"]
  },
  "roadmap": {
    "thirtyDay": { "focus": "<focus>", "expectedChange": "<change>", "actions": ["<action>", "<action>", "<action>"] },
    "ninetyDay": { "focus": "<focus>", "expectedChange": "<change>", "actions": ["<action>", "<action>", "<action>"] },
    "sixMonth": { "focus": "<focus>", "expectedChange": "<change>", "actions": ["<action>", "<action>", "<action>"] }
  }${goalBodyType ? `,
  "goalBodyAssessment": {
    "goalType": "${goalBodyType}",
    "feasibility": <0-100 percent how achievable for this specific person based on genetics and current state>,
    "feasibilityLabel": "<Very Achievable/Achievable/Challenging/Very Challenging>",
    "geneticNotes": "<2-3 sentences: what their visible genetics suggest about reaching this goal, what works in their favor, what works against them>",
    "timelineEstimate": "<realistic time to achieve with full consistency, e.g. '6-9 months' or '12-18 months'>",
    "calorieplan": {
      "dailyCalories": <number based on their stats and goal>,
      "protein": <grams per day>,
      "carbs": <grams per day>,
      "fats": <grams per day>,
      "deficit": <calorie deficit or surplus — negative means cut, positive means bulk>,
      "notes": "<one sentence explaining the approach>"
    },
    "workoutPlan": {
      "daysPerWeek": <number>,
      "focus": "<primary training focus for this goal>",
      "weeklyStructure": [
        { "day": "Mon", "focus": "<session type>", "exercises": ["<exercise>", "<exercise>", "<exercise>"] },
        { "day": "Tue", "focus": "<session type>", "exercises": ["<exercise>", "<exercise>", "<exercise>"] },
        { "day": "Wed", "focus": "<session type>", "exercises": ["<exercise>", "<exercise>"] },
        { "day": "Thu", "focus": "<session type>", "exercises": ["<exercise>", "<exercise>", "<exercise>"] },
        { "day": "Fri", "focus": "<session type>", "exercises": ["<exercise>", "<exercise>", "<exercise>"] }
      ],
      "cardio": "<cardio recommendation>",
      "keyPrinciples": ["<principle>", "<principle>", "<principle>"]
    }
  }` : ""}
}`;

  try {
    const imageBlocks = images.map((img: { imageBase64: string; mimeType?: string }) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: (img.mimeType ?? "image/jpeg") as "image/jpeg", data: img.imageBase64 },
    }));

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
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
