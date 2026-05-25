import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Allow up to 60s — vision + JSON generation can be slow on large images
export const maxDuration = 60;

const PROMPT = `Extract the recipe from this image and return ONLY a valid JSON object — no markdown fences, no explanation, just the JSON.

Schema:
{
  "title": "string",
  "description": "string or empty string",
  "ingredients": ["array of strings — ingredient lines. If there are ingredient groups, add the group name as a line ending with a colon, e.g. CHICKEN: or SAUCE:"],
  "steps": ["array of step strings, one per step"],
  "servings": null or integer,
  "caloriesPerServing": null or integer,
  "protein": null or integer (grams),
  "carbs": null or integer (grams),
  "fat": null or integer (grams),
  "dietaryTags": ["only include tags from: Egg-free, Nut-free, Dairy-free, Gluten-free, Vegan, Vegetarian, Low-carb, High-protein"],
  "tags": ["short descriptive tags like cozy, quick, healthy, comfort food"]
}

If the image doesn't contain a recipe, return: {"error": "No recipe found in image"}
Return only the JSON object.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = (file.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown fences if Claude wrapped in them anyway
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    const parsed = JSON.parse(cleaned);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Recipe extraction error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
