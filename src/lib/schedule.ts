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
 * The recurring week is regenerated from lib/weekPlan.ts on every read, and
 * only her own additions are taken from storage. That ordering matters: the
 * previous version returned the stored list wholesale whenever it contained a
 * `plan-` id, so the first time she added a block through the week editor the
 * entire plan froze into a snapshot. Every later change to weekPlan.ts —
 * including the four legal hours she kept asking where to find — was written
 * to a file nothing read any more.
 *
 * Blocks saved before the plan became the single source have random ids and no
 * plan block among them. That whole list is the old, obsolete schedule (no
 * classes, therapy on the wrong day), so it is dropped rather than merged.
 */
export function resolveBlocks(stored?: ScheduleBlock[], hidden?: string[]): ScheduleBlock[] {
  const plan = planAsScheduleBlocks();
  const hide = new Set(hidden ?? []);
  const visible = plan.filter(b => !hide.has(b.id));

  if (!stored?.length) return visible;
  if (!stored.some(b => b.id.startsWith("plan-"))) return visible;

  const custom = stored.filter(b => !b.id.startsWith("plan-"));
  return [...visible, ...custom].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
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
