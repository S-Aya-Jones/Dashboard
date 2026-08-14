import { CAT_COLORS, planMinutes, resolveLabel, type Cat } from "@/lib/weekPlan";
import { catFor, tempWeekFor, type DatedChange } from "@/lib/tempWeek";

// Merging a day's recurring schedule with whatever is temporary about it.
//
// This is deliberately free of any database import: it runs inside client
// components, so pulling in lib/scheduleOverrides.ts (neon + node crypto)
// would break the build. The cancel-matching below is the same loose rule that
// module uses, restated here.

export interface SchedRow {
  key: string;
  start: string;
  end: string;
  label: string;
  color: string;
  note?: string;
  rotation?: string[];
  /** True for anything this date has that a normal week wouldn't. */
  temporary?: boolean;
}

export interface DayPlan {
  rows: SchedRow[];
  /** Labels struck from the recurring week for this date, with the reason. */
  cut: Array<{ label: string; note: string | null }>;
  /** Whether anything about this day differs from the recurring week. */
  temporary: boolean;
  /** The name of the temporary week this date belongs to, if any. */
  weekName?: string;
  weekWhy?: string;
}

/**
 * Does this cancellation strike that block? Loose on purpose — she says
 * "cancel shadowing", the block is called "Hospital shadowing".
 */
export function strikes(cancelLabel: string, blockLabel: string): boolean {
  const a = cancelLabel.trim().toLowerCase();
  const b = blockLabel.trim().toLowerCase();
  if (!a) return false;
  return b.includes(a) || a.includes(b);
}

/**
 * The rows a given date should actually show.
 *
 * `base` is the recurring week already narrowed to this weekday. `changes` is
 * every dated change from any source — the temporary weeks in lib/tempWeek.ts
 * and the one-offs she saves by voice — for any date; only this one's are used.
 */
export function applyChanges(base: SchedRow[], changes: DatedChange[], dateStr: string): DayPlan {
  const mine = changes.filter(c => c.date === dateStr);
  const cancels = mine.filter(c => c.kind === "cancel");

  const cut: DayPlan["cut"] = [];
  const kept = base.filter(row => {
    const hit = cancels.find(c => strikes(c.label, row.label));
    if (!hit) return true;
    cut.push({ label: row.label, note: hit.note });
    return false;
  });

  const added: SchedRow[] = mine
    .filter(c => c.kind === "add" && c.startTime && c.endTime)
    .map(c => {
      const cat: Cat = c.cat ?? catFor(c.label);
      return {
        key: c.id,
        start: c.startTime!,
        end: c.endTime!,
        label: c.label,
        color: CAT_COLORS[cat],
        ...(c.note ? { note: c.note } : {}),
        temporary: true,
      };
    });

  const week = tempWeekFor(dateStr);
  const rows = [...kept, ...added].sort(
    (a, b) => planMinutes(a.start) - planMinutes(b.start) || planMinutes(a.end) - planMinutes(b.end),
  );

  return {
    rows,
    cut,
    temporary: added.length > 0 || cut.length > 0,
    ...(week ? { weekName: week.name, weekWhy: week.why } : {}),
  };
}

/** Adapter for the Week Plan template, which speaks in PlanBlocks. */
export function rowsFromPlan(
  blocks: Array<{ start: string; end: string; label: string; cat: Cat; note?: string; rotation?: string[] }>,
  when: Date,
): SchedRow[] {
  return blocks.map((b, i) => ({
    key: `plan-${i}-${b.start}`,
    start: b.start,
    end: b.end,
    label: resolveLabel(b, when),
    color: CAT_COLORS[b.cat],
    ...(b.note ? { note: b.note } : {}),
    ...(b.rotation ? { rotation: b.rotation } : {}),
  }));
}

/** Adapter for the stored ScheduleBlock shape used by Today and This Week. */
export function rowsFromBlocks(
  blocks: Array<{ id: string; label: string; startTime: string; endTime: string; color?: string; notes?: string; rotation?: string[] }>,
  fallbackColor: (b: { label: string }) => string,
  when: Date,
): SchedRow[] {
  return blocks.map(b => ({
    key: b.id,
    start: b.startTime,
    end: b.endTime,
    label: resolveLabel({ label: b.label, rotation: b.rotation }, when),
    color: b.color ?? fallbackColor(b),
    ...(b.notes ? { note: b.notes } : {}),
  }));
}

/** YYYY-MM-DD for a Date, in local terms rather than UTC. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
