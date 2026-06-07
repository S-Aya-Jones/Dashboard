"use client";

import { useState, useRef } from "react";
import { Plus, X, Camera, Link as LinkIcon, ArrowLeft, ShoppingCart, Minus, ImagePlus, Loader2 } from "lucide-react";
import { Recipe, GroceryItem, NutritionData } from "@/types/dashboard";
import { assignGrocerySection } from "./groceryUtils";

const DIETARY_OPTIONS = [
  "Egg-free", "Nut-free", "Dairy-free", "Gluten-free",
  "Vegan", "Vegetarian", "Low-carb", "High-protein",
];

// Detect a section-header line (e.g. "CHICKEN:" or "CHICKEN" all-caps)
function isHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.endsWith(":")) return true;
  return t === t.toUpperCase() && t.length < 35 && !/\d/.test(t);
}

function parseIngredients(lines: string[]) {
  return lines.map((line) => ({
    text: line.trim().replace(/:$/, ""),
    header: isHeader(line),
  }));
}

// ── Recipe Detail (Shetrition-style 2-col) ────────────────────────────────────

function RecipeDetail({
  recipe,
  onBack,
  onEdit,
  onDelete,
  onAddToGrocery,
  onUpdatePhotos,
}: {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToGrocery: (ings: string[]) => void;
  onUpdatePhotos: (photos: string[]) => void;
}) {
  const parsed = parseIngredients(recipe.ingredients);
  const itemLines = parsed.filter((l) => !l.header).map((l) => l.text);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput]   = useState("");
  const photoFileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    const newPhotos = [...recipe.photos];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const { url } = await res.json();
          if (url) newPhotos.push(url);
        }
      } catch {}
    }
    onUpdatePhotos(newPhotos);
    setUploadingPhoto(false);
  }

  function addPhotoUrl() {
    const u = photoUrlInput.trim();
    if (u) { onUpdatePhotos([...recipe.photos, u]); setPhotoUrlInput(""); }
  }

  // Local check-off state while cooking
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(new Set());
  // Serving count — per-portion nutrition is fixed; totals scale with count
  const baseServings = recipe.servings ?? 1;
  const [servings, setServings] = useState(baseServings);

  function toggleCheck(idx: number) {
    setCheckedIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  // Map item index for checkboxes (headers don't get an index)
  let itemCount = -1;

  // Per-portion values are fixed; totals scale with serving count
  const perCal     = recipe.caloriesPerServing ?? null;
  const totalCal     = perCal     ? perCal     * servings : null;
  const totalProtein = recipe.protein ? recipe.protein * servings : null;
  const totalCarbs   = recipe.carbs   ? recipe.carbs   * servings : null;
  const totalFat     = recipe.fat     ? recipe.fat     * servings : null;

  return (
    <div>
      {/* Back bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "#71816D" }}
        >
          <ArrowLeft size={16} /> All Recipes
        </button>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ color: "#71816D", background: "rgba(113,129,109,0.10)" }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: "#DA667B", background: "rgba(218,102,123,0.08)" }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* LEFT — sticky photo */}
        <div className="lg:sticky lg:top-8">
          {recipe.photos.length > 0 ? (
            <div
              className="w-full rounded-3xl overflow-hidden"
              style={{ background: "#E8D4B0" }}
            >
              <img
                src={recipe.photos[0]}
                alt={recipe.title}
                className="w-full object-cover"
                style={{ maxHeight: "560px", minHeight: "300px" }}
              />
              {recipe.photos.length > 1 && (
                <div className="flex gap-2 p-3">
                  {recipe.photos.slice(1, 4).map((p, i) => (
                    <div key={i} className="flex-1 rounded-xl overflow-hidden" style={{ height: "72px" }}>
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className="w-full rounded-3xl flex flex-col items-center justify-center gap-4"
              style={{ minHeight: "300px", background: "rgba(124,92,252,0.05)", border: "2px dashed var(--border)" }}
            >
              <span className="text-5xl">🍳</span>
              <p className="text-sm font-medium" style={{ color: "#A8967E" }}>Add a photo</p>
              <div className="flex flex-col gap-2 w-full px-6">
                <button
                  onClick={() => photoFileRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium w-full"
                  style={{ background: "#71816D", color: "var(--surface)" }}
                >
                  <Camera size={14} /> {uploadingPhoto ? "Uploading…" : "Upload photo"}
                </button>
                <div className="flex gap-2">
                  <input
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text)", padding: "7px 10px", fontSize: "13px", outline: "none" }}
                    placeholder="Or paste image URL…"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPhotoUrl()}
                  />
                  <button onClick={addPhotoUrl} className="px-3 rounded-xl text-sm font-medium" style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
                    Add
                  </button>
                </div>
              </div>
              <input ref={photoFileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => handlePhotoFile(e.target.files)} />
            </div>
          )}
        </div>

        {/* RIGHT — recipe details */}
        <div>
          {/* Title */}
          <h1
            className="font-serif leading-tight mb-3"
            style={{
              color: "var(--text)",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
            }}
          >
            {recipe.title}
          </h1>

          {/* Dietary tags */}
          {recipe.dietaryTags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.dietaryTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: "rgba(113,129,109,0.12)", color: "#71816D", border: "1px solid rgba(113,129,109,0.2)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {recipe.description && (
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {recipe.description}
            </p>
          )}

          {/* Serving controls + calorie bar */}
          <div
            className="flex items-center justify-between py-3 px-4 rounded-2xl mb-6"
            style={{ background: "rgba(124,92,252,0.05)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(124,92,252,0.06)", color: "var(--text)" }}
              >
                <Minus size={13} />
              </button>
              <div className="text-center">
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Makes {servings} {servings === 1 ? "portion" : "portions"}
                </span>
              </div>
              <button
                onClick={() => setServings((s) => s + 1)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(124,92,252,0.06)", color: "var(--text)" }}
              >
                <Plus size={13} />
              </button>
            </div>
            {perCal && (
              <span className="text-sm" style={{ color: "#A8967E" }}>
                Per portion:{" "}
                <span className="font-semibold" style={{ color: "var(--text)" }}>
                  {perCal} kcal
                </span>
              </span>
            )}
          </div>

          {/* Ingredients */}
          {recipe.ingredients.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#A8967E" }}
                >
                  Ingredients
                </h2>
                <button
                  onClick={() => onAddToGrocery(itemLines)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "#71816D", color: "var(--surface)" }}
                >
                  <ShoppingCart size={12} /> Add all to Grocery
                </button>
              </div>

              <div
                className="rounded-2xl overflow-hidden divide-y"
                style={{ border: "1px solid var(--border)" }}
              >
                {parsed.map((line, i) => {
                  if (line.header) {
                    return (
                      <div
                        key={i}
                        className="px-4 pt-3 pb-1.5"
                        style={{ background: "rgba(124,92,252,0.04)" }}
                      >
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "#A8967E" }}
                        >
                          {line.text}
                        </p>
                      </div>
                    );
                  }

                  itemCount++;
                  const idx = itemCount;
                  const done = checkedIdxs.has(idx);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleCheck(idx)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ background: done ? "rgba(124,92,252,0.04)" : "transparent" }}
                    >
                      {/* Custom checkbox */}
                      <div
                        className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
                        style={{
                          border: `1.5px solid ${done ? "#71816D" : "rgba(124,92,252,0.3)"}`,
                          background: done ? "#71816D" : "transparent",
                        }}
                      >
                        {done && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span
                        className="text-sm"
                        style={{
                          color: done ? "var(--text-light)" : "var(--text)",
                          textDecoration: done ? "line-through" : "none",
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
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#A8967E" }}>
                Instructions
              </h2>
              <div className="space-y-4">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ background: "#71816D", color: "var(--surface)" }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed pt-0.5" style={{ color: "var(--text)" }}>
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nutrition */}
          {(totalCal || totalProtein || totalCarbs || totalFat) && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#A8967E" }}>
                Nutrition
                <span className="normal-case font-normal ml-1.5" style={{ color: "var(--text-light)" }}>
                  · {servings} {servings === 1 ? "portion" : "portions"} total
                </span>
              </h2>
              <div
                className="grid grid-cols-4 rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                {[
                  { label: "Calories", val: totalCal,     unit: "kcal" },
                  { label: "Protein",  val: totalProtein, unit: "g" },
                  { label: "Fat",      val: totalFat,     unit: "g" },
                  { label: "Carbs",    val: totalCarbs,   unit: "g" },
                ].map(({ label, val, unit }, i) => val != null && (
                  <div
                    key={label}
                    className="py-4 px-2 text-center"
                    style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none", background: "var(--bg)" }}
                  >
                    <p
                      className="font-serif text-2xl leading-none mb-1"
                      style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {val}{unit !== "kcal" ? unit : ""}
                    </p>
                    <p className="text-[11px]" style={{ color: "#A8967E" }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(124,92,252,0.06)", color: "#71816D" }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recipe Grid Card ──────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onClick,
  onDelete,
}: {
  recipe: Recipe;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 3px 14px rgba(124,92,252,0.08)",
      }}
      onClick={onClick}
    >
      {recipe.photos.length > 0 ? (
        <div className="w-full overflow-hidden" style={{ height: "190px" }}>
          <img
            src={recipe.photos[0]}
            alt={recipe.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div
          className="w-full flex items-center justify-center"
          style={{ height: "120px", background: "rgba(124,92,252,0.05)" }}
        >
          <span className="text-4xl">🍳</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="font-serif text-lg leading-tight flex-1"
            style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {recipe.title}
          </h3>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all flex-shrink-0"
            style={{ color: "#A8967E" }}
          >
            <X size={13} />
          </button>
        </div>

        {recipe.dietaryTags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.dietaryTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(113,129,109,0.10)", color: "#71816D" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs" style={{ color: "#A8967E" }}>
            {recipe.servings && <span>{recipe.servings} portions</span>}
            {recipe.caloriesPerServing && recipe.servings && (
              <>
                <span style={{ color: "#D9CDBB" }}>·</span>
                <span>{recipe.caloriesPerServing} kcal/serving</span>
              </>
            )}
          </div>
          {recipe.rating != null && (
            <span className="font-serif text-base" style={{ color: "#DA667B", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              {"●".repeat(recipe.rating)}{"○".repeat(5 - recipe.rating)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Recipe Form ───────────────────────────────────────────────────────────

function SerifRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="font-serif text-xl leading-none transition-colors"
          style={{
            color: n <= value ? "#DA667B" : "var(--text-light)",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

interface RecipeDraft {
  title?: string;
  description?: string;
  ingredients?: string[];
  steps?: string[];
  photos?: string[];
  dietaryTags?: string[];
  tags?: string[];
  servings?: number;
  caloriesPerServing?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function AddRecipeForm({
  onSave,
  onCancel,
  initial = {},
  saveLabel = "Save Recipe",
}: {
  onSave: (r: Omit<Recipe, "id" | "createdAt">) => void;
  onCancel: () => void;
  initial?: RecipeDraft;
  saveLabel?: string;
}) {
  const [title, setTitle]         = useState(initial.title ?? "");
  const [desc, setDesc]           = useState(initial.description ?? "");
  const [ingLine, setIngLine]     = useState((initial.ingredients ?? []).join("\n"));
  const [stepLine, setStepLine]   = useState((initial.steps ?? []).join("\n"));
  const [photos, setPhotos]       = useState<string[]>(initial.photos ?? []);
  const [tagInput, setTagInput]   = useState((initial.tags ?? []).join(", "));
  const [dietaryTags, setDietaryTags] = useState<string[]>(initial.dietaryTags ?? []);
  const [rating, setRating]       = useState(0);
  const [servings, setServings]   = useState(initial.servings?.toString() ?? "");
  const [calories, setCalories]   = useState(initial.caloriesPerServing?.toString() ?? "");
  const [protein, setProtein]     = useState(initial.protein?.toString() ?? "");
  const [carbs, setCarbs]         = useState(initial.carbs?.toString() ?? "");
  const [fat, setFat]             = useState(initial.fat?.toString() ?? "");
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
      servings:          servings  ? Number(servings)  : undefined,
      caloriesPerServing: calories ? Number(calories)  : undefined,
      protein:           protein   ? Number(protein)   : undefined,
      carbs:             carbs     ? Number(carbs)     : undefined,
      fat:               fat       ? Number(fat)       : undefined,
    });
  }

  const inp: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--text)",
    padding: "8px 12px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div
      className="rounded-2xl p-6 mb-6"
      style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(124,92,252,0.08)" }}
    >
      <h3
        className="font-serif text-2xl mb-5"
        style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        Add Recipe
      </h3>

      <div className="space-y-4">
        <input style={inp} placeholder="Recipe title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inp, resize: "none", minHeight: "60px" }} placeholder="Short description…" value={desc} onChange={(e) => setDesc(e.target.value)} />

        {/* Photos */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#A8967E" }}>Photos</p>
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {photos.map((p, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((a) => a.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(124,92,252,0.65)" }}
                  >
                    <X size={9} color="white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}
            >
              <Camera size={13} /> {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <div className="flex flex-1 gap-1">
              <input
                style={{ ...inp, padding: "7px 10px", fontSize: "13px" }}
                placeholder="Or paste image URL…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
              />
              <button type="button" onClick={addUrl} className="px-2.5 rounded-lg"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}>
                <LinkIcon size={13} />
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
        </div>

        {/* Dietary */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#A8967E" }}>Dietary</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((tag) => {
              const on = dietaryTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleDietary(tag)}
                  className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                  style={{ background: on ? "#71816D" : "rgba(113,129,109,0.10)", color: on ? "var(--surface)" : "#71816D" }}>
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Servings + macros */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#A8967E" }}>Servings & Nutrition</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Servings",   val: servings,  set: setServings },
              { label: "Cal/serving",val: calories,  set: setCalories },
              { label: "Protein (g)", val: protein,  set: setProtein },
              { label: "Carbs (g)",  val: carbs,     set: setCarbs },
              { label: "Fat (g)",    val: fat,       set: setFat },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-[10px] mb-1" style={{ color: "#A8967E" }}>{label}</p>
                <input type="number" min="0" style={{ ...inp, padding: "6px 10px", fontSize: "13px" }}
                  placeholder="0" value={val} onChange={(e) => set(e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>
            Ingredients{" "}
            <span className="font-normal" style={{ color: "var(--text-light)" }}>
              — one per line. Write ALL CAPS or add a colon to create a section header (e.g. CHICKEN: or SOUP:)
            </span>
          </p>
          <textarea
            style={{ ...inp, resize: "none", minHeight: "130px", fontFamily: "ui-monospace, monospace", fontSize: "13px" }}
            placeholder={"CHICKEN:\n2 chicken breasts\n1 tbsp olive oil\n\nSOUP:\n4 cups chicken broth\n6 oz egg noodles"}
            value={ingLine}
            onChange={(e) => setIngLine(e.target.value)}
          />
        </div>

        {/* Steps */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>
            Instructions <span className="font-normal" style={{ color: "var(--text-light)" }}>— one step per line</span>
          </p>
          <textarea
            style={{ ...inp, resize: "none", minHeight: "110px" }}
            placeholder={"Season chicken and sear until golden.\nMake the cream sauce in the same pan.\nCombine and simmer until noodles are tender."}
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
            <input style={{ ...inp, padding: "6px 10px", fontSize: "13px" }}
              placeholder="cozy, quick, date-night…"
              value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: "#71816D", color: "var(--surface)" }}
          >
            {saveLabel}
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#A8967E" }}>
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
  const [editing, setEditing]       = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number } | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [draft, setDraft]           = useState<RecipeDraft | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function saveRecipe(r: Omit<Recipe, "id" | "createdAt">) {
    const entry: Recipe = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    onUpdate({ ...nutrition, recipes: [entry, ...nutrition.recipes] });
    setAdding(false);
    setDraft(null);
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

  async function handleImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setExtracting(true);
    setExtractError(null);
    setImportSummary(null);
    setExtractProgress({ current: 0, total: fileArr.length });

    const results: RecipeDraft[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      setExtractProgress({ current: i + 1, total: fileArr.length });

      // Upload screenshot as photo (optional)
      let photoUrl: string | null = null;
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) { const j = await res.json(); photoUrl = j.url ?? null; }
      } catch { /* skip */ }

      // Extract recipe
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/nutrition/extract-recipe", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        if (json.error) {
          errors.push(`${file.name}: ${json.error}`);
        } else {
          results.push({ ...json, photos: photoUrl ? [photoUrl] : [] } as RecipeDraft);
        }
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    setExtracting(false);
    setExtractProgress(null);
    if (errors.length > 0) setExtractError(errors.join(" · "));

    if (results.length === 1 && fileArr.length === 1) {
      // Single file → open pre-filled form for review
      setDraft(results[0]);
      setAdding(true);
    } else if (results.length > 0) {
      // Multiple → save all, show summary
      const newEntries: Recipe[] = results.map((r) => ({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title:              r.title        ?? "Untitled Recipe",
        description:        r.description,
        ingredients:        r.ingredients  ?? [],
        steps:              r.steps        ?? [],
        photos:             r.photos       ?? [],
        tags:               r.tags         ?? [],
        dietaryTags:        r.dietaryTags  ?? [],
        servings:           r.servings,
        caloriesPerServing: r.caloriesPerServing,
        protein:            r.protein,
        carbs:              r.carbs,
        fat:                r.fat,
      }));
      onUpdate({ ...nutrition, recipes: [...newEntries, ...nutrition.recipes] });
      setImportSummary(`${results.length} recipe${results.length !== 1 ? "s" : ""} imported successfully.`);
    }
  }

  if (selected) {
    const fresh = nutrition.recipes.find((r) => r.id === selected.id) ?? selected;

    if (editing) {
      return (
        <AddRecipeForm
          initial={{
            title:              fresh.title,
            description:        fresh.description,
            ingredients:        fresh.ingredients,
            steps:              fresh.steps,
            photos:             fresh.photos,
            tags:               fresh.tags,
            dietaryTags:        fresh.dietaryTags,
            servings:           fresh.servings,
            caloriesPerServing: fresh.caloriesPerServing,
            protein:            fresh.protein,
            carbs:              fresh.carbs,
            fat:                fresh.fat,
          }}
          saveLabel="Save Changes"
          onSave={(data) => {
            const updated: Recipe = { ...fresh, ...data };
            onUpdate({ ...nutrition, recipes: nutrition.recipes.map((r) => r.id === fresh.id ? updated : r) });
            setSelected(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      );
    }

    return (
      <RecipeDetail
        recipe={fresh}
        onBack={() => { setSelected(null); setEditing(false); }}
        onEdit={() => setEditing(true)}
        onDelete={() => deleteRecipe(fresh.id)}
        onAddToGrocery={(ings) => addToGrocery(fresh.id, ings)}
        onUpdatePhotos={(photos) => {
          onUpdate({ ...nutrition, recipes: nutrition.recipes.map((r) => r.id === fresh.id ? { ...r, photos } : r) });
          setSelected({ ...fresh, photos });
        }}
      />
    );
  }

  return (
    <div>
      <input
        ref={importRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleImport(e.target.files)}
      />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm" style={{ color: "var(--text-light)" }}>
          {nutrition.recipes.length} recipe{nutrition.recipes.length !== 1 ? "s" : ""} saved
        </p>
        {!adding && (
          <div className="flex gap-2">
            <button
              onClick={() => { importRef.current?.click(); }}
              disabled={extracting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D", border: "1px solid rgba(113,129,109,0.2)" }}
            >
              {extracting
                ? <><Loader2 size={15} className="animate-spin" />
                    {extractProgress
                      ? `Extracting ${extractProgress.current} of ${extractProgress.total}…`
                      : "Extracting…"}
                  </>
                : <><ImagePlus size={15} /> Import Screenshots</>
              }
            </button>
            <button
              onClick={() => { setDraft(null); setAdding(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#71816D", color: "var(--surface)" }}
            >
              <Plus size={15} /> Add Recipe
            </button>
          </div>
        )}
      </div>

      {/* Progress bar for mass import */}
      {extracting && extractProgress && extractProgress.total > 1 && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ background: "rgba(124,92,252,0.06)", height: "6px" }}>
          <div
            className="h-full rounded-xl transition-all duration-300"
            style={{ background: "#71816D", width: `${(extractProgress.current / extractProgress.total) * 100}%` }}
          />
        </div>
      )}

      {importSummary && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between"
          style={{ background: "rgba(113,129,109,0.10)", color: "#71816D", border: "1px solid rgba(113,129,109,0.2)" }}
        >
          ✓ {importSummary}
          <button onClick={() => setImportSummary(null)} className="ml-3 opacity-60 hover:opacity-100 text-xs">Dismiss</button>
        </div>
      )}

      {extractError && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(218,102,123,0.08)", color: "#DA667B", border: "1px solid rgba(218,102,123,0.2)" }}
        >
          {extractError}
          <button onClick={() => setExtractError(null)} className="ml-3 underline text-xs">Dismiss</button>
        </div>
      )}

      {adding && (
        <AddRecipeForm
          initial={draft ?? {}}
          onSave={saveRecipe}
          onCancel={() => { setAdding(false); setDraft(null); }}
        />
      )}

      {nutrition.recipes.length === 0 && !adding ? (
        <div className="text-center py-16" style={{ color: "var(--text-light)" }}>
          <p
            className="font-serif text-2xl mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Your cookbook is empty
          </p>
          <p className="text-sm">
            Save a recipe to open a full cookbook view — photo, checkable ingredients, steps, and nutrition.
          </p>
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
