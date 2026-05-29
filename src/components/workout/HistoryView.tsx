"use client";

import { format, parseISO } from "date-fns";
import { DashboardData } from "@/types/dashboard";

interface Props {
  data: DashboardData;
}

export function HistoryView({ data }: Props) {
  const logs = [...(data.workout?.sessionLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  if (!logs.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-serif text-2xl text-white">No sessions yet</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Complete your first workout and it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10 space-y-3">
        <h2 className="font-serif text-2xl text-white mb-4">Workout History</h2>
        {logs.map((log) => {
          const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0);
          const totalVol  = log.exercises.reduce((t, e) => t + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
          return (
            <div key={log.id} className="rounded-2xl p-4 space-y-3"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-serif text-base text-white">{log.dayLabel}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {format(parseISO(log.date), "EEEE, MMMM d")}
                  </p>
                </div>
                <div className="text-right">
                  {totalVol > 0 && (
                    <p className="font-serif text-sm text-white">{totalVol.toLocaleString()} lbs</p>
                  )}
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{totalSets} sets</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {log.exercises.slice(0, 5).map((ex) => {
                  const best = ex.sets.reduce((m, s) => Math.max(m, s.weight), 0);
                  return (
                    <div key={ex.exerciseId} className="flex items-center justify-between">
                      <p className="text-sm truncate flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>{ex.exerciseName}</p>
                      <p className="text-xs flex-shrink-0 ml-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {ex.sets.length}×{best > 0 ? `${best} lbs` : ex.sets[0]?.reps ?? "—"}
                      </p>
                    </div>
                  );
                })}
                {log.exercises.length > 5 && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>+{log.exercises.length - 5} more exercises</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
