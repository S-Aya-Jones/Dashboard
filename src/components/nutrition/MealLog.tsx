"use client";

import { useState, useRef } from "react";
import { Plus, X, Camera, Link as LinkIcon, ChevronDown, ArrowLeft } from "lucide-react";
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
            color: n <= value ? "#DA667B" : "#C9B79C",
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

// ── Meal Detail View ──────────────────────────────────────────────────────────

function MealDetail({ meal, onBack, onDelete }: { meal: MealEntry; onBack: () => void; onDelete: () => void }) {
  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#71816D" }}>
          <ArrowLeft size={16} /> All Meals
        </button>
        <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: "#DA667B", background: "rgba(218,102,123,0.08)" }}>
          Delete
        </button>
      </div>

      {meal.photos.length > 0 && (
        <div className="w-full rounded-3xl overflow-hidden mb-8" style={{ maxHeight: "480px" }}>
          <img src={meal.photos[0]} alt={meal.name} className="w-full h-full object-cover" style={{ maxHeight: "480px" }} />
        </div>
      )}

      {meal.photos.length > 1 && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {meal.photos.slice(1).map((p, i) => (
            <div key={i} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden">
              <img src={p} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="text-center mb-6 max-w-lg mx-auto">
        <h1 className="font-serif mb-3"
          style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.1 }}>
          {meal.name}
        </h1>
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-sm font-medium px-3 py-1 rounded-full capitalize"
            style={{ background: TYPE_COLORS[meal.mealType] + "22", color: TYPE_COLORS[meal.mealType] }}>
            {meal.mealType}
          </span>
          <span className="text-sm" style={{ color: "#A8967E" }}>{fmt(meal.date)}</span>
        </div>
        <SerifRating value={meal.rating} readonly />
      </div>

      {meal.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {meal.tags.map((t) => (
            <span key={t} className="text-sm px-3 py-1 rounded-full" style={{ background: "rgba(201,183,156,0.2)", color: "#71816D" }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {meal.notes && (
        <div className="max-w-lg mx-auto rounded-2xl p-5 text-center"
          style={{ background: "rgba(201,183,156,0.12)", border: "1px solid rgba(201,183,156,0.3)" }}>
          <p className="text-sm italic leading-relaxed" style={{ color: "rgba(52,42,33,0.7)" }}>
            &ldquo;{meal.notes}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ── Masonry Card ──────────────────────────────────────────────────────────────

function MealCard({ meal, onClick, onDelete }: { meal: MealEntry; onClick: () => void; onDelete: () => void }) {
  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div
      className="group break-inside-avoid mb-4 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "#FAF3E8",
        border: "1px solid rgba(201,183,156,0.35)",
        boxShadow: "0 3px 14px rgba(52,42,33,0.09)",
      }}
      onClick={onClick}
    >
      {meal.photos.length > 0 ? (
        <div className="relative w-full overflow-hidden" style={{ minHeight: "180px" }}>
          <img
            src={meal.photos[0]}
            alt={meal.name}
            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Type badge on photo */}
          <span
            className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize backdrop-blur-sm"
            style={{ background: "rgba(250,243,232,0.88)", color: TYPE_COLORS[meal.mealType] }}
          >
            {meal.mealType}
          </span>
          {meal.photos.length > 1 && (
            <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(52,42,33,0.55)", color: "white" }}>
              +{meal.photos.length - 1}
            </span>
          )}
          {/* Delete on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(52,42,33,0.65)" }}
          >
            <X size={11} color="white" />
          </button>
        </div>
      ) : (
        <div className="w-full flex items-center justify-center relative" style={{ height: "100px", background: "rgba(201,183,156,0.18)" }}>
          <span className="text-3xl">🍽️</span>
          <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{ background: "rgba(250,243,232,0.9)", color: TYPE_COLORS[meal.mealType] }}>
            {meal.mealType}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all"
            style={{ color: "#A8967E" }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-serif text-lg leading-tight"
            style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            {meal.name}
          </h3>
          <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: "#A8967E" }}>{fmt(meal.date)}</span>
        </div>

        <SerifRating value={meal.rating} readonly />

        {meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(201,183,156,0.25)", color: "#71816D" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {meal.notes && (
          <p className="text-xs mt-2 italic line-clamp-2" style={{ color: "rgba(52,42,33,0.55)" }}>
            &ldquo;{meal.notes}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ── Add Meal Form ─────────────────────────────────────────────────────────────

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
    <div className="rounded-2xl p-5 mb-6"
      style={{ background: "#FAF3E8", border: "1px solid rgba(201,183,156,0.4)", boxShadow: "0 4px 20px rgba(52,42,33,0.10)" }}>
      <h3 className="font-serif text-2xl mb-4" style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        Log a Meal
      </h3>

      <div className="space-y-3">
        <input style={inputStyle} placeholder="Meal name…" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <select style={{ ...inputStyle, appearance: "none", paddingRight: "32px" }}
              value={mealType} onChange={(e) => setMealType(e.target.value as MealEntry["mealType"])}>
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
                <button type="button"
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
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
              <input style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
                placeholder="Paste image URL…" value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
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

        {/* Rating */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "#A8967E" }}>Rating</p>
          <SerifRating value={rating} onChange={setRating} />
        </div>

        <input style={inputStyle} placeholder="Tags, comma-separated (healthy, quick, comfort food…)"
          value={tagInput} onChange={(e) => setTagInput(e.target.value)} />

        <textarea style={{ ...inputStyle, resize: "none", minHeight: "72px" }}
          placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={!name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#71816D" }}>
            Save Meal
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ color: "#A8967E" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MealLog({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [adding, setAdding]     = useState(false);
  const [filter, setFilter]     = useState<string>("all");
  const [selected, setSelected] = useState<MealEntry | null>(null);

  function saveMeal(m: Omit<MealEntry, "id" | "createdAt">) {
    const entry: MealEntry = { ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    onUpdate({ ...nutrition, meals: [entry, ...nutrition.meals] });
    setAdding(false);
  }

  function deleteMeal(id: string) {
    onUpdate({ ...nutrition, meals: nutrition.meals.filter((m) => m.id !== id) });
    if (selected?.id === id) setSelected(null);
  }

  // Detail view
  if (selected) {
    return (
      <MealDetail
        meal={selected}
        onBack={() => setSelected(null)}
        onDelete={() => deleteMeal(selected.id)}
      />
    );
  }

  const filtered = filter === "all"
    ? nutrition.meals
    : nutrition.meals.filter((m) => m.mealType === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2 flex-wrap">
          {["all", ...MEAL_TYPES].map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className="text-xs px-3 py-1 rounded-full font-medium capitalize transition-all"
              style={{
                background: filter === t ? "#71816D" : "rgba(113,129,109,0.10)",
                color:      filter === t ? "white"   : "#71816D",
              }}>
              {t}
            </button>
          ))}
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "#71816D" }}>
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
            <MealCard
              key={m.id}
              meal={m}
              onClick={() => setSelected(m)}
              onDelete={() => deleteMeal(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
