"use client";

import { MealEntry, NutritionData } from "@/types/dashboard";

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function topBy<T>(arr: T[], key: (item: T) => string): string | null {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function MealTypePie({ meals }: { meals: MealEntry[] }) {
  const counts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const m of meals) counts[m.mealType]++;
  const total = meals.length || 1;
  const colors = { breakfast: "#C99A5C", lunch: "#71816D", dinner: "#FFFFFF", snack: "rgba(124,92,252,0.3)" };

  return (
    <div className="flex gap-3 flex-wrap">
      {Object.entries(counts).map(([type, count]) => {
        if (count === 0) return null;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors[type as keyof typeof colors] }} />
            <span className="text-xs capitalize" style={{ color: "var(--text)" }}>{type}</span>
            <span className="text-xs font-medium" style={{ color: "#A8967E" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyFoodReview({ nutrition }: { nutrition: NutritionData }) {
  const { monday, sunday } = getWeekBounds();

  const weekMeals = nutrition.meals.filter((m) => {
    const d = new Date(m.date + "T12:00:00");
    return d >= monday && d <= sunday;
  });

  const avgRating = weekMeals.length
    ? weekMeals.reduce((s, m) => s + m.rating, 0) / weekMeals.length
    : 0;

  const topMeal = weekMeals.reduce<MealEntry | null>((best, m) => {
    if (!best || m.rating > best.rating) return m;
    return best;
  }, null);

  const mostCommonType = topBy(weekMeals, (m) => m.mealType);

  const allTags = weekMeals.flatMap((m) => m.tags);
  const tagCounts: Record<string, number> = {};
  for (const t of allTags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  const insights = [
    weekMeals.length >= 14 && "Great consistency this week — you logged every meal!",
    avgRating >= 4 && "High satisfaction week — you're eating things you love.",
    mostCommonType === "snack" && weekMeals.filter((m) => m.mealType === "snack").length > 5 && "Lots of snacking this week — listen to what your body's asking for.",
    weekMeals.length === 0 && "Nothing logged yet this week — start capturing your meals!",
  ].filter(Boolean)[0] as string | undefined;

  const statCard = (label: string, value: string | number, sub?: string) => (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: "rgba(113,129,109,0.08)", border: "1px solid rgba(124,92,252,0.07)" }}
    >
      <p
        className="font-serif text-3xl leading-none mb-1"
        style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-xs font-medium" style={{ color: "#A8967E" }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: "rgba(124,92,252,0.4)" }}>{sub}</p>}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="font-serif text-2xl"
            style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            This Week&apos;s Food Story
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#A8967E" }}>
            {fmtDate(monday)} – {fmtDate(sunday)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCard("Meals Logged", weekMeals.length)}
        {statCard("Avg Rating", avgRating ? avgRating.toFixed(1) : "—", "out of 5")}
        {statCard("Unique Meals", new Set(weekMeals.map((m) => m.name.toLowerCase())).size)}
        {statCard("Tags Used", allTags.length)}
      </div>

      {/* Meal type breakdown */}
      {weekMeals.length > 0 && (
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.08)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#A8967E" }}>
            Meal Breakdown
          </p>
          <MealTypePie meals={weekMeals} />
        </div>
      )}

      {/* Highlight: top-rated meal */}
      {topMeal && (
        <div
          className="rounded-2xl p-5 mb-4 flex gap-4"
          style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.08)" }}
        >
          {topMeal.photos.length > 0 && (
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
              <img src={topMeal.photos[0]} alt={topMeal.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#DA667B" }}>
              ★ Favorite This Week
            </p>
            <p
              className="font-serif text-xl leading-tight"
              style={{ color: "var(--text)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {topMeal.name}
            </p>
            <p className="text-xs mt-0.5 capitalize" style={{ color: "#A8967E" }}>
              {topMeal.mealType} · rated {topMeal.rating}/5
            </p>
          </div>
        </div>
      )}

      {/* Top tags */}
      {topTags.length > 0 && (
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.08)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#A8967E" }}>
            Top Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {topTags.map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full text-sm"
                style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      {insights && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: "rgba(218,102,123,0.06)", border: "1px solid rgba(218,102,123,0.15)" }}
        >
          <p className="text-sm italic" style={{ color: "var(--text)" }}>{insights}</p>
        </div>
      )}

      {/* Previous weeks summary */}
      {nutrition.meals.length > weekMeals.length && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#A8967E" }}>
            All Time
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {statCard("Total Logged", nutrition.meals.length, "meals")}
            {statCard("Overall Avg", (nutrition.meals.reduce((s, m) => s + m.rating, 0) / nutrition.meals.length || 0).toFixed(1), "rating")}
            {statCard("Recipes Saved", nutrition.recipes.length, "in vault")}
          </div>
        </div>
      )}
    </div>
  );
}
