"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";

// Where the steps went.
//
// Fourteen days, one bar each, with the goal drawn across. The days she logged
// nothing are left empty rather than skipped, because the gaps are the part
// that tells her something: a wall of bars with three holes in it reads
// differently from a tidy list of nine good days.
//
// Read only. Steps arrive by text in the evening and that is the right moment,
// since it is when she is on the treadmill with her phone in her hand. A second
// way to enter them here would only create two numbers that disagree.

interface Day {
  date: string;
  steps: number | null;
  workoutMinutes: number | null;
  workoutWhat: string | null;
  drives: number;
  heightReps: number;
}

interface Totals {
  daysLogged: number;
  daysHitGoal: number;
  average: number | null;
  best: number | null;
  workoutMinutes: number;
}

interface Payload { days: Day[]; totals: Totals; goal: number }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-[68px]">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-light)" }}>{label}</p>
      <p className="text-lg tabular-nums leading-tight" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

export function ActivityCard() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/activity", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  if (!data?.days?.length) return null;
  const { days, totals, goal } = data;

  // Scaled to her best fortnight rather than to the goal, so a week spent in
  // the twelves still has visible shape instead of a row of stubs.
  const ceiling = Math.max(goal, ...days.map(d => d.steps ?? 0));
  const goalPct = (goal / ceiling) * 100;

  return (
    <div className="rounded-2xl p-4 md:p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="section-title">Steps</h3>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
          {totals.daysHitGoal} of {totals.daysLogged} days at goal
        </span>
      </div>

      <div className="flex gap-3 mb-4">
        <Stat label="Average" value={totals.average ? totals.average.toLocaleString("en-US") : "—"} />
        <Stat label="Best" value={totals.best ? totals.best.toLocaleString("en-US") : "—"} />
        <Stat label="Goal" value={goal.toLocaleString("en-US")} />
        <Stat label="Workouts" value={totals.workoutMinutes ? `${totals.workoutMinutes} min` : "—"} />
      </div>

      <div className="relative" style={{ height: 96 }}>
        <div
          className="absolute left-0 right-0 border-t border-dashed"
          style={{ bottom: `${goalPct}%`, borderColor: "var(--border2)" }}
        />
        <div className="flex items-end gap-1 h-full">
          {days.map(d => {
            const pct = d.steps ? (d.steps / ceiling) * 100 : 0;
            const hit = (d.steps ?? 0) >= goal;
            return (
              <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date}: ${d.steps?.toLocaleString("en-US") ?? "nothing logged"}`}>
                <div
                  style={{
                    height: `${Math.max(pct, d.steps ? 3 : 0)}%`,
                    background: hit ? "#0F8A55" : "var(--purple)",
                    opacity: d.steps ? 1 : 0,
                    borderRadius: "3px 3px 0 0",
                    minHeight: d.steps ? 3 : 0,
                    transition: "height .3s",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1 mt-1">
        {days.map(d => (
          <span key={d.date} className="flex-1 text-center text-[9px] tabular-nums" style={{ color: "var(--text-light)" }}>
            {format(parseISO(d.date), "d")}
          </span>
        ))}
      </div>

      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Text a number any time to log steps, or say what you did and it gets read.
      </p>
    </div>
  );
}
