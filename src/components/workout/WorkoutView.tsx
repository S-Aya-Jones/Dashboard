"use client";

import { useState, useMemo } from "react";
import { format, parseISO, differenceInCalendarDays, subDays } from "date-fns";
import { Play, Footprints, Flame } from "lucide-react";
import { DashboardData, ExerciseSessionLog, WorkoutSessionLog } from "@/types/dashboard";
import { PROGRAM, WEEK_DAYS, todayWeekday, getProgramDayForWeekday } from "./program";
import { SessionView } from "./SessionView";
import { id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function getLastWeights(
  sessionLogs: WorkoutSessionLog[],
  exerciseId: string
): number {
  for (let i = sessionLogs.length - 1; i >= 0; i--) {
    const ex = sessionLogs[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (ex && ex.sets.length > 0) {
      const nonZero = ex.sets.filter((s) => s.weight > 0);
      if (nonZero.length > 0) return nonZero[nonZero.length - 1].weight;
    }
  }
  return 0;
}

function calcStreak(sessionLogs: WorkoutSessionLog[]): number {
  if (sessionLogs.length === 0) return 0;
  const dates = Array.from(new Set(sessionLogs.map((l) => l.date))).sort().reverse();
  let streak = 0;
  let checkDate = new Date();
  // Allow today or yesterday to start the streak
  for (const dateStr of dates) {
    const diff = differenceInCalendarDays(checkDate, parseISO(dateStr));
    if (diff > 1) break;
    streak++;
    checkDate = parseISO(dateStr);
  }
  return streak;
}

// ── Walking log quick-add ──────────────────────────────────────────────────

function WalkingSection({ data, update }: Props) {
  const [stepsInput, setStepsInput] = useState("");
  const [milesInput, setMilesInput] = useState("");
  const today = todayStr();
  const wData = data.workout ?? { sessionLogs: [], walkingLogs: [] };
  const todayLog = wData.walkingLogs.find((l) => l.date === today);

  const save = () => {
    const steps = stepsInput ? parseInt(stepsInput) : undefined;
    const miles = milesInput ? parseFloat(milesInput) : undefined;
    if (!steps && !miles) return;
    update((d) => {
      const w = d.workout ?? { sessionLogs: [], walkingLogs: [] };
      return {
        ...d,
        workout: {
          ...w,
          walkingLogs: [
            ...w.walkingLogs.filter((l) => l.date !== today),
            { date: today, steps, miles },
          ],
        },
      };
    });
    setStepsInput("");
    setMilesInput("");
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2">
        <Footprints size={16} style={{ color: "#C99A5C" }} />
        <p className="text-sm font-semibold text-white">Walking Log</p>
        <span className="text-xs text-white/40 ml-auto">{format(new Date(), "EEEE")}</span>
      </div>

      {todayLog && (
        <div className="flex gap-4">
          {todayLog.steps && (
            <div>
              <p className="text-2xl font-serif text-white">{todayLog.steps.toLocaleString()}</p>
              <p className="text-xs text-white/40">steps</p>
            </div>
          )}
          {todayLog.miles && (
            <div>
              <p className="text-2xl font-serif text-white">{todayLog.miles}</p>
              <p className="text-xs text-white/40">miles</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Steps"
          value={stepsInput}
          onChange={(e) => setStepsInput(e.target.value)}
          className="flex-1"
          style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem" }}
        />
        <input
          type="number"
          step="0.1"
          placeholder="Miles"
          value={milesInput}
          onChange={(e) => setMilesInput(e.target.value)}
          className="flex-1"
          style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem" }}
        />
        <button
          onClick={save}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: "#C8FF00" }}
        >
          Log
        </button>
      </div>

      {/* Last 7 days mini chart */}
      {wData.walkingLogs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-white/30">Last 7 days</p>
          <div className="flex gap-1 items-end" style={{ height: 36 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
              const log = wData.walkingLogs.find((l) => l.date === d);
              const steps = log?.steps ?? 0;
              const maxSteps = 12000;
              const h = steps ? Math.max((steps / maxSteps) * 36, 4) : 2;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: h,
                      background: steps >= 8000 ? "#C8FF00" : steps > 0 ? "#C99A5C" : "rgba(255,255,255,0.07)",
                    }}
                  />
                  <span className="text-[9px] text-white/25">{WEEK_DAYS[i === 6 ? todayWeekday() : (todayWeekday() - 6 + i + 7) % 7]?.slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main WorkoutView ───────────────────────────────────────────────────────

export function WorkoutView({ data, update }: Props) {
  const [activeSession, setActiveSession] = useState(false);
  const [viewingDayId, setViewingDayId] = useState<string | null>(null);

  const wData = data.workout ?? { sessionLogs: [], walkingLogs: [] };
  const today = todayStr();
  const weekday = todayWeekday();
  const todayProgram = getProgramDayForWeekday(weekday);

  const streak = useMemo(() => calcStreak(wData.sessionLogs), [wData.sessionLogs]);

  const lastWeights = useMemo(() => {
    const map: Record<string, number> = {};
    PROGRAM.forEach((day) => {
      day.exercises.forEach((ex) => {
        if (!map[ex.id]) map[ex.id] = getLastWeights(wData.sessionLogs, ex.id);
      });
    });
    return map;
  }, [wData.sessionLogs]);

  const todayDone = wData.sessionLogs.some((l) => l.date === today && l.completedAt);

  const sessionDay = viewingDayId
    ? PROGRAM.find((d) => d.id === viewingDayId) ?? todayProgram
    : todayProgram;

  const handleComplete = (logs: ExerciseSessionLog[]) => {
    if (!sessionDay) return;
    const session: WorkoutSessionLog = {
      id: id(),
      date: today,
      programDayId: sessionDay.id,
      dayLabel: sessionDay.label,
      exercises: logs,
      completedAt: new Date().toISOString(),
    };
    update((d) => {
      const w = d.workout ?? { sessionLogs: [], walkingLogs: [] };
      return { ...d, workout: { ...w, sessionLogs: [...w.sessionLogs, session] } };
    });
    setActiveSession(false);
    setViewingDayId(null);
  };

  // ── Active session screen ────────────────────────────────────────────────
  if (activeSession && sessionDay) {
    return (
      <div className="h-full" style={{ background: "#0A0A0A" }}>
        <SessionView
          day={sessionDay}
          lastWeights={lastWeights}
          onComplete={handleComplete}
          onExit={() => { setActiveSession(false); setViewingDayId(null); }}
        />
      </div>
    );
  }

  // ── Home screen ──────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0A0A0A" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-10 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-3xl text-white">Workout</h1>
            <p className="text-white/40 text-sm mt-0.5">{format(new Date(), "EEEE, MMMM d")}</p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.2)" }}>
              <Flame size={14} style={{ color: "#C8FF00" }} />
              <span className="text-sm font-semibold" style={{ color: "#C8FF00" }}>{streak}</span>
              <span className="text-xs text-white/40">streak</span>
            </div>
          )}
        </div>

        {/* Today's workout hero */}
        {todayProgram ? (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: todayDone ? "rgba(200,255,0,0.06)" : "#141414", border: `1px solid ${todayDone ? "rgba(200,255,0,0.2)" : "rgba(255,255,255,0.06)"}` }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C8FF00" }}>
                {todayDone ? "Completed" : "Today's Workout"}
              </p>
              <h2 className="font-serif text-2xl text-white mt-1">{todayProgram.label}</h2>
              <p className="text-white/40 text-sm mt-1">
                {todayProgram.exercises.length} exercises ·{" "}
                {todayProgram.exercises.reduce((s, e) => s + e.sets, 0)} sets total
              </p>
            </div>

            {/* Exercise list preview */}
            <div className="space-y-2">
              {todayProgram.exercises.slice(0, 4).map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 text-sm">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: ex.category === "compound" ? "#C8FF00" : ex.category === "core" ? "#DA667B" : ex.category === "mobility" ? "#C99A5C" : "#9B7FFF",
                    }}
                  />
                  <span className="text-white/70">{ex.name}</span>
                  <span className="ml-auto text-white/30 text-xs">{ex.sets}×{ex.reps}</span>
                </div>
              ))}
              {todayProgram.exercises.length > 4 && (
                <p className="text-xs text-white/30 pl-4">+{todayProgram.exercises.length - 4} more</p>
              )}
            </div>

            {todayDone ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#C8FF00" }}>
                <span>✓</span>
                <span>Done for today — great work.</span>
              </div>
            ) : (
              <button
                onClick={() => { setViewingDayId(todayProgram.id); setActiveSession(true); }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-black text-base"
                style={{ background: "#C8FF00" }}
              >
                <Play size={16} fill="black" />
                Start Workout
              </button>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/50 text-sm">Rest day — recovery is part of the program.</p>
            {streak > 0 && <p className="text-white/30 text-xs mt-1">Keep that {streak}-day streak alive.</p>}
          </div>
        )}

        {/* Weekly schedule */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">This Week</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((dayLabel, i) => {
              const prog = getProgramDayForWeekday(i);
              const isToday = i === weekday;
              const hasDone = wData.sessionLogs.some((l) => {
                const d = parseISO(l.date);
                const thisWeekDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
                return thisWeekDay === i && l.completedAt;
              });
              return (
                <div
                  key={dayLabel}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  onClick={() => {
                    if (prog) { setViewingDayId(prog.id); setActiveSession(true); }
                  }}
                >
                  <span
                    className="text-[10px] font-medium uppercase"
                    style={{ color: isToday ? "#C8FF00" : "rgba(255,255,255,0.3)" }}
                  >
                    {dayLabel.slice(0, 2)}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: hasDone
                        ? "#C8FF00"
                        : prog
                        ? isToday
                          ? "rgba(200,255,0,0.15)"
                          : "rgba(255,255,255,0.06)"
                        : "transparent",
                      border: isToday && !hasDone ? "1.5px solid rgba(200,255,0,0.5)" : "1.5px solid transparent",
                    }}
                  >
                    {hasDone ? (
                      <span className="text-black text-xs font-bold">✓</span>
                    ) : prog ? (
                      <Play size={9} style={{ color: isToday ? "#C8FF00" : "rgba(255,255,255,0.3)" }} fill={isToday ? "#C8FF00" : "rgba(255,255,255,0.3)"} />
                    ) : (
                      <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                    )}
                  </div>
                  {prog && (
                    <span className="text-[9px] text-center leading-tight text-white/25 group-hover:text-white/50 transition-colors">
                      {prog.shortLabel.split(" ").slice(-1)[0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent sessions */}
        {wData.sessionLogs.length > 0 && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Recent Sessions</p>
            <div className="space-y-2">
              {[...wData.sessionLogs].reverse().slice(0, 4).map((log) => {
                const exWithWeight = log.exercises.filter((e) => e.sets.some((s) => s.weight > 0));
                return (
                  <div key={log.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#C8FF00" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{log.dayLabel}</p>
                      <p className="text-xs text-white/30">{format(parseISO(log.date), "EEE, MMM d")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-white/50">{log.exercises.length} exercises</p>
                      {exWithWeight.length > 0 && (
                        <p className="text-[10px] text-white/30">{exWithWeight[0].exerciseName.split(" ")[0]}: {exWithWeight[0].sets.slice(-1)[0]?.weight}lb</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Walking log */}
        <WalkingSection data={data} update={update} />
      </div>
    </div>
  );
}
