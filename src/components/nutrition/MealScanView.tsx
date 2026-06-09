"use client";

import { useState, useRef } from "react";
import { Camera, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { id } from "@/lib/utils";

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calPerG: number;
  protPerG: number;
  carbPerG: number;
  fatPerG: number;
  fibPerG: number;
}

interface MealResult {
  mealName: string;
  ingredients: Ingredient[];
  cookingNotes: string;
  totalNote: string;
}

const PURPLE = "#9B7FFF";
const GOLD = "#E8C547";
const PEACH = "#E8A87C";
const ROSE = "#DA667B";
const GREEN = "#4ECDC4";

function toIngredient(raw: { name: string; amount: string; grams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number }): Ingredient {
  const g = Math.max(raw.grams, 1);
  return {
    id: id(),
    name: raw.name,
    amount: raw.amount,
    grams: g,
    calories: raw.calories,
    protein: raw.protein,
    carbs: raw.carbs,
    fat: raw.fat,
    fiber: raw.fiber ?? 0,
    calPerG: raw.calories / g,
    protPerG: raw.protein / g,
    carbPerG: raw.carbs / g,
    fatPerG: raw.fat / g,
    fibPerG: (raw.fiber ?? 0) / g,
  };
}

function recalc(ing: Ingredient, newGrams: number): Ingredient {
  const g = Math.max(newGrams, 1);
  return {
    ...ing,
    grams: g,
    calories: Math.round(ing.calPerG * g),
    protein: Math.round(ing.protPerG * g * 10) / 10,
    carbs: Math.round(ing.carbPerG * g * 10) / 10,
    fat: Math.round(ing.fatPerG * g * 10) / 10,
    fiber: Math.round(ing.fibPerG * g * 10) / 10,
  };
}

function totals(ingredients: Ingredient[]) {
  return ingredients.reduce((acc, i) => ({
    calories: acc.calories + i.calories,
    protein: acc.protein + i.protein,
    carbs: acc.carbs + i.carbs,
    fat: acc.fat + i.fat,
    fiber: acc.fiber + i.fiber,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

function MacroBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs w-10 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(124,92,252,0.1)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs font-semibold w-10 text-right flex-shrink-0" style={{ color }}>{Math.round(value)}g</p>
    </div>
  );
}

function IngredientRow({ ing, onUpdate, onDelete }: {
  ing: Ingredient;
  onUpdate: (updated: Ingredient) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [gramInput, setGramInput] = useState(String(ing.grams));
  const [nameInput, setNameInput] = useState(ing.name);

  const save = () => {
    const g = parseFloat(gramInput);
    if (!isNaN(g) && g > 0) {
      onUpdate(recalc({ ...ing, name: nameInput.trim() || ing.name }, g));
    }
    setEditing(false);
  };

  const cancel = () => {
    setGramInput(String(ing.grams));
    setNameInput(ing.name);
    setEditing(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(124,92,252,0.04)", border: "1px solid rgba(124,92,252,0.1)" }}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="w-full text-xs font-semibold px-2 py-1 rounded-lg outline-none"
              style={{ background: "rgba(124,92,252,0.1)", color: "var(--text)", border: "1px solid rgba(124,92,252,0.2)" }}
            />
          ) : (
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{ing.name}</p>
          )}
          {!editing && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{ing.amount}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: GOLD }}>{ing.calories}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>kcal</p>
        </div>
        {editing ? (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={save} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(78,205,196,0.15)", color: GREEN }}>
              <Check size={13} />
            </button>
            <button onClick={cancel} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(218,102,123,0.1)", color: ROSE }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,92,252,0.08)", color: PURPLE }}>
              <Edit2 size={12} />
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(218,102,123,0.08)", color: ROSE }}>
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Gram editor */}
      {editing && (
        <div className="px-3 pb-2.5 flex items-center gap-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Grams:</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setGramInput(g => String(Math.max(1, (parseFloat(g) || 0) - 10)))}
              className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
              style={{ background: "rgba(124,92,252,0.1)", color: PURPLE }}>−</button>
            <input type="number" value={gramInput} onChange={e => setGramInput(e.target.value)}
              className="w-16 text-xs text-center px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "rgba(124,92,252,0.1)", color: "var(--text)", border: "1px solid rgba(124,92,252,0.2)" }} />
            <button onClick={() => setGramInput(g => String((parseFloat(g) || 0) + 10))}
              className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
              style={{ background: "rgba(124,92,252,0.1)", color: PURPLE }}>+</button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>g → {Math.round((ing.calPerG || 0) * (parseFloat(gramInput) || 0))} kcal</p>
        </div>
      )}

      {/* Macro mini-row */}
      {!editing && (
        <div className="flex gap-3 px-3 pb-2.5">
          {[
            { label: "P", value: ing.protein, color: PURPLE },
            { label: "C", value: ing.carbs, color: GOLD },
            { label: "F", value: ing.fat, color: PEACH },
            { label: "Fi", value: ing.fiber, color: GREEN },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="text-xs" style={{ color: m.color }}>{m.value.toFixed(1)}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddIngredientForm({ onAdd, onCancel }: { onAdd: (ing: Ingredient) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [manualFields, setManualFields] = useState({ calories: "", protein: "", carbs: "", fat: "", fiber: "", grams: "" });

  const lookup = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/meal/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), amount: amount.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Lookup failed");
      onAdd(toIngredient(json.ingredient));
    } catch {
      setError("Could not look up — try entering manually");
      setManual(true);
    } finally {
      setLoading(false);
    }
  };

  const addManual = () => {
    const g = parseFloat(manualFields.grams) || 100;
    const raw = {
      name: name.trim() || "Custom item",
      amount: amount.trim() || `${g}g`,
      grams: g,
      calories: parseFloat(manualFields.calories) || 0,
      protein: parseFloat(manualFields.protein) || 0,
      carbs: parseFloat(manualFields.carbs) || 0,
      fat: parseFloat(manualFields.fat) || 0,
      fiber: parseFloat(manualFields.fiber) || 0,
    };
    onAdd(toIngredient(raw));
  };

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.15)" }}>
      <p className="text-xs font-semibold" style={{ color: PURPLE }}>Add Ingredient</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Food name"
          className="text-xs px-3 py-2 rounded-xl outline-none"
          style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.15)", color: "var(--text)" }} />
        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (e.g. 1 cup)"
          className="text-xs px-3 py-2 rounded-xl outline-none"
          style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.15)", color: "var(--text)" }} />
      </div>

      {!manual && (
        <div className="flex gap-2">
          <button onClick={lookup} disabled={loading || !name.trim()}
            className="flex-1 text-xs py-2 rounded-xl font-semibold disabled:opacity-40"
            style={{ background: "rgba(124,92,252,0.15)", color: PURPLE }}>
            {loading ? "Looking up…" : "Look Up Macros"}
          </button>
          <button onClick={() => setManual(true)} className="text-xs px-3 py-2 rounded-xl"
            style={{ background: "rgba(124,92,252,0.06)", color: "var(--text-muted)" }}>
            Manual
          </button>
          <button onClick={onCancel} className="text-xs px-3 py-2 rounded-xl"
            style={{ color: "var(--text-muted)" }}>
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: ROSE }}>{error}</p>}

      {manual && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "grams", label: "Grams", color: "var(--text-muted)" },
              { key: "calories", label: "Calories", color: GOLD },
              { key: "protein", label: "Protein (g)", color: PURPLE },
              { key: "carbs", label: "Carbs (g)", color: GOLD },
              { key: "fat", label: "Fat (g)", color: PEACH },
              { key: "fiber", label: "Fiber (g)", color: GREEN },
            ].map(f => (
              <div key={f.key}>
                <p className="text-xs mb-1" style={{ color: f.color }}>{f.label}</p>
                <input type="number" value={manualFields[f.key as keyof typeof manualFields]}
                  onChange={e => setManualFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.12)", color: "var(--text)" }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addManual} className="flex-1 text-xs py-2 rounded-xl font-semibold"
              style={{ background: "rgba(124,92,252,0.15)", color: PURPLE }}>
              Add
            </button>
            <button onClick={onCancel} className="text-xs px-3 py-2 rounded-xl"
              style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function MealScanView() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [meal, setMeal] = useState<MealResult | null>(null);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setPhoto(dataUrl);
      runScan(dataUrl.split(",")[1], file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const runScan = async (base64: string, mime: string) => {
    setScanning(true);
    setError("");
    setMeal(null);
    try {
      const res = await fetch("/api/meal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMeal({
        mealName: json.meal.mealName,
        ingredients: json.meal.ingredients.map(toIngredient),
        cookingNotes: json.meal.cookingNotes ?? "",
        totalNote: json.meal.totalNote ?? "",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const updateIngredient = (idx: number, updated: Ingredient) => {
    setMeal(m => m ? { ...m, ingredients: m.ingredients.map((ing, i) => i === idx ? updated : ing) } : m);
  };

  const deleteIngredient = (idx: number) => {
    setMeal(m => m ? { ...m, ingredients: m.ingredients.filter((_, i) => i !== idx) } : m);
  };

  const addIngredient = (ing: Ingredient) => {
    setMeal(m => m ? { ...m, ingredients: [...m.ingredients, ing] } : m);
    setShowAddForm(false);
  };

  const reset = () => {
    setPhoto(null);
    setMeal(null);
    setError("");
    setShowAddForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const t = meal ? totals(meal.ingredients) : null;
  const proteinCals = t ? t.protein * 4 : 0;
  const carbCals = t ? t.carbs * 4 : 0;
  const fatCals = t ? t.fat * 9 : 0;
  const totalCals = t ? t.calories : 0;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>MEAL SCANNER</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Photo → calories + macros, high-end estimate</p>
            </div>
            {meal && (
              <button onClick={reset} className="text-xs px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(124,92,252,0.08)", color: "var(--text-muted)" }}>
                New scan
              </button>
            )}
          </div>
        </div>

        {!photo && !scanning && (
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-3 py-10 hover:bg-purple-50/5 transition-colors">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(124,92,252,0.1)", border: "1.5px dashed rgba(124,92,252,0.3)" }}>
              <Camera size={24} style={{ color: PURPLE }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Photo your meal</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tap to upload or take a photo</p>
            </div>
          </button>
        )}

        {photo && scanning && (
          <div className="flex flex-col items-center gap-4 py-10">
            <img src={photo} alt="Scanning" className="w-24 h-20 rounded-xl object-cover opacity-70" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: PURPLE, animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Identifying ingredients…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 pb-4">
            <p className="text-xs text-center py-3 rounded-xl" style={{ background: "rgba(218,102,123,0.08)", color: ROSE }}>{error}</p>
            <button onClick={reset} className="w-full text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>Try again</button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </div>

      {/* Results */}
      {meal && t && (
        <>
          {/* Totals card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
            <div className="p-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
              {photo && <img src={photo} alt="Meal" className="w-full h-32 object-cover rounded-xl mb-3" />}
              <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>{meal.mealName}</p>
              {meal.cookingNotes && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{meal.cookingNotes}</p>
              )}
            </div>

            {/* Big calorie number */}
            <div className="p-4 text-center" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>TOTAL CALORIES</p>
              <p className="text-4xl font-bold" style={{ color: GOLD }}>{Math.round(totalCals)}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>High-end estimate</p>
            </div>

            {/* Macro bars */}
            <div className="px-4 py-3 space-y-2.5" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
              <MacroBar label="Protein" value={t.protein} total={t.protein + t.carbs + t.fat} color={PURPLE} />
              <MacroBar label="Carbs" value={t.carbs} total={t.protein + t.carbs + t.fat} color={GOLD} />
              <MacroBar label="Fat" value={t.fat} total={t.protein + t.carbs + t.fat} color={PEACH} />
              <MacroBar label="Fiber" value={t.fiber} total={Math.max(t.fiber * 3, 1)} color={GREEN} />
            </div>

            {/* Calorie split */}
            <div className="grid grid-cols-3 gap-0" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
              {[
                { label: "Protein", cals: proteinCals, grams: t.protein, color: PURPLE },
                { label: "Carbs", cals: carbCals, grams: t.carbs, color: GOLD },
                { label: "Fat", cals: fatCals, grams: t.fat, color: PEACH },
              ].map((m, i) => (
                <div key={m.label} className={`py-3 text-center ${i < 2 ? "border-r border-[rgba(124,92,252,0.1)]" : ""}`}>
                  <p className="text-sm font-bold" style={{ color: m.color }}>{Math.round(m.grams)}g</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{Math.round(m.cals)} kcal</p>
                </div>
              ))}
            </div>

            {meal.totalNote && (
              <p className="text-xs px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{meal.totalNote}</p>
            )}
          </div>

          {/* Ingredients */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>INGREDIENTS</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Edit grams to recalculate. Tap ✏ to adjust.</p>
              </div>
              <button onClick={() => setShowAddForm(v => !v)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ background: "rgba(124,92,252,0.12)", color: PURPLE }}>
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="p-3 space-y-2">
              {showAddForm && (
                <AddIngredientForm onAdd={addIngredient} onCancel={() => setShowAddForm(false)} />
              )}

              {meal.ingredients.map((ing, i) => (
                <IngredientRow
                  key={ing.id}
                  ing={ing}
                  onUpdate={updated => updateIngredient(i, updated)}
                  onDelete={() => deleteIngredient(i)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
