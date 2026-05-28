"use client";

import { useState } from "react";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";
import { GroceryItem, NutritionData } from "@/types/dashboard";
import { assignGrocerySection, GROCERY_SECTIONS } from "./groceryUtils";

const SECTION_ICONS: Record<string, string> = {
  Produce:   "🥦",
  Dairy:     "🥛",
  Meat:      "🍗",
  Frozen:    "🧊",
  Pantry:    "🫙",
  Snacks:    "🍿",
  Beverages: "🧃",
  Other:     "🛒",
};

export function GroceryList({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [input, setInput] = useState("");

  function addItem() {
    const name = input.trim();
    if (!name) return;
    const item: GroceryItem = {
      id: crypto.randomUUID(),
      name,
      section: assignGrocerySection(name),
      checked: false,
      addedAt: new Date().toISOString(),
    };
    onUpdate({ ...nutrition, groceryItems: [...nutrition.groceryItems, item] });
    setInput("");
  }

  function toggle(id: string) {
    onUpdate({
      ...nutrition,
      groceryItems: nutrition.groceryItems.map((it) =>
        it.id === id ? { ...it, checked: !it.checked } : it
      ),
    });
  }

  function remove(id: string) {
    onUpdate({ ...nutrition, groceryItems: nutrition.groceryItems.filter((it) => it.id !== id) });
  }

  function clearChecked() {
    onUpdate({ ...nutrition, groceryItems: nutrition.groceryItems.filter((it) => !it.checked) });
  }

  const bySection = GROCERY_SECTIONS.reduce<Record<string, GroceryItem[]>>((acc, sec) => {
    acc[sec] = nutrition.groceryItems.filter((it) => it.section === sec);
    return acc;
  }, {});

  const checkedCount = nutrition.groceryItems.filter((it) => it.checked).length;

  return (
    <div>
      {/* Add item */}
      <div className="flex gap-2 mb-6">
        <input
          style={{
            flex: 1,
            background: "#1C1C1C",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            color: "#FFFFFF",
            padding: "9px 14px",
            fontSize: "14px",
            outline: "none",
          }}
          placeholder="Add item… (section auto-assigned)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "#71816D" }}
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Clear checked */}
      {checkedCount > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={clearChecked}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#DA667B", background: "rgba(218,102,123,0.08)" }}
          >
            <Trash2 size={12} /> Clear {checkedCount} checked
          </button>
        </div>
      )}

      {nutrition.groceryItems.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.35)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            List is empty
          </p>
          <p className="text-sm">Add items above or use &ldquo;Add to Grocery&rdquo; from the Recipe Vault.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROCERY_SECTIONS.map((sec) => {
            const items = bySection[sec];
            if (items.length === 0) return null;
            return (
              <div key={sec}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{SECTION_ICONS[sec]}</span>
                  <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#A8967E" }}>
                    {sec}
                  </h3>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {items.filter((i) => !i.checked).length} left
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl group transition-colors"
                      style={{ background: item.checked ? "rgba(255,255,255,0.04)" : "#141414" }}
                    >
                      <button
                        onClick={() => toggle(item.id)}
                        className="flex-shrink-0 transition-colors"
                        style={{ color: item.checked ? "#71816D" : "rgba(255,255,255,0.3)" }}
                      >
                        {item.checked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                      <span
                        className="flex-1 text-sm"
                        style={{
                          color: item.checked ? "rgba(255,255,255,0.35)" : "#FFFFFF",
                          textDecoration: item.checked ? "line-through" : "none",
                        }}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => remove(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                        style={{ color: "#A8967E" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
