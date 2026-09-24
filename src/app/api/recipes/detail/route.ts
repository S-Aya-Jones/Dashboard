import { NextRequest, NextResponse } from "next/server";
import { getRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get("id");
  const source = req.nextUrl.searchParams.get("source") ?? "mealdb";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const recipe = await getRecipe(id, source);
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    return NextResponse.json({ recipe });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load that recipe" },
      { status: 502 }
    );
  }
}
