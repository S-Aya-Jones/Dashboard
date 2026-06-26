"use client";

import { useState, useMemo } from "react";
import { format, parseISO, differenceInCalendarDays, subDays, addDays } from "date-fns";
import { Play, Flame, TrendingUp, Home, ChevronRight, X, Camera } from "lucide-react";
import { DashboardData, ExerciseSessionLog, WorkoutSessionLog, MeasurementEntry, BodyWeightEntry } from "@/types/dashboard";
import {
  PROGRAM, WEEK_DAYS,
  todayWeekday, getProgramDay, getCurrentWeek, getWeekPhase, buildFullExerciseList,
  getPhaseEmojiAndColor, calculateWeeklyVolume, getProteinTarget,
} from "./program";
import { SessionView } from "./SessionView";
import { HistoryView } from "./HistoryView";
import { BodyScanView } from "./BodyScanView";
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
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "var(--bg)", zIndex: 80 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="font-serif text-xl" style={{ color: "var(--text)" }}>7-Week Hourglass Program</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Complete schedule — tap a day to expand</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Week phases */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: "var(--text-muted)" }}>Week Phases</p>
          {[
            { weeks: "Weeks 1–2", label: "Foundation", color: "#7C5CFC", desc: "Learn every movement. Build mind-muscle connection. Zero ego on weight." },
            { weeks: "Weeks 3–4", label: "Build", color: "#9B7FFF", desc: "Add load progressively. Volume rises. Visible shape change typically starts here." },
            { weeks: "Weeks 5–6", label: "Peak Intensity", color: "#C99A5C", desc: "Heaviest weights yet. Maximum stimulus with perfect form. Push every set." },
            { weeks: "Week 7", label: "Deload — Let It Grow", color: "#DA667B", desc: "50% of week 6 weight, same reps. Growth consolidates during recovery." },
          ].map(({ weeks, label, color, desc }) => (
            <div key={weeks} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
              <div>
                <p className="text-xs font-semibold" style={{ color }}>{weeks} · {label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Daily schedule */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: "var(--text-muted)" }}>Daily Schedule</p>
          {PROGRAM.map((day) => {
            const isExpanded = expandedDay === day.id;
            const fullList = buildFullExerciseList(day);
            return (
              <div key={day.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <button className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  onClick={() => setExpandedDay(isExpanded ? null : day.id)}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: day.isGluteDay ? "#7C5CFC" : "var(--text-muted)" }}>
                        {WEEK_DAYS[day.weekday]}
                      </span>
                      {day.isGluteDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(var(--terracotta-rgb),0.1)", color: "#7C5CFC" }}>Glute Day</span>
                      )}
                    </div>
                    <p className="font-serif text-base mt-0.5" style={{ color: "var(--text)" }}>{day.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-light)" }}>
                      {fullList.length} exercises · ~{day.estimatedMinutes} min
                    </p>
                  </div>
                  <ChevronRight size={16} className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} style={{ color: "var(--text-light)" }} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "var(--border)" }}>
                    {/* Warmup / Activation */}
                    {day.warmupExercises.length > 0 && (
                      <div className="pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#DA667B" }}>Activation</p>
                        <div className="space-y-1.5">
                          {day.warmupExercises.map((ex) => (
                            <div key={ex.id} className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#DA667B" }} />
                              <span className="text-sm" style={{ color: "var(--text)" }}>{ex.name}</span>
                              <span className="ml-auto text-xs" style={{ color: "var(--text-light)" }}>{ex.sets}×{ex.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Main exercises */}
                    <div className={day.warmupExercises.length === 0 ? "pt-3" : ""}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Main Work</p>
                      <div className="space-y-2">
                        {day.mainExercises.map((ex) => {
                          const dotColor = ex.category === "compound" ? "#7C5CFC" : ex.category === "isolation" ? "#9B7FFF" : ex.category === "core" ? "#DA667B" : "#C99A5C";
                          return (
                            <div key={ex.id}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                                <span className="text-sm" style={{ color: "var(--text)" }}>{ex.name}</span>
                                <span className="ml-auto text-xs flex-shrink-0" style={{ color: "var(--text-light)" }}>{ex.sets}×{ex.reps}</span>
                              </div>
                              <p className="text-xs pl-4 mt-0.5 leading-snug" style={{ color: "var(--text-light)" }}>{ex.formCue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cooldown */}
                    {day.cooldownExercises.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#C99A5C" }}>Cooldown</p>
                        <div className="space-y-1.5">
                          {day.cooldownExercises.map((ex) => (
                            <div key={ex.id} className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#C99A5C" }} />
                              <span className="text-sm" style={{ color: "var(--text)" }}>{ex.name}</span>
                              <span className="ml-auto text-xs" style={{ color: "var(--text-light)" }}>{ex.sets}×{ex.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Program rules */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Program Rules</p>
          {[
            { color: "#7C5CFC", rule: "Hip thrust: ribs down, 1-second squeeze, vertical shins at top. No exceptions." },
            { color: "#7C5CFC", rule: "Activation block before every session — 10 rushed sets beats 6 on sleepy glutes." },
            { color: "#9B7FFF", rule: "Dead Bug every session: lower back pressed flat the entire rep." },
            { color: "#9B7FFF", rule: "Core work never gets weight added. Progress through time and reps only." },
            { color: "#DA667B", rule: "Week 7 deload is mandatory — 50% weight, same reps. Growth consolidates here." },
            { color: "#C99A5C", rule: "Incline walk daily: 8–12% incline, 3.0–3.5 mph. Your fat-loss engine." },
            { color: "#C99A5C", rule: "Measure waist + hips every 2 weeks. Same time, same day." },
          ].map(({ color, rule }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{rule}</p>
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
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid rgba(var(--terracotta-rgb),0.15)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Measurements</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(var(--terracotta-rgb),0.1)", color: "#7C5CFC" }}>Most important</span>
      </div>
      {latest && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Waist", value: `${latest.waist}"` },
            { label: "Hips",  value: `${latest.hips}"` },
            { label: "Bust",  value: latest.bust ? `${latest.bust}"` : "—" },
            { label: "Ratio", value: ratio ? String(ratio) : "—", highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="rounded-xl py-2.5" style={{ background: "var(--bg2)" }}>
              <p className="font-serif text-lg" style={{ color: "var(--text)" }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: highlight ? "#7C5CFC" : "var(--text-muted)" }}>{label}</p>
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
              style={{ background: "rgba(var(--terracotta-rgb),0.06)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", width: "100%", outline: "none" }} />
          ))}
        </div>
        <button onClick={save} className="w-full py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: saved ? "#9B7FFF" : "#7C5CFC", color: "#fff" }}>
          {saved ? "Saved" : "Log Measurements"}
        </button>
      </div>
    </div>
  );
}

// ── Weight Tracker ─────────────────────────────────────────────────────────────

function WeightCard({ data, update }: Props) {
  const w       = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
  const today   = todayStr();
  const START_DATE = "2026-06-13"; // This Friday

  const [input,    setInput]   = useState("");
  const [goal,     setGoalIn]  = useState(w.goalWeight ? String(w.goalWeight) : "");
  const [saved,    setSaved]   = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const sorted  = [...w.bodyWeight].sort((a, b) => b.date.localeCompare(a.date));
  const latest  = sorted[0];
  const current = latest?.weight ?? 0;
  const startWeight = sorted[sorted.length - 1]?.weight ?? current;
  const goalW   = w.goalWeight ?? 0;

  // Progress
  const totalToLose  = startWeight - goalW;
  const lostSoFar    = startWeight - current;
  const pct          = goalW && startWeight && totalToLose > 0
    ? Math.min(100, Math.max(0, Math.round((lostSoFar / totalToLose) * 100)))
    : 0;
  const lbsLeft      = Math.max(0, current - goalW);

  // Roadmap — safe rate 1–1.5 lbs/week
  const weeksToGoal  = goalW && current ? Math.ceil(lbsLeft / 1.25) : 0;
  const endDate      = weeksToGoal > 0 ? addDays(new Date(START_DATE), weeksToGoal * 7) : null;

  // Milestones every 25%
  const milestones = goalW && startWeight && totalToLose > 0
    ? [25, 50, 75, 100].map((pctMile) => ({
        pct: pctMile,
        weight: +(startWeight - (totalToLose * pctMile) / 100).toFixed(1),
        reached: lostSoFar / totalToLose >= pctMile / 100,
      }))
    : [];

  // Weekly log — last 8 weeks
  const weeklyLog = Array.from({ length: 8 }, (_, i) => {
    const d = format(subDays(new Date(), (7 - i) * 7), "yyyy-MM-dd");
    const entry = w.bodyWeight.find((b) => b.date >= d && b.date <= format(addDays(new Date(d), 6), "yyyy-MM-dd"));
    return { week: i + 1, weight: entry?.weight ?? null };
  }).filter(w => w.weight !== null);

  const save = () => {
    const val  = parseFloat(input); if (!val) return;
    const gVal = parseFloat(goal);
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return {
        ...d,
        workout: {
          ...wd,
          bodyWeight:  [...wd.bodyWeight.filter((b) => b.date !== today), { date: today, weight: val } as BodyWeightEntry],
          goalWeight:  gVal || wd.goalWeight,
          programStartDate: wd.programStartDate ?? START_DATE,
        },
      };
    });
    setInput(""); setShowSetup(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const needsSetup = !current || !goalW;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Weight Roadmap</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Starting Friday Jun 13
          </p>
        </div>
        <div className="text-right">
          {current > 0 && <p className="font-serif text-2xl" style={{ color: "var(--text)" }}>{current}<span className="text-sm font-sans ml-1" style={{ color: "var(--text-muted)" }}>lbs</span></p>}
          {goalW > 0 && <p className="text-xs" style={{ color: "#9B7FFF" }}>Goal: {goalW} lbs</p>}
        </div>
      </div>

      {/* Progress bar */}
      {goalW > 0 && current > 0 && (
        <div className="px-5 pb-3 space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{lbsLeft > 0 ? `${lbsLeft.toFixed(1)} lbs to go` : "🎉 Goal reached!"}</span>
            <span style={{ color: "#9B7FFF" }}>{pct}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(var(--terracotta-rgb),0.08)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(pct, 2)}%`, background: "linear-gradient(90deg, #7C5CFC, #9B7FFF)" }} />
          </div>
          {/* Milestone markers */}
          {milestones.length > 0 && (
            <div className="flex justify-between mt-2">
              {milestones.map((m) => (
                <div key={m.pct} className="flex flex-col items-center gap-0.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: m.reached ? "#7C5CFC" : "rgba(var(--terracotta-rgb),0.1)",
                      color: m.reached ? "#fff" : "var(--text-muted)",
                    }}>
                    {m.reached ? "✓" : `${m.pct}%`}
                  </div>
                  <p className="text-[9px]" style={{ color: "var(--text-light)" }}>{m.weight}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roadmap timeline */}
      {weeksToGoal > 0 && endDate && (
        <div className="mx-5 mb-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(var(--terracotta-rgb),0.05)", border: "1px solid rgba(var(--terracotta-rgb),0.12)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9B7FFF" }}>Your Roadmap</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Start</p>
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>Jun 13</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{startWeight} lbs</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Rate</p>
              <p className="text-xs font-bold" style={{ color: "#9B7FFF" }}>~1.25/wk</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{weeksToGoal} weeks</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Goal Date</p>
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{format(endDate, "MMM d")}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{goalW} lbs</p>
            </div>
          </div>

          {/* Weekly breakdown — 30/60/90 day checkpoints */}
          <div className="space-y-1 pt-1" style={{ borderTop: "1px solid rgba(var(--terracotta-rgb),0.1)" }}>
            {[
              { label: "30 days", weeks: 4 },
              { label: "60 days", weeks: 9 },
              { label: "90 days", weeks: 13 },
            ].filter(c => c.weeks <= weeksToGoal + 2).map(checkpoint => {
              const projectedWeight = +(startWeight - (1.25 * checkpoint.weeks)).toFixed(1);
              const checkDate = format(addDays(new Date(START_DATE), checkpoint.weeks * 7), "MMM d");
              const alreadyPast = current <= projectedWeight;
              return (
                <div key={checkpoint.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: alreadyPast ? "#7C5CFC" : "rgba(var(--terracotta-rgb),0.3)" }} />
                    <span style={{ color: "var(--text-muted)" }}>{checkpoint.label} · {checkDate}</span>
                  </div>
                  <span className="font-semibold" style={{ color: alreadyPast ? "#9B7FFF" : "var(--text)" }}>
                    {alreadyPast ? "✓ " : ""}{Math.max(projectedWeight, goalW)} lbs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly history sparkline */}
      {weeklyLog.length > 1 && (
        <div className="px-5 pb-3">
          <p className="text-[10px] font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Weekly trend</p>
          <div className="flex items-end gap-1 h-10">
            {weeklyLog.map((w, i) => {
              const allWeights = weeklyLog.map(x => x.weight as number);
              const minW = Math.min(...allWeights);
              const maxW = Math.max(...allWeights);
              const range = maxW - minW || 1;
              const barH = Math.max(15, Math.round(((w.weight as number) - minW) / range * 32) + 8);
              const isLatest = i === weeklyLog.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm" style={{
                    height: barH,
                    background: isLatest ? "#7C5CFC" : "rgba(var(--terracotta-rgb),0.25)",
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log weight */}
      <div className="px-5 pb-5">
        {needsSetup || showSetup ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {needsSetup ? "Set your starting weight & goal to unlock your roadmap" : "Log weight"}
            </p>
            <div className="flex gap-2">
              <input type="number" step="0.5" placeholder="Current lbs" value={input} onChange={(e) => setInput(e.target.value)}
                style={{ flex: 1, background: "rgba(var(--terracotta-rgb),0.06)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
              <input type="number" step="0.5" placeholder="Goal lbs" value={goal} onChange={(e) => setGoalIn(e.target.value)}
                style={{ width: 90, background: "rgba(var(--terracotta-rgb),0.06)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
              <button onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: saved ? "#9B7FFF" : "#7C5CFC", color: "#fff", flexShrink: 0 }}>
                {saved ? "✓" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowSetup(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(var(--terracotta-rgb),0.08)", color: "#9B7FFF" }}>
            + Log Today&apos;s Weight
          </button>
        )}
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
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Walking</p>
        {todayLog?.steps && (
          <div className="text-right">
            <span className="font-serif text-xl" style={{ color: "var(--text)" }}>{todayLog.steps.toLocaleString()}</span>
            <span className="text-xs ml-1" style={{ color: todayLog.steps >= 8000 ? "#7C5CFC" : "var(--text-muted)" }}>steps</span>
          </div>
        )}
      </div>
      <div className="flex gap-1 items-end" style={{ height: 32 }}>
        {weekSteps.map((s, i) => (
          <div key={i} className="flex-1 rounded-t-sm"
            style={{ height: Math.max((s / maxSteps) * 32, s > 0 ? 3 : 2), background: s >= 8000 ? "#7C5CFC" : s > 0 ? "#C99A5C" : "rgba(var(--terracotta-rgb),0.06)" }} />
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="Steps" value={steps} onChange={(e) => setSteps(e.target.value)}
          style={{ flex: 1, background: "rgba(var(--terracotta-rgb),0.06)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
        <input type="number" step="0.1" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)}
          style={{ width: 80, background: "rgba(var(--terracotta-rgb),0.06)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
        <button onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#7C5CFC", color: "#fff", flexShrink: 0 }}>Log</button>
      </div>
    </div>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────────

// Day color theme
const DAY_THEME: Record<string, { bg: string; accent: string; label: string }> = {
  "mon-heavy-glutes":    { bg: "linear-gradient(135deg,#7C5CFC1a 0%,var(--bg2) 100%)", accent: "#7C5CFC", label: "Glute Day" },
  "tue-flexibility":     { bg: "linear-gradient(135deg,#9B7FFF1a 0%,var(--bg2) 100%)", accent: "#9B7FFF", label: "Flexibility" },
  "wed-stretch-glutes":  { bg: "linear-gradient(135deg,#7C5CFC1a 0%,var(--bg2) 100%)", accent: "#7C5CFC", label: "Glute Day" },
  "thu-calisthenics":    { bg: "linear-gradient(135deg,#C99A5C1a 0%,var(--bg2) 100%)", accent: "#C99A5C", label: "Skills" },
  "fri-pump-glutes":     { bg: "linear-gradient(135deg,#7C5CFC1a 0%,var(--bg2) 100%)", accent: "#7C5CFC", label: "Glute Day" },
  "sat-flexibility-bridge": { bg: "linear-gradient(135deg,#9B7FFF1a 0%,var(--bg2) 100%)", accent: "#9B7FFF", label: "Flexibility" },
  "sun-recovery":        { bg: "linear-gradient(135deg,#DA667B1a 0%,var(--bg2) 100%)", accent: "#DA667B", label: "Recovery" },
};

const BROWSE_CATEGORIES = [
  { label: "Glute Days",      accent: "#7C5CFC", ids: ["mon-heavy-glutes","wed-stretch-glutes","fri-pump-glutes"] },
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

  const weekDone       = PROGRAM.filter(isDone).length;
  const totalCompleted = w.sessionLogs.length;

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
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-light)" }}>
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h1 className="font-serif text-3xl mt-0.5" style={{ color: "var(--text)" }}>Workout</h1>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(var(--terracotta-rgb),0.1)", border: "1px solid rgba(var(--terracotta-rgb),0.2)" }}>
              <Flame size={13} style={{ color: "#7C5CFC" }} />
              <span className="text-sm font-semibold" style={{ color: "#7C5CFC" }}>{streak} day streak</span>
            </div>
          )}
        </div>

        {/* ── Stats tracker ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: totalCompleted, label: "Sessions", color: "#7C5CFC", sub: "all time" },
            { value: weekDone,       label: "This Week", color: "#9B7FFF", sub: `of ${PROGRAM.length}` },
            { value: streak,         label: "Streak",    color: "#DA667B", sub: streak === 1 ? "day" : "days" },
          ].map(({ value, label, color, sub }) => (
            <div key={label} className="rounded-2xl p-4 text-center flex flex-col items-center gap-0.5"
              style={{ background: "var(--surface)", border: `1px solid ${color}22` }}>
              <p className="font-serif text-3xl leading-none" style={{ color }}>{value}</p>
              <p className="text-xs font-semibold mt-1" style={{ color: "var(--text)" }}>{label}</p>
              <p className="text-[10px]" style={{ color: "var(--text-light)" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Week calendar strip ── */}
        <div className="flex gap-1.5">
          {PROGRAM.map((d) => {
            const isToday = d.weekday === weekday;
            const done = isDone(d);
            const acc = DAY_THEME[d.id]?.accent ?? "#7C5CFC";
            return (
              <button key={d.id} onClick={() => onStartSession(d.id)}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all active:scale-95"
                style={{ background: isToday ? "rgba(var(--terracotta-rgb),0.1)" : "rgba(var(--terracotta-rgb),0.04)", border: `1px solid ${isToday ? "rgba(var(--terracotta-rgb),0.25)" : "transparent"}` }}>
                <p className="text-[10px] font-semibold" style={{ color: isToday ? "#7C5CFC" : "var(--text-light)" }}>
                  {WEEK_DAYS[d.weekday]}
                </p>
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: done ? acc : isToday ? "rgba(var(--terracotta-rgb),0.2)" : "rgba(var(--terracotta-rgb),0.07)", border: isToday && !done ? `2px solid ${acc}` : "none" }}>
                  {done && <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Week progress bar ── */}
        {w.programStartDate && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold" style={{ color: phase?.isDeload ? "#DA667B" : "#7C5CFC" }}>
                Week {weekNum} of 7{phase?.isDeload ? " — DELOAD" : ` · ${phase?.label}`}
              </p>
              <button onClick={onViewProgram} className="text-xs" style={{ color: "var(--text-light)" }}>
                Full plan →
              </button>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--terracotta-rgb),0.08)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(weekNum / 7) * 100}%`, background: phase?.isDeload ? "#DA667B" : "#7C5CFC" }} />
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-light)" }}>
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
                style={{ background: "rgba(var(--terracotta-rgb),0.06)", color: "var(--text-muted)" }}>
                {theme.label}
              </span>
              {todayDone && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${theme.accent}22`, color: theme.accent }}>✓ Done</span>
              )}
            </div>
            <div>
              <h2 className="font-serif leading-tight" style={{ fontSize: "2rem", color: "var(--text)" }}>{todayDay.label}</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {buildFullExerciseList(todayDay).length} exercises · ~{todayDay.estimatedMinutes} min
                {todayDay.isGluteDay ? " · Glute focus" : ""}
              </p>
            </div>
            <button
              className="px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{ background: theme.accent, color: "#fff" }}>
              {todayDone ? "Repeat Workout →" : "Start Workout →"}
            </button>
          </div>
        </div>

        {/* ── No program banner ── */}
        {!w.programStartDate && (
          <div className="rounded-2xl p-5 text-center space-y-3" style={{ background: "var(--surface)", border: "1px solid rgba(var(--terracotta-rgb),0.2)" }}>
            <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Start the 7-Week Hourglass Program</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Maximum glutes, flat stomach, zero bulk. Built for transformation.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={startProgram}
                className="px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-transform"
                style={{ background: "#7C5CFC", color: "#fff" }}>Start Program</button>
              <button onClick={onViewProgram}
                className="px-6 py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
                style={{ background: "rgba(var(--terracotta-rgb),0.07)", color: "var(--text-muted)" }}>Preview</button>
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
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{cat.label}</p>
                <p className="text-xs font-semibold" style={{ color: cat.accent }}>{days.length} workout{days.length > 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {days.map((d, idx) => {
                  const done = isDone(d);
                  const isToday = d.weekday === weekday;
                  return (
                    <div key={d.id} onClick={() => onStartSession(d.id)}
                      className="flex-shrink-0 rounded-2xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform"
                      style={{ width: 160, background: DAY_THEME[d.id]?.bg ?? "var(--bg2)", border: `1px solid ${cat.accent}33` }}>
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
                          <p className="font-serif text-sm mt-0.5 leading-tight" style={{ color: "var(--text)" }}>{d.label}</p>
                          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
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
        <div className="rounded-2xl px-5 py-4 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Prep time per exercise</p>
              <span className="text-sm font-semibold" style={{ color: prepTime > 0 ? "#7C5CFC" : "var(--text-light)" }}>
                {prepTime === 0 ? "Off" : `${prepTime}s`}
              </span>
            </div>
            <input type="range" min={0} max={15} step={1} value={prepTime}
              onChange={(e) => setPrepTime(parseInt(e.target.value))}
              className="w-full" style={{ accentColor: "#7C5CFC", cursor: "pointer" }} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Coaching Voice</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#7C5CFC" }}>Aya — Custom Voice</p>
            </div>
            <button onClick={async () => {
              try {
                const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Drive through your heels and squeeze hard at the top. This is where your glutes grow." }) });
                if (!res.ok) return;
                new Audio(URL.createObjectURL(await res.blob())).play();
              } catch { /* blocked */ }
            }} className="text-xs px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
              style={{ background: "rgba(var(--terracotta-rgb),0.1)", color: "#7C5CFC" }}>
              Test voice
            </button>
          </div>
        </div>

        {/* ── PHASE COACHING ── */}
        {weekNum > 0 && phase && (
          <>
            {/* Phase badge */}
            {phase.isDeload && (
              <div className="rounded-2xl p-5 space-y-3 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg,#f9e8eb 0%,#f4e8f0 100%)", border: "2px solid #DA667B" }}>
                <div className="absolute top-2 right-3 text-4xl opacity-15">🌱</div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🌱</span>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#DA667B" }}>Week {weekNum} — DELOAD</span>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Growth happens during recovery</p>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Use 50% weight. Same reps, same intensity mentally. Your body consolidates gains this week — trust the process.
                  </p>
                </div>
              </div>
            )}

            {!phase.isDeload && (
              <div className="rounded-2xl p-5 space-y-3"
                style={{
                  background: `${getPhaseEmojiAndColor(weekNum).color}08`,
                  border: `1px solid ${getPhaseEmojiAndColor(weekNum).color}33`,
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {getPhaseEmojiAndColor(weekNum).emoji} Week {weekNum} — {phase.label}
                    </p>
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {phase.guidance}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* APT Checkup Reminder */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid rgba(var(--terracotta-rgb),0.2)" }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔍</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>APT Self-Check</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Before your workout, check: Is your lower-back exaggerated? Belly sticking out? If yes, do 2 activation sets first.
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly Volume */}
            {w.sessionLogs.length > 0 && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>This Week&apos;s Volume</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="font-serif text-3xl" style={{ color: "#7C5CFC" }}>
                      {Math.round(calculateWeeklyVolume(w.sessionLogs, format(subDays(new Date(), 6), "yyyy-MM-dd")) / 1000)}k
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>lbs lifted</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--terracotta-rgb),0.07)" }}>
                    <div className="h-full rounded-full" style={{ width: "65%", background: "#7C5CFC" }} />
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {weekDone}/{PROGRAM.length} workouts this week
                  </p>
                </div>
              </div>
            )}

            {/* Incline Walk Reminder */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(201,154,92,0.08)", border: "1px solid rgba(201,154,92,0.25)" }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚶</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Incline Walk Daily</p>
                  <p className="text-xs mt-1" style={{ color: "#C99A5C" }}>
                    25–30 min, 8–12% incline, 3.0–3.5 mph. Your fat-loss engine. Do it every day — rest days included.
                  </p>
                </div>
              </div>
            </div>

            {/* Protein Target */}
            {w.bodyWeight.length > 0 && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(218,102,123,0.08)", border: "1px solid rgba(218,102,123,0.25)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Daily Protein Target</p>
                <p className="font-serif text-2xl mt-2" style={{ color: "#DA667B" }}>
                  {getProteinTarget(w.bodyWeight[w.bodyWeight.length - 1]?.weight)}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Spread across 3–4 meals. Protects muscle in deficit, drives growth, keeps you full.
                </p>
              </div>
            )}
          </>
        )}

        <MeasurementsCard data={data} update={update} />
        <WeightCard data={data} update={update} />
        <WalkingCard data={data} update={update} />

      </div>
    </div>
  );
}

// ── Main WorkoutView ───────────────────────────────────────────────────────────

type Tab = "home" | "today" | "history" | "bodyscans";

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

  const streak         = useMemo(() => calcStreak(w.sessionLogs), [w.sessionLogs]);
  const totalCompleted = w.sessionLogs.length;

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
      <div className="h-full" style={{ background: "var(--bg)" }}>
        <SessionView
          day={activeDay}
          weekNum={weekNum}
          lastWeights={lastWeights}
          streak={streak}
          totalCompleted={totalCompleted}
          isSunday={isSunday}
          prepTime={prepTime}
          onComplete={handleComplete}
          onExit={() => { setSessionDayId(null); setTab("home"); }}
          update={update}
          data={data}
        />
      </div>
    );
  }

  if (tab === "today" && !activeDay) setTab("home");

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: "var(--bg)" }}>
      <div className="flex-1 overflow-hidden min-h-0">
        {tab === "home" && (
          <HomeTab data={data} update={update} onStartSession={startSession}
            prepTime={prepTime} setPrepTime={setPrepTime}
            onViewProgram={() => setShowProgram(true)} />
        )}
        {tab === "history" && <HistoryView data={data} />}
        {tab === "bodyscans" && <BodyScanView data={data} update={update} />}
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 flex border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {([["home", "Home", Home], ["today", "Today", Play], ["bodyscans", "Scans", Camera], ["history", "History", TrendingUp]] as const).map(([tid, label, Icon]) => {
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
              style={{ color: active ? "#7C5CFC" : "var(--text-light)" }}>
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
