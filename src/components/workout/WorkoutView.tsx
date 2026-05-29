"use client";

import { useState, useMemo } from "react";
import { format, parseISO, differenceInCalendarDays, subDays } from "date-fns";
import { Play, Flame, TrendingUp, Home, ChevronRight, X } from "lucide-react";
import { DashboardData, ExerciseSessionLog, WorkoutSessionLog, MeasurementEntry, BodyWeightEntry } from "@/types/dashboard";
import {
  PROGRAM, WEEK_DAYS, CORE_PRIMER, HIP_FLEXOR_UNLOCK,
  todayWeekday, getProgramDay, getCurrentWeek, getWeekPhase, buildFullExerciseList,
} from "./program";
import { SessionView } from "./SessionView";
import { HistoryView } from "./HistoryView";
import { id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }

function getLastWeights(logs: WorkoutSessionLog[], exId: string): number {
  for (let i = logs.length - 1; i >= 0; i--) {
    const ex = logs[i].exercises.find((e) => e.exerciseId === exId);
    if (ex) {
      const nonZero = ex.sets.filter((s) => s.weight > 0);
      if (nonZero.length) return nonZero[nonZero.length - 1].weight;
    }
  }
  return 0;
}

function calcStreak(logs: WorkoutSessionLog[]): number {
  if (!logs.length) return 0;
  const dates = Array.from(new Set(logs.map((l) => l.date))).sort().reverse();
  let streak = 0, check = new Date();
  for (const d of dates) {
    const diff = differenceInCalendarDays(check, parseISO(d));
    if (diff > 1) break;
    streak++; check = parseISO(d);
  }
  return streak;
}

// ── Program Overview modal ────────────────────────────────────────────────────

function ProgramOverview({ onClose }: { onClose: () => void }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "#0A0A0A", zIndex: 80 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <h2 className="font-serif text-xl text-white">6-Week Program</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Full schedule — tap a day to expand</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl" style={{ color: "rgba(255,255,255,0.4)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Week phases */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: "rgba(255,255,255,0.4)" }}>Week Phases</p>
          {[
            { weeks: "Weeks 1–2", label: "Building the Foundation", color: "#C8FF00", desc: "Focus on form and mind-muscle connection. Moderate weight." },
            { weeks: "Weeks 3–4", label: "Progressive Overload", color: "#9B7FFF", desc: "Add weight every session. Last reps should be hard." },
            { weeks: "Week 4", label: "Deload — Let It Grow", color: "#DA667B", desc: "Drop all weights by 40%. Your body grows during recovery." },
            { weeks: "Weeks 5–6", label: "Peak Intensity", color: "#C99A5C", desc: "Heaviest weights yet. Push every set to near failure." },
          ].map(({ weeks, label, color, desc }) => (
            <div key={weeks} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
              <div>
                <p className="text-xs font-semibold" style={{ color }}>{weeks} · {label}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Daily schedule */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: "rgba(255,255,255,0.4)" }}>Daily Schedule</p>
          {PROGRAM.map((day) => {
            const isExpanded = expandedDay === day.id;
            const fullList = buildFullExerciseList(day);
            return (
              <div key={day.id} className="rounded-2xl overflow-hidden" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
                <button className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  onClick={() => setExpandedDay(isExpanded ? null : day.id)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: day.isGluteDay ? "#C8FF00" : "rgba(255,255,255,0.4)" }}>
                        {WEEK_DAYS[day.weekday]}
                      </span>
                      {day.isGluteDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(200,255,0,0.1)", color: "#C8FF00" }}>Glute Day</span>
                      )}
                    </div>
                    <p className="font-serif text-base text-white mt-0.5">{day.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {fullList.length} exercises · ~{day.estimatedMinutes} min
                    </p>
                  </div>
                  <ChevronRight size={16} className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    {/* Core primer */}
                    <div className="pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#DA667B" }}>Core Primer (every session)</p>
                      <div className="space-y-1.5">
                        {CORE_PRIMER.map((ex) => (
                          <div key={ex.id} className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#DA667B" }} />
                            <span className="text-sm text-white">{ex.name}</span>
                            <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{ex.sets}×{ex.reps}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hip flexor unlock */}
                    {day.isGluteDay && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#C99A5C" }}>Hip Flexor Unlock (glute days)</p>
                        <div className="space-y-1.5">
                          {HIP_FLEXOR_UNLOCK.map((ex) => (
                            <div key={ex.id} className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#C99A5C" }} />
                              <span className="text-sm text-white">{ex.name}</span>
                              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{ex.sets}×{ex.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Main exercises */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Main Work</p>
                      <div className="space-y-2">
                        {day.mainExercises.map((ex) => {
                          const dotColor = ex.category === "compound" ? "#C8FF00" : ex.category === "isolation" ? "#9B7FFF" : ex.category === "core" ? "#DA667B" : "#C99A5C";
                          return (
                            <div key={ex.id}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                                <span className="text-sm text-white">{ex.name}</span>
                                <span className="ml-auto text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{ex.sets}×{ex.reps}</span>
                              </div>
                              <p className="text-xs pl-4 mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>{ex.formCue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Program rules */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Program Rules</p>
          {[
            { color: "#C8FF00", rule: "Core Primer every session — non-negotiable." },
            { color: "#C8FF00", rule: "Hip Flexor Unlock before every glute day." },
            { color: "#9B7FFF", rule: "Mind-muscle connection > weight. Feel it or it doesn't count." },
            { color: "#9B7FFF", rule: "Add 5 lbs when 8 reps feel easy." },
            { color: "#DA667B", rule: "Week 4 deload is mandatory — that's when you grow." },
            { color: "#C99A5C", rule: "Measure waist + hips weekly. Same day, same time." },
          ].map(({ color, rule }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{rule}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Measurements Card ──────────────────────────────────────────────────────────

function MeasurementsCard({ data, update }: Props) {
  const w = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const today = todayStr();
  const [waist, setWaist] = useState("");
  const [hips,  setHips]  = useState("");
  const [bust,  setBust]  = useState("");
  const [saved, setSaved] = useState(false);

  const latest = [...w.measurements].sort((a, b) => b.date.localeCompare(a.date))[0];
  const ratio  = latest ? Math.round((latest.waist / latest.hips) * 100) / 100 : null;

  const save = () => {
    const w_ = parseFloat(waist), h = parseFloat(hips);
    if (!w_ || !h) return;
    const entry: MeasurementEntry = { date: today, waist: w_, hips: h, bust: bust ? parseFloat(bust) : undefined };
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return { ...d, workout: { ...wd, measurements: [...wd.measurements.filter((m) => m.date !== today), entry] } };
    });
    setWaist(""); setHips(""); setBust("");
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#141414", border: "1px solid rgba(200,255,0,0.15)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Measurements</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(200,255,0,0.1)", color: "#C8FF00" }}>Most important</span>
      </div>
      {latest && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Waist", value: `${latest.waist}"` },
            { label: "Hips",  value: `${latest.hips}"` },
            { label: "Bust",  value: latest.bust ? `${latest.bust}"` : "—" },
            { label: "Ratio", value: ratio ? String(ratio) : "—", highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="rounded-xl py-2.5" style={{ background: "#1A1A1A" }}>
              <p className="font-serif text-lg text-white">{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: highlight ? "#C8FF00" : "rgba(255,255,255,0.4)" }}>{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { placeholder: 'Waist "', value: waist, set: setWaist },
            { placeholder: 'Hips "',  value: hips,  set: setHips  },
            { placeholder: 'Bust "',  value: bust,  set: setBust  },
          ].map(({ placeholder, value, set }) => (
            <input key={placeholder} type="number" step="0.5" placeholder={placeholder} value={value}
              onChange={(e) => set(e.target.value)}
              style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem", width: "100%", outline: "none" }} />
          ))}
        </div>
        <button onClick={save} className="w-full py-2.5 rounded-xl text-sm font-semibold text-black"
          style={{ background: saved ? "#9B7FFF" : "#C8FF00" }}>
          {saved ? "Saved" : "Log Measurements"}
        </button>
      </div>
    </div>
  );
}

// ── Weight Tracker ─────────────────────────────────────────────────────────────

function WeightCard({ data, update }: Props) {
  const w     = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const today = todayStr();
  const [input, setInput]  = useState("");
  const [goal,  setGoalIn] = useState(w.goalWeight ? String(w.goalWeight) : "");
  const [saved, setSaved]  = useState(false);

  const latest  = [...w.bodyWeight].sort((a, b) => b.date.localeCompare(a.date))[0];
  const current = latest?.weight ?? 0;
  const goalW   = w.goalWeight ?? 0;
  const pct     = goalW && current ? Math.min(100, Math.round((1 - Math.abs(current - goalW) / Math.abs((w.bodyWeight[0]?.weight ?? current) - goalW || 1)) * 100)) : 0;

  const save = () => {
    const val = parseFloat(input); if (!val) return;
    const gVal = parseFloat(goal);
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return { ...d, workout: { ...wd, bodyWeight: [...wd.bodyWeight.filter((b) => b.date !== today), { date: today, weight: val } as BodyWeightEntry], goalWeight: gVal || wd.goalWeight } };
    });
    setInput(""); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Body Weight</p>
        {current > 0 && <span className="font-serif text-xl text-white">{current} lbs</span>}
      </div>
      {goalW > 0 && current > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span>Goal: {goalW} lbs</span>
            <span>{Math.abs(current - goalW).toFixed(1)} lbs to go</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: "#9B7FFF" }} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input type="number" step="0.5" placeholder="Today's weight" value={input} onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem", outline: "none" }} />
        <input type="number" step="0.5" placeholder="Goal" value={goal} onChange={(e) => setGoalIn(e.target.value)}
          style={{ width: 80, background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem", outline: "none" }} />
        <button onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: saved ? "#9B7FFF" : "#C8FF00", flexShrink: 0 }}>
          {saved ? "✓" : "Log"}
        </button>
      </div>
    </div>
  );
}

// ── Walking Log ────────────────────────────────────────────────────────────────

function WalkingCard({ data, update }: Props) {
  const w     = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const today = todayStr();
  const [steps, setSteps] = useState("");
  const [miles, setMiles] = useState("");
  const todayLog = w.walkingLogs.find((l) => l.date === today);

  const save = () => {
    const s = steps ? parseInt(steps) : undefined;
    const m = miles ? parseFloat(miles) : undefined;
    if (!s && !m) return;
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return { ...d, workout: { ...wd, walkingLogs: [...wd.walkingLogs.filter((l) => l.date !== today), { date: today, steps: s, miles: m }] } };
    });
    setSteps(""); setMiles("");
  };

  const weekSteps = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    return w.walkingLogs.find((l) => l.date === d)?.steps ?? 0;
  });
  const maxSteps = Math.max(...weekSteps, 1);

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Walking</p>
        {todayLog?.steps && (
          <div className="text-right">
            <span className="font-serif text-xl text-white">{todayLog.steps.toLocaleString()}</span>
            <span className="text-xs ml-1" style={{ color: todayLog.steps >= 8000 ? "#C8FF00" : "rgba(255,255,255,0.4)" }}>steps</span>
          </div>
        )}
      </div>
      <div className="flex gap-1 items-end" style={{ height: 32 }}>
        {weekSteps.map((s, i) => (
          <div key={i} className="flex-1 rounded-t-sm"
            style={{ height: Math.max((s / maxSteps) * 32, s > 0 ? 3 : 2), background: s >= 8000 ? "#C8FF00" : s > 0 ? "#C99A5C" : "rgba(255,255,255,0.06)" }} />
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="Steps" value={steps} onChange={(e) => setSteps(e.target.value)}
          style={{ flex: 1, background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem", outline: "none" }} />
        <input type="number" step="0.1" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)}
          style={{ width: 80, background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.875rem", outline: "none" }} />
        <button onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: "#C8FF00", flexShrink: 0 }}>Log</button>
      </div>
    </div>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────────

// Day color theme
const DAY_THEME: Record<string, { bg: string; accent: string; label: string }> = {
  "mon-heavy-glutes":    { bg: "linear-gradient(135deg,#1a2200 0%,#0d0d0d 100%)", accent: "#C8FF00", label: "Glute Day" },
  "tue-flexibility":     { bg: "linear-gradient(135deg,#1a0d2e 0%,#0d0d0d 100%)", accent: "#9B7FFF", label: "Flexibility" },
  "wed-stretch-glutes":  { bg: "linear-gradient(135deg,#1a2200 0%,#0d0d0d 100%)", accent: "#C8FF00", label: "Glute Day" },
  "thu-calisthenics":    { bg: "linear-gradient(135deg,#1f1500 0%,#0d0d0d 100%)", accent: "#C99A5C", label: "Skills" },
  "fri-pump-glutes":     { bg: "linear-gradient(135deg,#1a2200 0%,#0d0d0d 100%)", accent: "#C8FF00", label: "Glute Day" },
  "sat-flexibility-bridge": { bg: "linear-gradient(135deg,#1a0d2e 0%,#0d0d0d 100%)", accent: "#9B7FFF", label: "Flexibility" },
  "sun-recovery":        { bg: "linear-gradient(135deg,#1f0a10 0%,#0d0d0d 100%)", accent: "#DA667B", label: "Recovery" },
};

const BROWSE_CATEGORIES = [
  { label: "Glute Days",      accent: "#C8FF00", ids: ["mon-heavy-glutes","wed-stretch-glutes","fri-pump-glutes"] },
  { label: "Flexibility",     accent: "#9B7FFF", ids: ["tue-flexibility","sat-flexibility-bridge"] },
  { label: "Skills & Core",   accent: "#C99A5C", ids: ["thu-calisthenics"] },
  { label: "Recovery",        accent: "#DA667B", ids: ["sun-recovery"] },
];

function HomeTab({ data, update, onStartSession, prepTime, setPrepTime, onViewProgram }: Props & {
  onStartSession: (dayId: string) => void;
  prepTime: number;
  setPrepTime: (v: number) => void;
  onViewProgram: () => void;
}) {
  const w       = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const weekday = todayWeekday();
  const streak  = useMemo(() => calcStreak(w.sessionLogs), [w.sessionLogs]);
  const weekNum = getCurrentWeek(w.programStartDate);
  const phase   = weekNum > 0 ? getWeekPhase(weekNum) : null;

  const isDone = (d: typeof PROGRAM[number]) => w.sessionLogs.some((l) => {
    const ld = parseISO(l.date);
    const wd = ld.getDay() === 0 ? 6 : ld.getDay() - 1;
    return wd === d.weekday && l.completedAt && differenceInCalendarDays(new Date(), ld) < 7;
  });

  const todayDay = PROGRAM.find((d) => d.weekday === weekday) ?? PROGRAM[0];
  const todayDone = isDone(todayDay);
  const theme = DAY_THEME[todayDay.id] ?? DAY_THEME["mon-heavy-glutes"];

  const weekDone = PROGRAM.filter(isDone).length;

  const startProgram = () => {
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return { ...d, workout: { ...wd, programStartDate: todayStr() } };
    });
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h1 className="font-serif text-3xl text-white mt-0.5">Workout</h1>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.2)" }}>
                <Flame size={13} style={{ color: "#C8FF00" }} />
                <span className="text-sm font-semibold" style={{ color: "#C8FF00" }}>{streak} day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Week calendar strip ── */}
        <div className="flex gap-1.5">
          {PROGRAM.map((d) => {
            const isToday = d.weekday === weekday;
            const done = isDone(d);
            const acc = DAY_THEME[d.id]?.accent ?? "#C8FF00";
            return (
              <button key={d.id} onClick={() => onStartSession(d.id)}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all active:scale-95"
                style={{ background: isToday ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${isToday ? "rgba(200,255,0,0.25)" : "transparent"}` }}>
                <p className="text-[10px] font-semibold" style={{ color: isToday ? "#C8FF00" : "rgba(255,255,255,0.3)" }}>
                  {WEEK_DAYS[d.weekday]}
                </p>
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: done ? acc : isToday ? "rgba(200,255,0,0.2)" : "rgba(255,255,255,0.07)", border: isToday && !done ? `2px solid ${acc}` : "none" }}>
                  {done && <span style={{ color: acc === "#C8FF00" ? "#000" : "#fff", fontSize: "0.6rem", fontWeight: 700 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Week progress bar ── */}
        {w.programStartDate && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold" style={{ color: phase?.isDeload ? "#DA667B" : "#C8FF00" }}>
                Week {weekNum} of 6{phase?.isDeload ? " — DELOAD" : ` · ${phase?.label}`}
              </p>
              <button onClick={onViewProgram} className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Full plan →
              </button>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(weekNum / 6) * 100}%`, background: phase?.isDeload ? "#DA667B" : "#C8FF00" }} />
            </div>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {weekDone}/{PROGRAM.length} workouts this week · {phase?.guidance}
            </p>
          </div>
        )}

        {/* ── Today's hero card ── */}
        <div className="rounded-3xl overflow-hidden relative cursor-pointer active:opacity-90 transition-opacity"
          style={{ background: theme.bg, border: `1px solid ${theme.accent}33`, minHeight: 200 }}
          onClick={() => onStartSession(todayDay.id)}>
          {/* Background number */}
          <div className="absolute right-4 bottom-4 font-serif select-none pointer-events-none"
            style={{ fontSize: "7rem", lineHeight: 1, color: theme.accent, opacity: 0.07 }}>
            {String(weekday + 1)}
          </div>
          <div className="relative p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: `${theme.accent}22`, color: theme.accent }}>
                Today
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                {theme.label}
              </span>
              {todayDone && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${theme.accent}22`, color: theme.accent }}>✓ Done</span>
              )}
            </div>
            <div>
              <h2 className="font-serif leading-tight" style={{ fontSize: "2rem", color: "#fff" }}>{todayDay.label}</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                {buildFullExerciseList(todayDay).length} exercises · ~{todayDay.estimatedMinutes} min
                {todayDay.isGluteDay ? " · Glute focus" : ""}
              </p>
            </div>
            <button
              className="px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{ background: theme.accent, color: theme.accent === "#C8FF00" ? "#000" : "#fff" }}>
              {todayDone ? "Repeat Workout →" : "Start Workout →"}
            </button>
          </div>
        </div>

        {/* ── No program banner ── */}
        {!w.programStartDate && (
          <div className="rounded-2xl p-5 text-center space-y-3" style={{ background: "#141414", border: "1px solid rgba(200,255,0,0.2)" }}>
            <p className="font-serif text-xl text-white">Start the 6-Week Program</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Heavy glutes, flat stomach, no bulk. Track your transformation.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={startProgram}
                className="px-6 py-3 rounded-2xl font-semibold text-black active:scale-95 transition-transform"
                style={{ background: "#C8FF00" }}>Start Program</button>
              <button onClick={onViewProgram}
                className="px-6 py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>Preview</button>
            </div>
          </div>
        )}

        {/* ── Browse by category ── */}
        {BROWSE_CATEGORIES.map((cat) => {
          const days = cat.ids.map((id) => PROGRAM.find((d) => d.id === id)).filter(Boolean) as typeof PROGRAM;
          if (!days.length) return null;
          return (
            <div key={cat.label} className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <p className="text-sm font-bold text-white">{cat.label}</p>
                <p className="text-xs font-semibold" style={{ color: cat.accent }}>{days.length} workout{days.length > 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {days.map((d, idx) => {
                  const done = isDone(d);
                  const isToday = d.weekday === weekday;
                  return (
                    <div key={d.id} onClick={() => onStartSession(d.id)}
                      className="flex-shrink-0 rounded-2xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform"
                      style={{ width: 160, background: DAY_THEME[d.id]?.bg ?? "#141414", border: `1px solid ${cat.accent}33` }}>
                      {/* Big number */}
                      <div className="absolute right-2 bottom-2 font-serif select-none pointer-events-none"
                        style={{ fontSize: "4rem", lineHeight: 1, color: cat.accent, opacity: 0.12 }}>
                        {idx + 1}
                      </div>
                      <div className="relative p-3.5 space-y-2" style={{ minHeight: 120 }}>
                        {isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cat.accent}22`, color: cat.accent }}>Today</span>
                        )}
                        {done && !isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cat.accent}22`, color: cat.accent }}>✓ Done</span>
                        )}
                        <div className="pt-1">
                          <p className="text-xs font-semibold" style={{ color: cat.accent }}>{WEEK_DAYS[d.weekday]}</p>
                          <p className="font-serif text-sm text-white mt-0.5 leading-tight">{d.label}</p>
                          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                            ~{d.estimatedMinutes} min
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Settings ── */}
        <div className="rounded-2xl px-5 py-4 space-y-4" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Prep time per exercise</p>
              <span className="text-sm font-semibold" style={{ color: prepTime > 0 ? "#C8FF00" : "rgba(255,255,255,0.3)" }}>
                {prepTime === 0 ? "Off" : `${prepTime}s`}
              </span>
            </div>
            <input type="range" min={0} max={15} step={1} value={prepTime}
              onChange={(e) => setPrepTime(parseInt(e.target.value))}
              className="w-full" style={{ accentColor: "#C8FF00", cursor: "pointer" }} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Coaching Voice</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#C8FF00" }}>Aya — Custom Voice</p>
            </div>
            <button onClick={async () => {
              try {
                const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Drive through your heels and squeeze hard at the top. This is where your glutes grow." }) });
                if (!res.ok) return;
                new Audio(URL.createObjectURL(await res.blob())).play();
              } catch { /* blocked */ }
            }} className="text-xs px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
              style={{ background: "rgba(200,255,0,0.1)", color: "#C8FF00" }}>
              Test voice
            </button>
          </div>
        </div>

        <MeasurementsCard data={data} update={update} />
        <WeightCard data={data} update={update} />
        <WalkingCard data={data} update={update} />

      </div>
    </div>
  );
}

// ── Main WorkoutView ───────────────────────────────────────────────────────────

type Tab = "home" | "today" | "history";

export function WorkoutView({ data, update }: Props) {
  const [tab,           setTab]           = useState<Tab>("home");
  const [sessionDayId,  setSessionDayId]  = useState<string | null>(null);
  const [prepTime,      setPrepTime]      = useState(5);
  const [showProgram,   setShowProgram]   = useState(false);

  const w       = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const weekday = todayWeekday();
  const weekNum = getCurrentWeek(w.programStartDate);
  const isSunday = weekday === 6;

  const lastWeights = useMemo(() => {
    const map: Record<string, number> = {};
    PROGRAM.forEach((day) => {
      buildFullExerciseList(day).forEach((ex) => {
        if (!map[ex.id]) map[ex.id] = getLastWeights(w.sessionLogs, ex.id);
      });
    });
    return map;
  }, [w.sessionLogs]);

  const streak = useMemo(() => calcStreak(w.sessionLogs), [w.sessionLogs]);

  const startSession = (dayId: string) => {
    setSessionDayId(dayId);
    setTab("today");
  };

  const handleComplete = (logs: ExerciseSessionLog[]) => {
    const day = PROGRAM.find((d) => d.id === sessionDayId) ?? getProgramDay(weekday);
    if (!day) return;
    const session: WorkoutSessionLog = {
      id: id(),
      date: todayStr(),
      programDayId: day.id,
      dayLabel: day.label,
      exercises: logs,
      completedAt: new Date().toISOString(),
    };
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return { ...d, workout: { ...wd, sessionLogs: [...wd.sessionLogs, session] } };
    });
    setSessionDayId(null);
    setTab("home");
  };

  const activeDay = sessionDayId ? PROGRAM.find((d) => d.id === sessionDayId) : getProgramDay(weekday);

  // Full-screen session
  if (tab === "today" && activeDay) {
    return (
      <div className="h-full" style={{ background: "#0A0A0A" }}>
        <SessionView
          day={activeDay}
          weekNum={weekNum}
          lastWeights={lastWeights}
          streak={streak}
          isSunday={isSunday}
          prepTime={prepTime}
          onComplete={handleComplete}
          onExit={() => { setSessionDayId(null); setTab("home"); }}
        />
      </div>
    );
  }

  if (tab === "today" && !activeDay) setTab("home");

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: "#0A0A0A" }}>
      <div className="flex-1 overflow-hidden min-h-0">
        {tab === "home" && (
          <HomeTab data={data} update={update} onStartSession={startSession}
            prepTime={prepTime} setPrepTime={setPrepTime}
            onViewProgram={() => setShowProgram(true)} />
        )}
        {tab === "history" && <HistoryView data={data} />}
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 flex border-t" style={{ background: "#0D0D0D", borderColor: "rgba(255,255,255,0.07)" }}>
        {([["home", "Home", Home], ["today", "Today", Play], ["history", "History", TrendingUp]] as const).map(([tid, label, Icon]) => {
          const active = tab === tid;
          return (
            <button key={tid}
              onClick={() => {
                if (tid === "today") {
                  const d = getProgramDay(weekday);
                  if (d) startSession(d.id);
                } else {
                  setTab(tid);
                }
              }}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              style={{ color: active ? "#C8FF00" : "rgba(255,255,255,0.35)" }}>
              <Icon size={18} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Program overview overlay */}
      {showProgram && (
        <ProgramOverview onClose={() => setShowProgram(false)} />
      )}
    </div>
  );
}
