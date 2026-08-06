import { NextRequest, NextResponse } from "next/server";
import { searchRecipes, surpriseRecipes, RECIPE_CATEGORIES } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q        = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const category = req.nextUrl.searchParams.get("category") ?? undefined;

  try {
    const recipes = q || category
      ? await searchRecipes(q, category)
      : await surpriseRecipes();
    return NextResponse.json({ recipes, categories: RECIPE_CATEGORIES });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recipe search failed", recipes: [] },
      { status: 502 }
    );
  }
}
