"use client";

import { useState, useRef } from "react";
import { Plus, X, Camera, Link as LinkIcon, ChevronDown } from "lucide-react";
import { MealEntry, NutritionData } from "@/types/dashboard";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const TYPE_COLORS: Record<string, string> = {
  breakfast: "#C99A5C",
  lunch:     "#71816D",
  dinner:    "#342A21",
  snack:     "#C9B79C",
};

function SerifRating({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => !readonly && onChange?.(n)}
          className="font-serif text-xl leading-none transition-colors"
          style={{
            color: n <= value ? "#DA667B" : "#A8967E",
            cursor: readonly ? "default" : "pointer",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function MealCard({ meal, onDelete }: { meal: MealEntry; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);

  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div
      className="break-inside-avoid mb-4 rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "#FAF3E8",
        border: "1px solid rgba(201,183,156,0.35)",
        boxShadow: hovered
          ? "0 8px 28px rgba(52,42,33,0.14)"
          : "0 3px 14px rgba(52,42,33,0.09)",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {meal.photos.length > 0 && (
        <div className="relative w-full" style={{ aspectRatio: meal.photos.length === 1 ? "4/3" : "16/9" }}>
          <img
            src={meal.photos[0]}
            alt={meal.name}
            className="w-full h-full object-cover"
          />
          {meal.photos.length > 1 && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              {meal.photos.slice(1, 4).map((p, i) => (
                <div key={i} className="w-8 h-8 rounded-md overflow-hidden border border-white/60">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-serif text-lg leading-tight"
            style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {meal.name}
          </h3>
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-cream-darker transition-all"
            style={{ color: "#A8967E" }}
            title="Delete"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
            style={{ background: TYPE_COLORS[meal.mealType] + "22", color: TYPE_COLORS[meal.mealType] }}
          >
            {meal.mealType}
          </span>
          <span className="text-[11px]" style={{ color: "#A8967E" }}>{fmt(meal.date)}</span>
        </div>

        <SerifRating value={meal.rating} readonly />

        {meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.tags.map((t) => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(201,183,156,0.25)", color: "#71816D" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {meal.notes && (
          <p className="text-xs mt-2 italic" style={{ color: "rgba(52,42,33,0.6)" }}>
            &ldquo;{meal.notes}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

function AddMealForm({
  onSave,
  onCancel,
}: {
  onSave: (m: Omit<MealEntry, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName]         = useState("");
  const [mealType, setMealType] = useState<MealEntry["mealType"]>("breakfast");
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos]     = useState<string[]>([]);
  const [rating, setRating]     = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes]       = useState("");
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
    if (!name.trim()) return;
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ name: name.trim(), mealType, date, photos, rating, tags, notes: notes.trim() || undefined });
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
        Log a Meal
      </h3>

      <div className="space-y-3">
        <input
          style={inputStyle}
          placeholder="Meal name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <select
              style={{ ...inputStyle, appearance: "none", paddingRight: "32px" }}
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealEntry["mealType"])}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8967E" }} />
          </div>
          <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Photos */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#A8967E" }}>Photos</p>
          <div className="flex gap-2 flex-wrap mb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(52,42,33,0.7)" }}
                >
                  <X size={9} color="white" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}
            >
              <Camera size={13} /> {uploading ? "Uploading…" : "Upload"}
            </button>
            <div className="flex flex-1 gap-1">
              <input
                style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
                placeholder="Paste image URL…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
              />
              <button
                type="button"
                onClick={addUrl}
                className="px-2 rounded-lg transition-colors"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}
              >
                <LinkIcon size={13} />
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
        </div>

        {/* Rating */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>Rating</p>
          <SerifRating value={rating} onChange={setRating} />
        </div>

        <input
          style={inputStyle}
          placeholder="Tags, comma-separated (healthy, quick, comfort food…)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />

        <textarea
          style={{ ...inputStyle, resize: "none", minHeight: "72px" }}
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: "#71816D" }}
          >
            Save Meal
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#A8967E" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function MealLog({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  function saveMeal(m: Omit<MealEntry, "id" | "createdAt">) {
    const entry: MealEntry = { ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    onUpdate({ ...nutrition, meals: [entry, ...nutrition.meals] });
    setAdding(false);
  }

  function deleteMeal(id: string) {
    onUpdate({ ...nutrition, meals: nutrition.meals.filter((m) => m.id !== id) });
  }

  const filtered = filter === "all"
    ? nutrition.meals
    : nutrition.meals.filter((m) => m.mealType === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {["all", ...MEAL_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-xs px-3 py-1 rounded-full font-medium capitalize transition-all"
              style={{
                background: filter === t ? "#71816D" : "rgba(113,129,109,0.10)",
                color:      filter === t ? "white"   : "#71816D",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity"
            style={{ background: "#71816D" }}
          >
            <Plus size={15} /> Log Meal
          </button>
        )}
      </div>

      {adding && <AddMealForm onSave={saveMeal} onCancel={() => setAdding(false)} />}

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(52,42,33,0.4)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Nothing logged yet
          </p>
          <p className="text-sm">Tap &ldquo;Log Meal&rdquo; to capture your first entry.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="group">
              <MealCard meal={m} onDelete={() => deleteMeal(m.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
