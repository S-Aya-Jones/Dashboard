import { NextRequest, NextResponse } from "next/server";
import { searchRecipes, surpriseRecipes, hasFullDatabase } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query      = (sp.get("q") ?? "").trim();
  const cuisine    = sp.get("cuisine") ?? undefined;
  const type       = sp.get("type") ?? undefined;
  const minProtein = sp.get("minProtein") ? Number(sp.get("minProtein")) : undefined;
  const sortByProtein = sp.get("sortByProtein") === "1";

  const full = await hasFullDatabase();
  const bare = !query && !cuisine && !type && !minProtein && !sortByProtein;

  try {
    // With no key and nothing asked for, a spread of random meals beats an
    // empty grid.
    if (bare && !full) {
      return NextResponse.json({ recipes: await surpriseRecipes(), full: false });
    }
    const result = await searchRecipes({ query, cuisine, type, minProtein, sortByProtein });
    return NextResponse.json({ ...result, full });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recipe search failed", recipes: [], full },
      { status: 502 }
    );
  }
}
