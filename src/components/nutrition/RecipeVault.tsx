"use client";

import { useState, useRef } from "react";
import { Plus, X, Camera, Link as LinkIcon, ChevronDown, ShoppingCart, ChevronUp } from "lucide-react";
import { Recipe, GroceryItem, NutritionData } from "@/types/dashboard";
import { assignGrocerySection } from "./groceryUtils";

function SerifRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className="font-serif text-xl leading-none transition-colors"
          style={{
            color: n <= (value || 0) ? "#DA667B" : "#A8967E",
            cursor: onChange ? "pointer" : "default",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function RecipeCard({
  recipe,
  onDelete,
  onAddToGrocery,
}: {
  recipe: Recipe;
  onDelete: () => void;
  onAddToGrocery: (ingredients: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "#FAF3E8",
        border: "1px solid rgba(201,183,156,0.35)",
        boxShadow: "0 3px 14px rgba(52,42,33,0.09)",
      }}
    >
      {recipe.photos.length > 0 && (
        <div className="w-full h-40 overflow-hidden">
          <img src={recipe.photos[0]} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-serif text-xl leading-tight"
            style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {recipe.title}
          </h3>
          <button onClick={onDelete} className="p-1 rounded-full hover:bg-cream-darker" style={{ color: "#A8967E" }}>
            <X size={13} />
          </button>
        </div>

        {recipe.rating != null && <SerifRating value={recipe.rating} />}

        {recipe.description && (
          <p className="text-xs mt-2 mb-3" style={{ color: "rgba(52,42,33,0.65)" }}>{recipe.description}</p>
        )}

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.map((t) => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(201,183,156,0.25)", color: "#71816D" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(52,42,33,0.06)", color: "#342A21" }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Hide" : "View"} Recipe
          </button>
          <button
            onClick={() => onAddToGrocery(recipe.ingredients)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-opacity"
            style={{ background: "#71816D" }}
          >
            <ShoppingCart size={13} /> Add to Grocery
          </button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4">
            {recipe.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#A8967E" }}>Ingredients</p>
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: "#342A21" }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#C9B79C" }} />
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#A8967E" }}>Steps</p>
                <ol className="space-y-2">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="text-sm flex gap-3" style={{ color: "#342A21" }}>
                      <span
                        className="font-serif text-base flex-shrink-0 leading-tight"
                        style={{ color: "#DA667B", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                      >
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddRecipeForm({ onSave, onCancel }: { onSave: (r: Omit<Recipe, "id" | "createdAt">) => void; onCancel: () => void }) {
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [ingLine, setIngLine]   = useState("");
  const [stepLine, setStepLine] = useState("");
  const [photos, setPhotos]     = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [rating, setRating]     = useState(0);
  const [urlInput, setUrlInput] = useState("");
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

  function submit() {
    if (!title.trim()) return;
    const ingredients = ingLine.split("\n").map((s) => s.trim()).filter(Boolean);
    const steps = stepLine.split("\n").map((s) => s.trim()).filter(Boolean);
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ title: title.trim(), description: desc.trim() || undefined, ingredients, steps, photos, tags, rating: rating || undefined });
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

  return (
    <div
      className="rounded-2xl p-5 mb-6"
      style={{ background: "#FAF3E8", border: "1px solid rgba(201,183,156,0.4)", boxShadow: "0 4px 20px rgba(52,42,33,0.10)" }}
    >
      <h3 className="font-serif text-xl mb-4" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        Add Recipe
      </h3>
      <div className="space-y-3">
        <input style={inputStyle} placeholder="Recipe title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inputStyle, resize: "none", minHeight: "60px" }} placeholder="Short description…" value={desc} onChange={(e) => setDesc(e.target.value)} />

        <textarea
          style={{ ...inputStyle, resize: "none", minHeight: "100px" }}
          placeholder={"Ingredients (one per line)\n1 cup flour\n2 eggs…"}
          value={ingLine}
          onChange={(e) => setIngLine(e.target.value)}
        />
        <textarea
          style={{ ...inputStyle, resize: "none", minHeight: "100px" }}
          placeholder={"Steps (one per line)\nPreheat oven to 350°F\nMix dry ingredients…"}
          value={stepLine}
          onChange={(e) => setStepLine(e.target.value)}
        />

        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>Photos</p>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
              <Camera size={13} /> {uploading ? "Uploading…" : "Upload"}
            </button>
            <div className="flex flex-1 gap-1">
              <input style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }} placeholder="Paste image URL…"
                value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()} />
              <button type="button" onClick={addUrl} className="px-2 rounded-lg"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
                <LinkIcon size={13} />
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
        </div>

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>Rating</p>
          <SerifRating value={rating} onChange={setRating} />
        </div>

        <input style={inputStyle} placeholder="Tags, comma-separated…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={!title.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#71816D" }}>
            Save Recipe
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ color: "#A8967E" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecipeVault({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [adding, setAdding] = useState(false);

  function saveRecipe(r: Omit<Recipe, "id" | "createdAt">) {
    const entry: Recipe = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    onUpdate({ ...nutrition, recipes: [entry, ...nutrition.recipes] });
    setAdding(false);
  }

  function deleteRecipe(id: string) {
    onUpdate({ ...nutrition, recipes: nutrition.recipes.filter((r) => r.id !== id) });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: "rgba(52,42,33,0.5)" }}>
          {nutrition.recipes.length} recipe{nutrition.recipes.length !== 1 ? "s" : ""} saved
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "#71816D" }}
          >
            <Plus size={15} /> Add Recipe
          </button>
        )}
      </div>

      {adding && <AddRecipeForm onSave={saveRecipe} onCancel={() => setAdding(false)} />}

      {nutrition.recipes.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(52,42,33,0.4)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Your cookbook is empty
          </p>
          <p className="text-sm">Save a recipe and add its ingredients straight to your grocery list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nutrition.recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onDelete={() => deleteRecipe(r.id)}
              onAddToGrocery={(ings) => addToGrocery(r.id, ings)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
