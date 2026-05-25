"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PantryItem, NutritionData } from "@/types/dashboard";

export function PantryTracker({
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
    const item: PantryItem = {
      id: crypto.randomUUID(),
      name,
      inStock: true,
      updatedAt: new Date().toISOString(),
    };
    onUpdate({ ...nutrition, pantryItems: [...nutrition.pantryItems, item] });
    setInput("");
  }

  function toggle(id: string) {
    onUpdate({
      ...nutrition,
      pantryItems: nutrition.pantryItems.map((it) =>
        it.id === id ? { ...it, inStock: !it.inStock, updatedAt: new Date().toISOString() } : it
      ),
    });
  }

  function remove(id: string) {
    onUpdate({ ...nutrition, pantryItems: nutrition.pantryItems.filter((it) => it.id !== id) });
  }

  const inStock  = nutrition.pantryItems.filter((p) => p.inStock);
  const outOfStock = nutrition.pantryItems.filter((p) => !p.inStock);

  function Section({ title, items, color }: { title: string; items: PantryItem[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color }}>
          {title} · {items.length}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: item.inStock ? "rgba(113,129,109,0.10)" : "rgba(218,102,123,0.07)",
                border: `1px solid ${item.inStock ? "rgba(113,129,109,0.2)" : "rgba(218,102,123,0.15)"}`,
              }}
            >
              <button
                onClick={() => toggle(item.id)}
                className="flex-1 text-left text-sm truncate"
                style={{ color: item.inStock ? "#342A21" : "rgba(52,42,33,0.45)" }}
                title={item.inStock ? "Mark as out" : "Mark as in stock"}
              >
                <span
                  className="mr-2 text-xs font-medium"
                  style={{ color: item.inStock ? "#71816D" : "#DA667B" }}
                >
                  {item.inStock ? "✓" : "✗"}
                </span>
                {item.name}
              </button>
              <button
                onClick={() => remove(item.id)}
                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded transition-all"
                style={{ color: "#A8967E" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          style={{
            flex: 1,
            background: "#F7EDD8",
            border: "1px solid rgba(201,183,156,0.5)",
            borderRadius: "10px",
            color: "#342A21",
            padding: "9px 14px",
            fontSize: "14px",
            outline: "none",
          }}
          placeholder="Add pantry item…"
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

      {nutrition.pantryItems.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(52,42,33,0.4)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Pantry is empty
          </p>
          <p className="text-sm">Add items to track what you have on hand. Tap to toggle in/out of stock.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="In Stock" items={inStock} color="#71816D" />
          <Section title="Out of Stock" items={outOfStock} color="#DA667B" />
        </div>
      )}
    </div>
  );
}
