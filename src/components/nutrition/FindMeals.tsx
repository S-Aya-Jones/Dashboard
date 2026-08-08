"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Check, ShoppingCart, BookmarkPlus, Shuffle, ExternalLink, Zap, KeyRound } from "lucide-react";
import { NutritionData, Recipe, GroceryItem } from "@/types/dashboard";
import { assignGrocerySection } from "./groceryUtils";

// Say "soup" and get soup, with pictures. No importing, no pasting URLs, no
// deciding what to cook from a blank page — the grid is the whole interface.

interface Macros { calories: number; protein: number; carbs: number; fat: number }

interface Card {
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

interface Detail extends Card {
  ingredients: string[];
  steps: string[];
  tags: string[];
  sourceUrl?: string;
  video?: string;
}

// Cuisines Spoonacular actually indexes. Southern and Cajun are where soul
// food lives; Caribbean and African round out the rest.
const CUISINES = [
  { label: "Soul food",  cuisine: "Southern" },
  { label: "Cajun",      cuisine: "Cajun" },
  { label: "Caribbean",  cuisine: "Caribbean" },
  { label: "African",    cuisine: "African" },
  { label: "American",   cuisine: "American" },
  { label: "Mexican",    cuisine: "Mexican" },
  { label: "Italian",    cuisine: "Italian" },
  { label: "Asian",      cuisine: "Asian" },
  { label: "Mediterranean", cuisine: "Mediterranean" },
  { label: "Indian",     cuisine: "Indian" },
];

// Dish types double as the keyless fallback's categories.
const TYPES = ["Breakfast", "Main course", "Side dish", "Salad", "Soup", "Dessert"];

const CRAVINGS = [
  "chicken", "salmon", "shrimp", "ground turkey", "steak", "eggs",
  "beans", "greens", "mac and cheese", "cornbread", "soup", "pasta",
];

// Enough protein that one serving is actually a meal.
const PROTEIN_FLOOR = 30;

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

function UnlockPanel({ onDone }: { onDone: () => void }) {
  const [key, setKey]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res  = await fetch("/api/recipes/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That key didn't work");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That key didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
    >
      <p className="font-serif text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
        <KeyRound size={16} style={{ color: "var(--purple)" }} /> Open up the full library
      </p>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        What you are browsing now is a free set of a few hundred recipes with no
        nutrition data. A Spoonacular key — free, takes a minute — turns this into
        hundreds of thousands of recipes with protein and calories on every one,
        plus the soul food, Cajun and Caribbean filters above.
      </p>
      <a
        href="https://spoonacular.com/food-api/console#Dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold inline-flex items-center gap-1.5 mt-3"
        style={{ color: "var(--purple)" }}
      >
        Get a free key <ExternalLink size={12} />
      </a>
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste the key here"
          className="flex-1"
          style={{ minWidth: 0 }}
        />
        <button
          onClick={save}
          disabled={busy || !key.trim()}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 flex-shrink-0"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy ? "Checking…" : "Save"}
        </button>
      </div>
      {err && <p className="text-xs mt-2" style={{ color: "var(--red)" }}>{err}</p>}
    </div>
  );
}

function MacroLine({ macros, size = "sm" }: { macros: Macros; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "text-sm" : "text-[11px]";
  return (
    <p className={`${cls} mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5`}>
      <span style={{ color: "var(--purple)", fontWeight: 700 }}>{macros.protein}g protein</span>
      <span style={{ color: "var(--text-light)" }}>{macros.calories} cal</span>
      <span style={{ color: "var(--text-light)" }}>{macros.carbs}c · {macros.fat}f</span>
    </p>
  );
}

function ChipRow({
  items, value, onPick,
}: {
  items: { key: string; label: string }[];
  value: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
      {items.map(({ key, label }) => {
        const on = value === key;
        return (
          <button
            key={key}
            onClick={() => onPick(on ? null : key)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all flex-shrink-0"
            style={{
              background: on ? "var(--text)" : "transparent",
              color:      on ? "var(--surface)" : "var(--text-muted)",
              border:     `1px solid ${on ? "var(--text)" : "var(--border)"}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FindMeals({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [query,    setQuery]    = useState("");
  const [cuisine,  setCuisine]  = useState<string | null>(null);
  const [type,     setType]     = useState<string | null>(null);
  const [protein,  setProtein]  = useState(false);
  const [cards,    setCards]    = useState<Card[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [notice,   setNotice]   = useState<string | null>(null);
  const [full,     setFull]     = useState(true);
  const [open,     setOpen]     = useState<Detail | null>(null);
  const [opening,  setOpening]  = useState<string | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  // Only the newest request is allowed to write results.
  const reqId = useRef(0);

  const load = useCallback(async (f: {
    query: string; cuisine: string | null; type: string | null; protein: boolean;
  }) => {
    const mine = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.query)   params.set("q", f.query);
      if (f.cuisine) params.set("cuisine", f.cuisine);
      if (f.type)    params.set("type", f.type);
      if (f.protein) {
        params.set("minProtein", String(PROTEIN_FLOOR));
        params.set("sortByProtein", "1");
      }
      const res  = await fetch(`/api/recipes/search?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (mine !== reqId.current) return;
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setCards(data.recipes ?? []);
      setFull(Boolean(data.full));
      setNotice(data.notice ?? null);
    } catch (e) {
      if (mine !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Could not reach the recipe service");
      setCards([]);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, []);

  // Every filter change re-runs the search; typing settles first.
  useEffect(() => {
    const delay = query ? 400 : 0;
    const t = setTimeout(() => load({ query, cuisine, type, protein }), delay);
    return () => clearTimeout(t);
  }, [query, cuisine, type, protein, load]);

  const filtered = Boolean(query || cuisine || type || protein);

  function clearAll() {
    setQuery(""); setCuisine(null); setType(null); setProtein(false);
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
      {/* Search + filters */}
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
        >
          <Search size={17} style={{ color: "var(--text-light)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you feel like? Chicken, greens, mac and cheese…"
            className="flex-1 bg-transparent border-0 outline-none text-sm p-0"
            style={{ color: "var(--text)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} style={{ color: "var(--text-light)" }} />
            </button>
          )}
        </div>

        {/* The two filters worth making prominent */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setProtein((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
            style={{
              background: protein ? "var(--purple)" : "transparent",
              color:      protein ? "var(--surface)" : "var(--text-muted)",
              border:     `1px solid ${protein ? "var(--purple)" : "var(--border)"}`,
            }}
          >
            <Zap size={11} /> High protein
          </button>
          {filtered && (
            <button
              onClick={clearAll}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ background: "transparent", color: "var(--text-light)", border: "1px solid var(--border)" }}
            >
              Clear
            </button>
          )}
          {!filtered && (
            <button
              onClick={() => load({ query: "", cuisine: null, type: null, protein: false })}
              className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
              style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <Shuffle size={11} /> Surprise me
            </button>
          )}
        </div>

        <ChipRow
          items={CUISINES.map((c) => ({ key: c.cuisine, label: c.label }))}
          value={cuisine}
          onPick={(v) => setCuisine(v)}
        />
        <ChipRow
          items={TYPES.map((t) => ({ key: t, label: t }))}
          value={type}
          onPick={(v) => setType(v)}
        />

        {!query && !filtered && (
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
          </div>
        )}

        {notice && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {notice}
          </p>
        )}
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
            onClick={() => load({ query, cuisine, type, protein })}
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
                  {c.macros && <MacroLine macros={c.macros} />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!full && !loading && (
        <UnlockPanel onDone={() => load({ query, cuisine, type, protein })} />
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
                {open.macros && <MacroLine macros={open.macros} size="lg" />}
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
