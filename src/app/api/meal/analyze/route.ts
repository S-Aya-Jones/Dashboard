import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const prompt = `You are a precise registered dietitian and nutritionist analyzing a photo of food. Your job is to estimate calories and macros on the HIGH END — overestimate portions rather than underestimate. People consistently underestimate food volume. Account for oils used in cooking, dressings, sauces, and any hidden calorie sources.

Return ONLY a valid JSON object. All string values must be single-line:

{
  "mealName": "<descriptive name of the full meal>",
  "ingredients": [
    {
      "name": "<specific food item name>",
      "amount": "<estimated visible portion e.g. '1.5 cups', '200g', '2 large slices'>",
      "grams": <estimated grams as number — err on the high side>,
      "calories": <calories for this portion>,
      "protein": <grams of protein as number>,
      "carbs": <grams of total carbohydrates as number>,
      "fat": <grams of fat as number>,
      "fiber": <grams of fiber as number>
    }
  ],
  "cookingNotes": "<brief note about cooking method and any hidden calories — oils, butter, sauces that may not be visible but are likely present>",
  "totalNote": "<any important caveat about the estimate>"
}

List every distinct food item separately. Include cooking oils, sauces, dressings if likely present. Do not combine everything into one item.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
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

    let meal;
    try { meal = JSON.parse(cleaned); }
    catch { throw new Error("Response JSON malformed — try again"); }

    return NextResponse.json({ meal });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
