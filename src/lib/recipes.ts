import { getAppKey } from "@/lib/appkeys";

// Recipe discovery.
//
// Spoonacular is the real source — hundreds of thousands of recipes with
// photography, per-serving macros, a protein floor you can filter on, and the
// cuisine tags that matter here (Southern, Cajun, Caribbean, African). It
// needs a free key.
//
// TheMealDB is the no-key fallback so the page is never empty, but it only
// holds a few hundred recipes and carries no nutrition at all, so anything
// that depends on macros is unavailable until the key is in.

export interface Macros {
  calories: number;
  protein: number;   // grams per serving
  carbs: number;
  fat: number;
}

export interface RecipeCard {
  id: string;
  source: "mealdb" | "spoonacular";
  title: string;
  image: string;
  category?: string;
  area?: string;
  minutes?: number;
  servings?: number;
  macros?: Macros;
}

export interface RecipeDetail extends RecipeCard {
  ingredients: string[];
  steps: string[];
  tags: string[];
  sourceUrl?: string;
  video?: string;
}

export interface SearchOptions {
  query?: string;
  /** A Spoonacular cuisine, e.g. "Southern", "Cajun", "Caribbean". */
  cuisine?: string;
  /** A Spoonacular dish type, e.g. "main course", "breakfast". */
  type?: string;
  /** Grams of protein per serving, minimum. */
  minProtein?: number;
  /** Order results by protein instead of relevance. */
  sortByProtein?: boolean;
}

export interface SearchResult {
  recipes: RecipeCard[];
  /** False when we fell back to the small keyless source. */
  full: boolean;
  /** Set when a filter was requested that the fallback cannot honour. */
  notice?: string;
}

const MEALDB = "https://www.themealdb.com/api/json/v1/1";
const SPOON = "https://api.spoonacular.com";

async function json(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

// ─── TheMealDB (fallback) ────────────────────────────────────────────────────

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

// The few Spoonacular cuisines that have a TheMealDB equivalent. Southern,
// Cajun and African have none, which is exactly why the key matters.
const MEALDB_AREA: Record<string, string> = {
  American: "American", Caribbean: "Jamaican", Mexican: "Mexican",
  Italian: "Italian", Indian: "Indian", Asian: "Chinese", Mediterranean: "Greek",
};

// TheMealDB categories that a Spoonacular dish type roughly lands on.
const MEALDB_CATEGORY: Record<string, string> = {
  Breakfast: "Breakfast", "Side dish": "Side", Dessert: "Dessert", Starter: "Starter",
};

async function mealDbSearch(opts: SearchOptions): Promise<RecipeCard[]> {
  const q = (opts.query ?? "").trim();

  if (!q && opts.cuisine) {
    const area = MEALDB_AREA[opts.cuisine];
    if (!area) return [];
    const data = await json(`${MEALDB}/filter.php?a=${encodeURIComponent(area)}`);
    return (data.meals ?? []).map(mealDbCard);
  }

  if (!q && opts.type) {
    const cat = MEALDB_CATEGORY[opts.type];
    if (!cat) return [];
    const data = await json(`${MEALDB}/filter.php?c=${encodeURIComponent(cat)}`);
    return (data.meals ?? []).map(mealDbCard);
  }

  const data = await json(`${MEALDB}/search.php?s=${encodeURIComponent(q)}`);
  let meals: MealDbMeal[] = data.meals ?? [];

  // A search that finds nothing by name often finds plenty by ingredient.
  if (!meals.length && q) {
    const byIngredient = await json(
      `${MEALDB}/filter.php?i=${encodeURIComponent(q.replace(/\s+/g, "_"))}`
    );
    meals = byIngredient.meals ?? [];
  }
  return meals.map(mealDbCard);
}

// ─── Spoonacular (primary) ───────────────────────────────────────────────────

interface SpoonNutrient { name: string; amount: number }
interface SpoonResult {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  servings?: number;
  dishTypes?: string[];
  cuisines?: string[];
  diets?: string[];
  extendedIngredients?: Array<{ original: string }>;
  analyzedInstructions?: Array<{ steps: Array<{ step: string }> }>;
  sourceUrl?: string;
  nutrition?: { nutrients?: SpoonNutrient[] };
}

function macrosFrom(r: SpoonResult): Macros | undefined {
  const n = r.nutrition?.nutrients;
  if (!n?.length) return undefined;
  const grab = (name: string) =>
    Math.round(n.find((x) => x.name.toLowerCase() === name)?.amount ?? 0);
  const macros = {
    calories: grab("calories"),
    protein:  grab("protein"),
    carbs:    grab("carbohydrates"),
    fat:      grab("fat"),
  };
  return macros.calories || macros.protein ? macros : undefined;
}

// complexSearch hands back the 312x231 thumbnail, which is soft on a phone
// screen. The same photo exists at 636x393 — twice the pixels for about twice
// the bytes, and the difference is very visible on a card that size.
function upscale(url: string): string {
  return url.replace(
    /^(https:\/\/img\.spoonacular\.com\/recipes\/\d+)-\d+x\d+\.(jpg|png)$/i,
    "$1-636x393.$2"
  );
}

function spoonCard(r: SpoonResult): RecipeCard {
  return {
    id: String(r.id),
    source: "spoonacular",
    title: r.title,
    image: r.image ? upscale(r.image) : r.image,
    category: r.dishTypes?.[0],
    area: r.cuisines?.[0],
    minutes: r.readyInMinutes,
    servings: r.servings,
    macros: macrosFrom(r),
  };
}

// ─── Public surface ──────────────────────────────────────────────────────────

export async function searchRecipes(opts: SearchOptions): Promise<SearchResult> {
  const key = await getAppKey("SPOONACULAR_API_KEY");

  if (key) {
    const url = new URL(`${SPOON}/recipes/complexSearch`);
    url.searchParams.set("apiKey", key);
    url.searchParams.set("number", "24");
    url.searchParams.set("addRecipeInformation", "true");
    url.searchParams.set("addRecipeNutrition", "true");
    url.searchParams.set("instructionsRequired", "true");
    if (opts.query)      url.searchParams.set("query", opts.query);
    if (opts.cuisine)    url.searchParams.set("cuisine", opts.cuisine);
    if (opts.type)       url.searchParams.set("type", opts.type);
    if (opts.minProtein) url.searchParams.set("minProtein", String(opts.minProtein));
    if (opts.sortByProtein) {
      url.searchParams.set("sort", "protein");
      url.searchParams.set("sortDirection", "desc");
    }
    // Without a query or filter, ask for something rather than nothing.
    if (!opts.query && !opts.cuisine && !opts.type && !opts.minProtein) {
      url.searchParams.set("sort", "random");
    }

    try {
      const data = await json(url.toString());
      const results: SpoonResult[] = data.results ?? [];
      return { recipes: results.map(spoonCard), full: true };
    } catch (e) {
      // A blown daily quota shouldn't leave her staring at an error.
      const recipes = await mealDbSearch(opts).catch(() => []);
      return {
        recipes,
        full: false,
        notice: String(e).includes("402")
          ? "Spoonacular's daily limit is used up — showing the smaller free set until tomorrow."
          : "Couldn't reach Spoonacular just now — showing the smaller free set.",
      };
    }
  }

  const recipes = await mealDbSearch(opts).catch(() => []);

  // Be explicit about what the small set can't do rather than lighting up a
  // filter chip and quietly returning something else.
  const missing: string[] = [];
  if (opts.minProtein || opts.sortByProtein) missing.push("protein filtering");
  if (opts.cuisine && !MEALDB_AREA[opts.cuisine]) missing.push(`${opts.cuisine.toLowerCase()} recipes`);
  if (opts.type && !MEALDB_CATEGORY[opts.type]) missing.push(`${opts.type.toLowerCase()} filtering`);

  return {
    recipes,
    full: false,
    notice: missing.length
      ? `The free set has no ${missing.join(" or ")}. Add a Spoonacular key below to unlock it.`
      : undefined,
  };
}

/** A handful of random meals for the very first paint, keyless. */
export async function surpriseRecipes(count = 8): Promise<RecipeCard[]> {
  const picks = await Promise.all(
    Array.from({ length: count }, () =>
      json(`${MEALDB}/random.php`)
        .then((d) => d.meals?.[0] as MealDbMeal | undefined)
        .catch(() => undefined)
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
        `${SPOON}/recipes/${id}/information?includeNutrition=true&apiKey=${key}`
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

/** True once the full database is available. */
export async function hasFullDatabase(): Promise<boolean> {
  return Boolean(await getAppKey("SPOONACULAR_API_KEY"));
}

export async function verifySpoonacularKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SPOON}/recipes/complexSearch?number=1&apiKey=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "That key was rejected by Spoonacular." };
    if (res.status === 402) return { ok: false, error: "That key has no quota left today. It should work tomorrow." };
    if (!res.ok) return { ok: false, error: `Spoonacular replied ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach Spoonacular to check the key." };
  }
}
