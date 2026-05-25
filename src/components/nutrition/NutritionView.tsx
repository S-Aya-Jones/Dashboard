"use client";

import { useState } from "react";
import { DashboardData, NutritionData } from "@/types/dashboard";
import { MealLog } from "./MealLog";
import { RecipeVault } from "./RecipeVault";
import { GroceryList } from "./GroceryList";
import { PantryTracker } from "./PantryTracker";
import { WeeklyFoodReview } from "./WeeklyFoodReview";

const TABS = [
  { id: "meals",    label: "Meal Log" },
  { id: "recipes",  label: "Recipe Vault" },
  { id: "grocery",  label: "Grocery List" },
  { id: "pantry",   label: "Pantry" },
  { id: "review",   label: "Weekly Review" },
] as const;

type TabId = typeof TABS[number]["id"];

const EMPTY_NUTRITION: NutritionData = {
  meals: [],
  recipes: [],
  groceryItems: [],
  pantryItems: [],
  shetritionImages: [],
};

export function NutritionView({
  data,
  update,
}: {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}) {
  const [tab, setTab] = useState<TabId>("meals");
  const nutrition = data.nutrition ?? EMPTY_NUTRITION;

  function onUpdate(n: NutritionData) {
    update((d) => ({ ...d, nutrition: n }));
  }

  const groceryCount = nutrition.groceryItems.filter((g) => !g.checked).length;
  const outOfStock   = nutrition.pantryItems.filter((p) => !p.inStock).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1
          className="font-serif text-4xl mb-1"
          style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Food Journal
        </h1>
        <p className="text-sm" style={{ color: "rgba(52,42,33,0.5)" }}>
          Log meals, save recipes, and keep your kitchen in check.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl mb-8 overflow-x-auto"
        style={{ background: "rgba(201,183,156,0.18)" }}
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          const badge =
            id === "grocery" && groceryCount > 0 ? groceryCount
            : id === "pantry"  && outOfStock > 0  ? outOfStock
            : null;

          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0"
              style={{
                background: active ? "#FAF3E8" : "transparent",
                color:      active ? "#342A21" : "rgba(52,42,33,0.5)",
                boxShadow:  active ? "0 2px 8px rgba(52,42,33,0.08)" : "none",
              }}
            >
              {label}
              {badge != null && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: id === "pantry" ? "rgba(218,102,123,0.15)" : "rgba(113,129,109,0.15)",
                    color:      id === "pantry" ? "#DA667B" : "#71816D",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {tab === "meals"   && <MealLog       nutrition={nutrition} onUpdate={onUpdate} />}
        {tab === "recipes" && <RecipeVault   nutrition={nutrition} onUpdate={onUpdate} />}
        {tab === "grocery" && <GroceryList   nutrition={nutrition} onUpdate={onUpdate} />}
        {tab === "pantry"  && <PantryTracker nutrition={nutrition} onUpdate={onUpdate} />}
        {tab === "review"  && <WeeklyFoodReview nutrition={nutrition} />}
      </div>
    </div>
  );
}
