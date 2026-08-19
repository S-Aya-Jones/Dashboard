"use client";

import { useEffect, useState } from "react";
import { tempChangesBetween, type DatedChange } from "@/lib/tempWeek";

// Every dated change in a window, from both sources, in one list.
//
// The built-in temporary weeks are returned immediately and synchronously —
// they ship with the app, so a slow or failed request never costs her the
// catch-up week. Anything she saved by voice arrives a moment later and is
// merged in.

interface Saved {
  id: string; date: string; kind: "add" | "cancel";
  label: string; startTime: string | null; endTime: string | null; note: string | null;
}

/**
 * Fired after a change is saved or removed, so every schedule already on
 * screen picks it up without a reload. She reported saving changes and not
 * seeing them; a stale week is the same thing as a lost one.
 */
export const SCHEDULE_CHANGED = "schedule-changed";

export function announceScheduleChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCHEDULE_CHANGED));
}

export function useDatedChanges(from: string, to: string): DatedChange[] {
  const [saved, setSaved] = useState<DatedChange[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(SCHEDULE_CHANGED, bump);
    return () => window.removeEventListener(SCHEDULE_CHANGED, bump);
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/schedule/overrides?from=${from}&to=${to}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { overrides: [] }))
      .then(d => {
        if (!live) return;
        const rows: Saved[] = Array.isArray(d.overrides) ? d.overrides : [];
        setSaved(rows.map(r => ({
          id: `saved-${r.id}`,
          date: r.date,
          kind: r.kind,
          label: r.label,
          startTime: r.startTime,
          endTime: r.endTime,
          note: r.note,
        })));
      })
      .catch(() => { /* the built-in weeks below still render */ });
    return () => { live = false; };
  }, [from, to, tick]);

  return [...tempChangesBetween(from, to), ...saved];
}
