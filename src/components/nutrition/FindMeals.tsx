"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Check, ShoppingCart, BookmarkPlus, Shuffle, ExternalLink } from "lucide-react";
import { NutritionData, Recipe, GroceryItem } from "@/types/dashboard";
import { assignGrocerySection } from "./groceryUtils";

// Say "soup" and get soup, with pictures. No importing, no pasting URLs, no
// deciding what to cook from a blank page — the grid is the whole interface.

interface Card {
  id: string;
  source: "mealdb" | "spoonacular";
  title: string;
  image: string;
  category?: string;
  area?: string;
  minutes?: number;
  servings?: number;
}

interface Detail extends Card {
  ingredients: string[];
  steps: string[];
  tags: string[];
  sourceUrl?: string;
  video?: string;
}

const CATEGORIES = [
  "Breakfast", "Chicken", "Seafood", "Beef", "Pasta",
  "Vegetarian", "Vegan", "Side", "Starter", "Dessert",
];

const CRAVINGS = ["soup", "salmon", "chickpea", "curry", "salad", "stew", "rice", "pasta"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Photos are pulled through our own origin so they load on the same
// connection as the page. Some source images go missing over time; rather
// than a broken-image glyph, the tile falls back to the dish name in serif.
function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(!src);
  const proxied = src ? `/api/recipes/image?u=${encodeURIComponent(src)}` : "";
  if (failed) {
    return (
      <div
        className="w-full h-full grid place-items-center px-4 text-center"
        style={{ background: "var(--bg)" }}
      >
        <span className="font-serif text-lg leading-snug" style={{ color: "var(--text-light)" }}>
          {alt}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={proxied} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />
  );
}

export function FindMeals({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [query,   setQuery]   = useState("");
  const [active,  setActive]  = useState<string | null>(null);
  const [cards,   setCards]   = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [open,    setOpen]    = useState<Detail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  // Only the newest request is allowed to write results.
  const reqId = useRef(0);

  const load = useCallback(async (q: string, category: string | null) => {
    const mine = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      const res  = await fetch(`/api/recipes/search?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (mine !== reqId.current) return;
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setCards(data.recipes ?? []);
    } catch (e) {
      if (mine !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Could not reach the recipe service");
      setCards([]);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, []);

  // First paint shows a spread of real food rather than an empty box.
  useEffect(() => { load("", null); }, [load]);

  // Typing settles before it searches.
  useEffect(() => {
    if (!query) return;
    const t = setTimeout(() => load(query, active), 400);
    return () => clearTimeout(t);
  }, [query, active, load]);

  function pickCategory(c: string) {
    const next = active === c ? null : c;
    setActive(next);
    load(query, next);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }

  async function openCard(card: Card) {
    setOpening(card.id);
    try {
      const res  = await fetch(`/api/recipes/detail?id=${card.id}&source=${card.source}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load that recipe");
      setOpen(data.recipe);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not load that recipe");
    } finally {
      setOpening(null);
    }
  }

  const savedTitles = new Set(nutrition.recipes.map((r) => r.title.toLowerCase()));

  function save(d: Detail) {
    const recipe: Recipe = {
      id: uid(),
      title: d.title,
      description: [d.area, d.category].filter(Boolean).join(" · ") || undefined,
      ingredients: d.ingredients,
      steps: d.steps,
      photos: d.image ? [d.image] : [],
      tags: d.tags,
      dietaryTags: [],
      servings: d.servings,
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...nutrition, recipes: [recipe, ...nutrition.recipes] });
    flash(`Saved ${d.title} to your recipes`);
    return recipe.id;
  }

  function addToGrocery(d: Detail, recipeId?: string) {
    const existing = new Set(nutrition.groceryItems.map((g) => g.name.toLowerCase()));
    const items: GroceryItem[] = d.ingredients
      .filter((line) => !existing.has(line.toLowerCase()))
      .map((line) => ({
        id: uid(),
        name: line,
        section: assignGrocerySection(line),
        checked: false,
        addedAt: new Date().toISOString(),
        fromRecipeId: recipeId,
      }));

    if (!items.length) {
      flash("Those ingredients are already on your list");
      return;
    }
    onUpdate({ ...nutrition, groceryItems: [...nutrition.groceryItems, ...items] });
    flash(`Added ${items.length} ingredient${items.length === 1 ? "" : "s"} to your grocery list`);
  }

  function cookThis(d: Detail) {
    const id = save(d);
    addToGrocery(d, id);
    setOpen(null);
    flash("Saved, and the ingredients are on your grocery list");
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
        >
          <Search size={17} style={{ color: "var(--text-light)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you feel like? Soup, salmon, something with chickpeas…"
            className="flex-1 bg-transparent border-0 outline-none text-sm p-0"
            style={{ color: "var(--text)" }}
          />
          {query && (
            <button onClick={() => { setQuery(""); load("", active); }} aria-label="Clear search">
              <X size={15} style={{ color: "var(--text-light)" }} />
            </button>
          )}
        </div>

        {!query && (
          <div className="flex flex-wrap gap-1.5">
            {CRAVINGS.map((c) => (
              <button
                key={c}
                onClick={() => setQuery(c)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => { setActive(null); load("", null); }}
              className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
              style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <Shuffle size={11} /> Surprise me
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = active === c;
            return (
              <button
                key={c}
                onClick={() => pickCategory(c)}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: on ? "var(--text)" : "transparent",
                  color:      on ? "var(--surface)" : "var(--text-muted)",
                  border:     `1px solid ${on ? "var(--text)" : "var(--border)"}`,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ aspectRatio: "4 / 5", background: "var(--bg)", border: "1px solid var(--border)" }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}
        >
          <p>{error}</p>
          <button
            onClick={() => load(query, active)}
            className="mt-3 text-xs font-semibold underline"
            style={{ color: "var(--text)" }}
          >
            Try again
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nothing came back for “{query}”. Try an ingredient instead — chicken, chickpea, salmon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map((c) => {
            const already = savedTitles.has(c.title.toLowerCase());
            return (
              <button
                key={`${c.source}-${c.id}`}
                onClick={() => openCard(c)}
                className="group text-left rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 flex flex-col"
                style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
                  <Photo
                    src={c.image}
                    alt={c.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {already && (
                    <span
                      className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1"
                      style={{ background: "rgba(255,255,255,0.94)", color: "#3F6F5E" }}
                    >
                      <Check size={10} /> Saved
                    </span>
                  )}
                  {opening === c.id && (
                    <span
                      className="absolute inset-0 grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.32)" }}
                    >
                      <Loader2 size={20} className="animate-spin" style={{ color: "#fff" }} />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="font-serif text-base leading-snug overflow-hidden"
                    style={{
                      color: "var(--text)",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      minHeight: "2.6em",
                    }}
                  >
                    {c.title}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-light)" }}>
                    {[c.area, c.category, c.minutes ? `${c.minutes} min` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8"
          style={{ background: "rgba(28,22,19,0.55)" }}
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden my-auto shadow-2xl"
            style={{ background: "var(--surface-solid)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div style={{ height: 260 }}>
                <Photo src={open.image} alt={open.title} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center"
                style={{ background: "rgba(255,255,255,0.92)", color: "#1C1613" }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>{open.title}</h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-light)" }}>
                  {[open.area, open.category, open.servings ? `serves ${open.servings}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => cookThis(open)}
                  className="text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5"
                  style={{ background: "var(--text)", color: "var(--surface)" }}
                >
                  <ShoppingCart size={13} /> Cook this — save it and shop for it
                </button>
                <button
                  onClick={() => save(open)}
                  className="text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5"
                  style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  <BookmarkPlus size={13} /> Just save it
                </button>
                {open.sourceUrl && (
                  <a
                    href={open.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5"
                    style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    <ExternalLink size={13} /> Original
                  </a>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Ingredients
                  </h3>
                  <ul className="space-y-1.5">
                    {open.ingredients.map((line, i) => (
                      <li key={i} className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Method
                  </h3>
                  <ol className="space-y-2.5">
                    {open.steps.map((step, i) => (
                      <li key={i} className="text-sm leading-relaxed flex gap-2.5" style={{ color: "var(--text)" }}>
                        <span className="text-xs font-bold tabular-nums pt-0.5" style={{ color: "var(--text-light)" }}>
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-sm px-5 py-3 rounded-full shadow-lg"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
