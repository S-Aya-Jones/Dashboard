import { getAppKey } from "@/lib/appkeys";

// Recipe discovery. TheMealDB is the default because it needs no key and its
// photography is good; if a Spoonacular key is ever pasted into Settings the
// search widens to their catalogue instead. Both get normalised to the same
// shape so the UI never has to care which one answered.

export interface RecipeCard {
  id: string;
  source: "mealdb" | "spoonacular";
  title: string;
  image: string;
  category?: string;
  area?: string;
  minutes?: number;
  servings?: number;
}

export interface RecipeDetail extends RecipeCard {
  ingredients: string[];
  steps: string[];
  tags: string[];
  sourceUrl?: string;
  video?: string;
}

const MEALDB = "https://www.themealdb.com/api/json/v1/1";

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

// ─── TheMealDB ───────────────────────────────────────────────────────────────

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strTags?: string | null;
  strSource?: string | null;
  strYoutube?: string | null;
  [k: string]: unknown;
}

function mealDbCard(m: MealDbMeal): RecipeCard {
  return {
    id: m.idMeal,
    source: "mealdb",
    title: m.strMeal,
    image: m.strMealThumb,
    category: m.strCategory || undefined,
    area: m.strArea || undefined,
  };
}

function mealDbDetail(m: MealDbMeal): RecipeDetail {
  // Ingredients arrive as 20 flat strIngredientN / strMeasureN pairs.
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = String(m[`strIngredient${i}`] ?? "").trim();
    if (!name) continue;
    const measure = String(m[`strMeasure${i}`] ?? "").trim();
    ingredients.push(measure ? `${measure} ${name}` : name);
  }

  const steps = String(m.strInstructions ?? "")
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(?:STEP\s*)?\d+[.)]\s*/i, "").trim())
    .filter((s) => s.length > 1);

  return {
    ...mealDbCard(m),
    ingredients,
    steps,
    tags: (m.strTags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    sourceUrl: m.strSource || undefined,
    video: m.strYoutube || undefined,
  };
}

// ─── Spoonacular (only when a key is configured) ─────────────────────────────

interface SpoonResult {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  servings?: number;
  dishTypes?: string[];
  cuisines?: string[];
  extendedIngredients?: Array<{ original: string }>;
  analyzedInstructions?: Array<{ steps: Array<{ step: string }> }>;
  sourceUrl?: string;
  diets?: string[];
}

function spoonCard(r: SpoonResult): RecipeCard {
  return {
    id: String(r.id),
    source: "spoonacular",
    title: r.title,
    image: r.image,
    category: r.dishTypes?.[0],
    area: r.cuisines?.[0],
    minutes: r.readyInMinutes,
    servings: r.servings,
  };
}

// ─── Public surface ──────────────────────────────────────────────────────────

/** Free-text search — "soup", "salmon", "something with chickpeas". */
export async function searchRecipes(query: string, category?: string): Promise<RecipeCard[]> {
  const key = await getAppKey("SPOONACULAR_API_KEY");

  if (key) {
    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("apiKey", key);
    url.searchParams.set("number", "24");
    url.searchParams.set("addRecipeInformation", "true");
    if (query) url.searchParams.set("query", query);
    if (category) url.searchParams.set("type", category.toLowerCase());
    try {
      const data = await json(url.toString());
      const results: SpoonResult[] = data.results ?? [];
      if (results.length) return results.map(spoonCard);
    } catch {
      // fall through to the free source rather than showing an empty page
    }
  }

  // Category browse returns thumbnails only, which is exactly what a grid needs.
  if (category && !query) {
    const data = await json(`${MEALDB}/filter.php?c=${encodeURIComponent(category)}`);
    const meals: MealDbMeal[] = data.meals ?? [];
    return meals.map(mealDbCard);
  }

  const data = await json(`${MEALDB}/search.php?s=${encodeURIComponent(query)}`);
  let meals: MealDbMeal[] = data.meals ?? [];

  // A search that finds nothing by name often finds plenty by ingredient.
  if (!meals.length && query) {
    const byIngredient = await json(
      `${MEALDB}/filter.php?i=${encodeURIComponent(query.replace(/\s+/g, "_"))}`
    );
    meals = byIngredient.meals ?? [];
  }

  const cards = meals.map(mealDbCard);
  return category ? cards.filter((c) => c.category === category) : cards;
}

/** A handful of random meals, for the empty state. */
export async function surpriseRecipes(count = 8): Promise<RecipeCard[]> {
  const picks = await Promise.all(
    Array.from({ length: count }, () =>
      json(`${MEALDB}/random.php`).then((d) => d.meals?.[0] as MealDbMeal | undefined).catch(() => undefined)
    )
  );
  const seen = new Set<string>();
  return picks
    .filter((m): m is MealDbMeal => Boolean(m))
    .filter((m) => !seen.has(m.idMeal) && seen.add(m.idMeal))
    .map(mealDbCard);
}

export async function getRecipe(id: string, source: string): Promise<RecipeDetail | null> {
  if (source === "spoonacular") {
    const key = await getAppKey("SPOONACULAR_API_KEY");
    if (key) {
      const r: SpoonResult = await json(
        `https://api.spoonacular.com/recipes/${id}/information?apiKey=${key}`
      );
      return {
        ...spoonCard(r),
        ingredients: (r.extendedIngredients ?? []).map((i) => i.original),
        steps: (r.analyzedInstructions?.[0]?.steps ?? []).map((s) => s.step),
        tags: [...(r.diets ?? []), ...(r.dishTypes ?? [])],
        sourceUrl: r.sourceUrl,
      };
    }
  }

  const data = await json(`${MEALDB}/lookup.php?i=${encodeURIComponent(id)}`);
  const meal: MealDbMeal | undefined = data.meals?.[0];
  return meal ? mealDbDetail(meal) : null;
}

export const RECIPE_CATEGORIES = [
  "Breakfast", "Chicken", "Seafood", "Beef", "Pasta",
  "Vegetarian", "Vegan", "Side", "Starter", "Dessert",
] as const;
