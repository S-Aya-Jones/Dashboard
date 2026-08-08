import { Briefcase, Footprints, Brain, Flame, Utensils, Moon, Sparkles, Circle, LucideIcon } from "lucide-react";
import { ScheduleBlock } from "@/types/dashboard";
import { planAsScheduleBlocks } from "@/lib/weekPlan";

export const TYPE_META: Record<ScheduleBlock["type"], { color: string; label: string }> = {
  work:     { color: "#8A7A66", label: "Work + classes" },
  walk:     { color: "#3F6F5E", label: "Gym & walks" },
  mcat:     { color: "#B4552F", label: "Study" },
  exposure: { color: "#E0A44A", label: "Exposure" },
  meal:     { color: "#C9A227", label: "Home & meals" },
  sleep:    { color: "#8A9E87", label: "Sleep" },
  personal: { color: "#C9748A", label: "Personal" },
  other:    { color: "#A8967E", label: "Other" },
};

export const TYPE_ICON: Record<ScheduleBlock["type"], LucideIcon> = {
  work:     Briefcase,
  walk:     Footprints,
  mcat:     Brain,
  exposure: Flame,
  meal:     Utensils,
  sleep:    Moon,
  personal: Sparkles,
  other:    Circle,
};

// The Today page and the week editor both start from the Week Plan rather
// than a second, separately-maintained schedule. See lib/weekPlan.ts.
export function defaultBlocks(): ScheduleBlock[] {
  return planAsScheduleBlocks();
}

/**
 * What Today and the week editor should actually render.
 *
 * Blocks saved before the Week Plan became the single source were generated
 * with random ids; the plan generates deterministic `plan-` ones. A stored
 * list with no plan block in it is the old, obsolete schedule — the one with
 * no classes and therapy on the wrong day — so it gets replaced rather than
 * shown. Once she edits or adds blocks, the plan ids on the untouched ones
 * keep this from firing again.
 */
export function resolveBlocks(stored?: ScheduleBlock[]): ScheduleBlock[] {
  if (!stored?.length) return planAsScheduleBlocks();
  return stored.some(b => b.id.startsWith("plan-")) ? stored : planAsScheduleBlocks();
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export function formatRange12(start: string, end: string) {
  return `${formatTime12(start)}–${formatTime12(end)}`;
}

export function blocksForDate(blocks: ScheduleBlock[], date: Date) {
  const dow = date.getDay();
  return blocks.filter(b => b.days.includes(dow)).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}
