import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { loadData, saveData } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const mealType = (formData.get("mealType") as string) ?? "snack";
  const date = (formData.get("date") as string) ?? new Date().toISOString().slice(0, 10);

  if (!file) return NextResponse.json({ error: "No photo" }, { status: 400 });

  // Upload to Vercel Blob
  const filename = `food/${date}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
  const blob = await put(filename, file, { access: "public" });

  // Use Claude Vision to analyze the food
  let calories: number | null = null;
  let protein: number | null = null;
  let name = "Meal";
  let aiDescription = "";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = (file.type as "image/jpeg" | "image/png" | "image/webp") ?? "image/jpeg";

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Analyze this food photo. Return ONLY valid JSON:
{
  "name": "<short meal name, e.g. 'Grilled chicken with sweet potato'>",
  "calories": <estimated total calories as integer>,
  "protein": <estimated protein in grams as integer>,
  "description": "<1 sentence describing what you see>"
}
Be realistic with estimates based on portion sizes visible. If you can't identify food, return null for calories and protein.`,
          },
        ],
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      name = parsed.name ?? "Meal";
      calories = typeof parsed.calories === "number" ? parsed.calories : null;
      protein = typeof parsed.protein === "number" ? parsed.protein : null;
      aiDescription = parsed.description ?? "";
    }
  } catch { /* non-fatal */ }

  // Save to dashboard
  const data = await loadData();
  const nutrition = data.nutrition ?? { meals: [], recipes: [], groceryItems: [], pantryItems: [], shetritionImages: [] };

  const newMeal = {
    id: `meal-${Date.now()}`,
    date,
    name,
    mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack",
    photos: [blob.url],
    rating: 0,
    tags: [],
    createdAt: new Date().toISOString(),
    calories: calories ?? undefined,
    protein: protein ?? undefined,
    aiDescription: aiDescription || undefined,
  };

  nutrition.meals = [...nutrition.meals, newMeal];
  data.nutrition = nutrition;

  // Auto-check diet task in 75 Hard for today
  if (date === new Date().toISOString().slice(0, 10)) {
    const h75 = data.seventyFiveHard;
    if (h75) {
      const today = date;
      const existingLog = h75.logs.find(l => l.date === today) ?? {
        date: today, workout: false, steps: false, water: false,
        mcat: false, progressPhoto: false, exposureTherapy: false, diet: false,
      };
      h75.logs = [...h75.logs.filter(l => l.date !== today), { ...existingLog, diet: true }];
      data.seventyFiveHard = h75;
    }
  }

  await saveData(data);

  // Calculate today's running totals
  const today = date;
  const todayMeals = nutrition.meals.filter(m => m.date === today);
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const totalProtein = todayMeals.reduce((sum, m) => sum + (m.protein ?? 0), 0);

  return NextResponse.json({
    success: true,
    meal: newMeal,
    url: blob.url,
    analysis: { name, calories, protein, description: aiDescription },
    todayTotals: { calories: totalCalories, protein: totalProtein, mealCount: todayMeals.length },
  });
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const data = await loadData();
  const meals = (data.nutrition?.meals ?? []).filter(m => m.date === date);
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
  return NextResponse.json({ meals, totalCalories, totalProtein });
}
