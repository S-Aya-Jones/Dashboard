"use client";

import { useState, useRef } from "react";
import { Plus, X, Camera, Link as LinkIcon, ArrowLeft, ShoppingCart } from "lucide-react";
import { Recipe, GroceryItem, NutritionData } from "@/types/dashboard";
import { assignGrocerySection } from "./groceryUtils";

const DIETARY_OPTIONS = [
  "Egg-free", "Nut-free", "Dairy-free", "Gluten-free",
  "Vegan", "Vegetarian", "Low-carb", "High-protein",
];

function SerifRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className="font-serif text-xl leading-none transition-colors"
          style={{
            color: n <= (value || 0) ? "#DA667B" : "#C9B79C",
            cursor: onChange ? "pointer" : "default",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}>
          {n}
        </button>
      ))}
    </div>
  );
}

// Parse ingredient lines — a line ending in ":" or all-caps short line = section header
function parseIngredientLine(line: string): { type: "header" | "item"; text: string } {
  const trimmed = line.trim();
  if (trimmed.endsWith(":") || (trimmed === trimmed.toUpperCase() && trimmed.length < 30 && !/\d/.test(trimmed))) {
    return { type: "header", text: trimmed.replace(/:$/, "") };
  }
  return { type: "item", text: trimmed };
}

// ── Recipe Detail View ────────────────────────────────────────────────────────

function RecipeDetail({
  recipe,
  onBack,
  onDelete,
  onAddToGrocery,
}: {
  recipe: Recipe;
  onBack: () => void;
  onDelete: () => void;
  onAddToGrocery: (ings: string[]) => void;
}) {
  const parsed = recipe.ingredients.map(parseIngredientLine);
  const itemLines = parsed.filter((l) => l.type === "item").map((l) => l.text);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggleCheck(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  // Pre-compute item indices to avoid mutable expression statement in render
  let _counter = 0;
  const parsedWithIdx = parsed.map((line) => ({
    ...line,
    itemIdx: line.type === "item" ? _counter++ : -1,
  }));

  return (
    <div>
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "#71816D" }}
        >
          <ArrowLeft size={16} /> All Recipes
        </button>
        <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "#DA667B", background: "rgba(218,102,123,0.08)" }}>
          Delete
        </button>
      </div>

      {/* Hero photo */}
      {recipe.photos.length > 0 && (
        <div className="w-full rounded-3xl overflow-hidden mb-8" style={{ maxHeight: "480px" }}>
          <img src={recipe.photos[0]} alt={recipe.title} className="w-full h-full object-cover" style={{ maxHeight: "480px" }} />
        </div>
      )}

      {/* Title + dietary tags */}
      <div className="text-center mb-6">
        <h1
          className="font-serif mb-3"
          style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.1 }}
        >
          {recipe.title}
        </h1>

        {recipe.dietaryTags?.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {recipe.dietaryTags.map((tag) => (
              <span key={tag} className="text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {recipe.rating != null && (
          <div className="flex justify-center mb-2">
            <SerifRating value={recipe.rating} />
          </div>
        )}

        {recipe.description && (
          <p className="text-sm max-w-lg mx-auto" style={{ color: "rgba(52,42,33,0.6)" }}>
            {recipe.description}
          </p>
        )}
      </div>

      {/* Serving / calorie bar */}
      {(recipe.servings || recipe.caloriesPerServing) && (
        <div
          className="flex items-center justify-center gap-8 py-4 mb-8 rounded-2xl"
          style={{ background: "rgba(201,183,156,0.15)", border: "1px solid rgba(201,183,156,0.3)" }}
        >
          {recipe.servings && (
            <div className="text-center">
              <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {recipe.servings}
              </p>
              <p className="text-xs" style={{ color: "#A8967E" }}>servings</p>
            </div>
          )}
          {recipe.caloriesPerServing && (
            <div className="text-center">
              <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {recipe.caloriesPerServing}
              </p>
              <p className="text-xs" style={{ color: "#A8967E" }}>cal / serving</p>
            </div>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#A8967E" }}>
                Ingredients
              </h2>
              <button
                onClick={() => onAddToGrocery(itemLines)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                style={{ background: "#71816D" }}
              >
                <ShoppingCart size={12} /> Add to Grocery
              </button>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(201,183,156,0.35)" }}
            >
              {parsedWithIdx.map((line, i) => {
                if (line.type === "header") {
                  return (
                    <div key={i} className="px-5 pt-4 pb-1">
                      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#A8967E" }}>
                        {line.text}
                      </p>
                    </div>
                  );
                }
                const localIdx = line.itemIdx;
                const isChecked = checked.has(localIdx);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleCheck(localIdx)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ background: isChecked ? "rgba(201,183,156,0.12)" : "transparent", borderTop: i > 0 ? "1px solid rgba(201,183,156,0.2)" : "none" }}
                  >
                    <div
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                      style={{
                        border: `1.5px solid ${isChecked ? "#71816D" : "#C9B79C"}`,
                        background: isChecked ? "#71816D" : "transparent",
                      }}
                    >
                      {isChecked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span
                      className="text-sm"
                      style={{
                        color: isChecked ? "rgba(52,42,33,0.38)" : "#342A21",
                        textDecoration: isChecked ? "line-through" : "none",
                      }}
                    >
                      {line.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        {recipe.steps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#A8967E" }}>
              Instructions
            </h2>
            <div className="space-y-4">
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ background: "#71816D" }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm pt-0.5 leading-relaxed" style={{ color: "#342A21" }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nutrition */}
        {(recipe.protein || recipe.carbs || recipe.fat || recipe.caloriesPerServing) && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#A8967E" }}>
              Nutrition
              {recipe.servings && <span className="normal-case font-normal ml-1" style={{ color: "#C9B79C" }}>· per serving</span>}
            </h2>
            <div
              className="flex gap-6 flex-wrap px-5 py-4 rounded-2xl"
              style={{ background: "rgba(201,183,156,0.12)", border: "1px solid rgba(201,183,156,0.25)" }}
            >
              {recipe.caloriesPerServing && (
                <div>
                  <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{recipe.caloriesPerServing}</p>
                  <p className="text-xs" style={{ color: "#A8967E" }}>Calories</p>
                </div>
              )}
              {recipe.protein && (
                <div>
                  <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{recipe.protein}g</p>
                  <p className="text-xs" style={{ color: "#A8967E" }}>Protein</p>
                </div>
              )}
              {recipe.fat && (
                <div>
                  <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{recipe.fat}g</p>
                  <p className="text-xs" style={{ color: "#A8967E" }}>Fat</p>
                </div>
              )}
              {recipe.carbs && (
                <div>
                  <p className="font-serif text-2xl" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{recipe.carbs}g</p>
                  <p className="text-xs" style={{ color: "#A8967E" }}>Carbs</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(201,183,156,0.2)", color: "#71816D" }}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recipe Grid Card ──────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick, onDelete }: { recipe: Recipe; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      className="group rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "#FAF3E8",
        border: "1px solid rgba(201,183,156,0.35)",
        boxShadow: "0 3px 14px rgba(52,42,33,0.09)",
      }}
      onClick={onClick}
    >
      {recipe.photos.length > 0 ? (
        <div className="w-full overflow-hidden" style={{ height: "180px" }}>
          <img src={recipe.photos[0]} alt={recipe.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: "120px", background: "rgba(201,183,156,0.18)" }}>
          <span className="text-4xl">🍳</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-serif text-lg leading-tight flex-1"
            style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {recipe.title}
          </h3>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all"
            style={{ color: "#A8967E" }}
          >
            <X size={13} />
          </button>
        </div>

        {recipe.dietaryTags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.dietaryTags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(113,129,109,0.10)", color: "#71816D" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          {recipe.rating != null ? (
            <SerifRating value={recipe.rating} />
          ) : <div />}
          {recipe.caloriesPerServing && (
            <span className="text-xs" style={{ color: "#A8967E" }}>{recipe.caloriesPerServing} cal</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Recipe Form ───────────────────────────────────────────────────────────

function AddRecipeForm({ onSave, onCancel }: { onSave: (r: Omit<Recipe, "id" | "createdAt">) => void; onCancel: () => void }) {
  const [title, setTitle]         = useState("");
  const [desc, setDesc]           = useState("");
  const [ingLine, setIngLine]     = useState("");
  const [stepLine, setStepLine]   = useState("");
  const [photos, setPhotos]       = useState<string[]>([]);
  const [tagInput, setTagInput]   = useState("");
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [rating, setRating]       = useState(0);
  const [servings, setServings]   = useState("");
  const [calories, setCalories]   = useState("");
  const [protein, setProtein]     = useState("");
  const [carbs, setCarbs]         = useState("");
  const [fat, setFat]             = useState("");
  const [urlInput, setUrlInput]   = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const { url } = await res.json();
        if (url) setPhotos((p) => [...p, url]);
      } catch {}
    }
    setUploading(false);
  }

  function addUrl() {
    const u = urlInput.trim();
    if (u) { setPhotos((p) => [...p, u]); setUrlInput(""); }
  }

  function toggleDietary(tag: string) {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function submit() {
    if (!title.trim()) return;
    const ingredients = ingLine.split("\n").map((s) => s.trim()).filter(Boolean);
    const steps = stepLine.split("\n").map((s) => s.trim()).filter(Boolean);
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({
      title: title.trim(),
      description: desc.trim() || undefined,
      ingredients, steps, photos, tags, dietaryTags,
      rating: rating || undefined,
      servings: servings ? Number(servings) : undefined,
      caloriesPerServing: calories ? Number(calories) : undefined,
      protein: protein ? Number(protein) : undefined,
      carbs: carbs ? Number(carbs) : undefined,
      fat: fat ? Number(fat) : undefined,
    });
  }

  const inputStyle = {
    background: "#F7EDD8",
    border: "1px solid rgba(201,183,156,0.5)",
    borderRadius: "10px",
    color: "#342A21",
    padding: "8px 12px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  const numInput = (label: string, val: string, set: (v: string) => void, unit = "") => (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>{label}{unit && <span className="ml-0.5 font-normal">({unit})</span>}</p>
      <input type="number" min="0" style={{ ...inputStyle }} placeholder="0" value={val} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: "#FAF3E8", border: "1px solid rgba(201,183,156,0.4)", boxShadow: "0 4px 20px rgba(52,42,33,0.10)" }}>
      <h3 className="font-serif text-2xl mb-5" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        Add Recipe
      </h3>
      <div className="space-y-4">
        <input style={inputStyle} placeholder="Recipe title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inputStyle, resize: "none", minHeight: "60px" }} placeholder="Short description…" value={desc} onChange={(e) => setDesc(e.target.value)} />

        {/* Photos */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#A8967E" }}>Photos</p>
          <div className="flex gap-2 flex-wrap mb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos((a) => a.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(52,42,33,0.7)" }}>
                  <X size={9} color="white" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
              <Camera size={13} /> {uploading ? "Uploading…" : "Upload"}
            </button>
            <div className="flex flex-1 gap-1">
              <input style={{ ...inputStyle, padding: "7px 10px", fontSize: "13px" }} placeholder="Paste image URL…"
                value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()} />
              <button type="button" onClick={addUrl} className="px-2.5 rounded-lg"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
                <LinkIcon size={13} />
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
        </div>

        {/* Dietary tags */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#A8967E" }}>Dietary</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((tag) => {
              const on = dietaryTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleDietary(tag)}
                  className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                  style={{ background: on ? "#71816D" : "rgba(113,129,109,0.10)", color: on ? "white" : "#71816D" }}>
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Servings + nutrition */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {numInput("Servings", servings, setServings)}
          {numInput("Calories", calories, setCalories, "per serving")}
          {numInput("Protein", protein, setProtein, "g")}
          {numInput("Carbs", carbs, setCarbs, "g")}
          {numInput("Fat", fat, setFat, "g")}
        </div>

        {/* Ingredients */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>
            Ingredients <span className="font-normal">(one per line — use ALL CAPS line for a section header)</span>
          </p>
          <textarea
            style={{ ...inputStyle, resize: "none", minHeight: "120px", fontFamily: "monospace", fontSize: "13px" }}
            placeholder={"CHICKEN:\n2 chicken breasts\n1 tbsp olive oil\n\nSOUP:\n4 cups chicken broth\n2 cups egg noodles"}
            value={ingLine}
            onChange={(e) => setIngLine(e.target.value)}
          />
        </div>

        {/* Steps */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>Steps <span className="font-normal">(one per line)</span></p>
          <textarea
            style={{ ...inputStyle, resize: "none", minHeight: "100px" }}
            placeholder={"Season and sear the chicken until golden.\nMake the sauce in the same pan…"}
            value={stepLine}
            onChange={(e) => setStepLine(e.target.value)}
          />
        </div>

        {/* Rating + tags */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>Rating</p>
            <SerifRating value={rating} onChange={setRating} />
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>Tags</p>
            <input style={{ ...inputStyle, padding: "6px 10px", fontSize: "13px" }} placeholder="quick, cozy, date-night…"
              value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={!title.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#71816D" }}>
            Save Recipe
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: "#A8967E" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RecipeVault({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [adding, setAdding]         = useState(false);
  const [selected, setSelected]     = useState<Recipe | null>(null);

  function saveRecipe(r: Omit<Recipe, "id" | "createdAt">) {
    const entry: Recipe = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    onUpdate({ ...nutrition, recipes: [entry, ...nutrition.recipes] });
    setAdding(false);
  }

  function deleteRecipe(id: string) {
    onUpdate({ ...nutrition, recipes: nutrition.recipes.filter((r) => r.id !== id) });
    if (selected?.id === id) setSelected(null);
  }

  function addToGrocery(recipeId: string, ingredients: string[]) {
    const newItems: GroceryItem[] = ingredients.map((name) => ({
      id: crypto.randomUUID(),
      name,
      section: assignGrocerySection(name),
      checked: false,
      addedAt: new Date().toISOString(),
      fromRecipeId: recipeId,
    }));
    onUpdate({ ...nutrition, groceryItems: [...nutrition.groceryItems, ...newItems] });
  }

  // Detail view
  if (selected) {
    return (
      <RecipeDetail
        recipe={selected}
        onBack={() => setSelected(null)}
        onDelete={() => deleteRecipe(selected.id)}
        onAddToGrocery={(ings) => addToGrocery(selected.id, ings)}
      />
    );
  }

  // Grid view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "rgba(52,42,33,0.45)" }}>
          {nutrition.recipes.length} recipe{nutrition.recipes.length !== 1 ? "s" : ""} saved
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "#71816D" }}>
            <Plus size={15} /> Add Recipe
          </button>
        )}
      </div>

      {adding && <AddRecipeForm onSave={saveRecipe} onCancel={() => setAdding(false)} />}

      {nutrition.recipes.length === 0 && !adding ? (
        <div className="text-center py-16" style={{ color: "rgba(52,42,33,0.4)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Your cookbook is empty
          </p>
          <p className="text-sm">Save a recipe to view it like a cookbook page — ingredients, steps, and nutrition all in one place.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nutrition.recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onClick={() => setSelected(r)}
              onDelete={() => deleteRecipe(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
