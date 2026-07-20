"use client";

import { useState, useRef } from "react";
import { Camera, Plus, Loader2, Flame, Dumbbell, ChevronDown } from "lucide-react";

interface Meal {
  id: string;
  name: string;
  mealType: string;
  photos: string[];
  calories?: number;
  protein?: number;
  aiDescription?: string;
}

interface FoodLoggerProps {
  date?: string;
  onMealAdded?: (totalCalories: number, totalProtein: number) => void;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export function FoodLogger({ date, onMealAdded }: FoodLoggerProps) {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>("snack");
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load today's meals on mount
  useState(() => {
    fetch(`/api/photos/food?date=${today}`)
      .then(r => r.json())
      .then(d => {
        setMeals(d.meals ?? []);
        setTotalCalories(d.totalCalories ?? 0);
        setTotalProtein(d.totalProtein ?? 0);
      })
      .catch(() => {});
  });

  async function handleFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    form.append("mealType", mealType);
    form.append("date", today);

    try {
      const res = await fetch("/api/photos/food", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMeals(prev => [...prev, data.meal]);
      setTotalCalories(data.todayTotals.calories);
      setTotalProtein(data.todayTotals.protein);
      onMealAdded?.(data.todayTotals.calories, data.todayTotals.protein);
    } catch (e) {
      alert("Upload failed: " + String(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      {/* Header with totals */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Food Log</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flame size={13} color="#FB923C" />
              <span className="text-sm font-bold" style={{ color: "#FB923C" }}>{totalCalories}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>cal</span>
            </div>
            <div className="flex items-center gap-1">
              <Dumbbell size={13} color="#A78BFA" />
              <span className="text-sm font-bold" style={{ color: "#A78BFA" }}>{totalProtein}g</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>protein</span>
            </div>
          </div>
        </div>

        {/* Meal photos grid */}
        {meals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {meals.map(meal => (
              <div key={meal.id} className="relative group">
                {meal.photos[0] && (
                  <img src={meal.photos[0]} alt={meal.name}
                    className="w-16 h-16 object-cover rounded-xl" />
                )}
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100">
                  <span className="text-[9px] text-white font-medium px-1 text-center leading-tight">{meal.name}</span>
                </div>
                {(meal.calories || meal.protein) && (
                  <div className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded-md text-[9px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #7C5CFC, #E879F9)" }}>
                    {meal.calories ? `${meal.calories}` : ""}{meal.protein ? `·${meal.protein}g` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload controls */}
        <div className="flex gap-2">
          {/* Meal type picker */}
          <div className="relative">
            <button onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "var(--bg)", color: "var(--text)" }}>
              {mealType}
              <ChevronDown size={12} />
            </button>
            {showTypeMenu && (
              <div className="absolute bottom-full mb-1 left-0 rounded-xl overflow-hidden shadow-lg z-10"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {MEAL_TYPES.map(t => (
                  <button key={t} onClick={() => { setMealType(t); setShowTypeMenu(false); }}
                    className="block w-full text-left px-3 py-2 text-xs capitalize transition-colors"
                    style={{ color: t === mealType ? "var(--purple)" : "var(--text)", background: t === mealType ? "var(--bg)" : "transparent" }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload button */}
          <button onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #7C5CFC, #E879F9)",
              color: "#fff",
              opacity: uploading ? 0.7 : 1,
            }}>
            {uploading ? (
              <><Loader2 size={13} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Camera size={13} /><Plus size={11} /> Add Food Photo</>
            )}
          </button>
        </div>
      </div>

      {/* Latest meal description */}
      {meals.length > 0 && meals[meals.length - 1].aiDescription && (
        <div className="px-4 pb-3">
          <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            Latest: {meals[meals.length - 1].aiDescription}
          </p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}
