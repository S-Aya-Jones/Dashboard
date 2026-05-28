"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Volume2, SkipForward } from "lucide-react";
import { ProgramDay } from "./program";
import { ExerciseSessionLog, WorkoutSetLog } from "@/types/dashboard";

interface Props {
  day: ProgramDay;
  lastWeights: Record<string, number>; // exerciseId → last weight used
  onComplete: (logs: ExerciseSessionLog[]) => void;
  onExit: () => void;
}

function playBeep(frequency = 880, duration = 0.4) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch {}
}

// Circular countdown ring
function RestRing({ remaining, total }: { remaining: number; total: number }) {
  const pct = remaining / total;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={128} height={128} className="-rotate-90">
      <circle cx={64} cy={64} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle
        cx={64} cy={64} r={r} fill="none"
        stroke="#C8FF00" strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s linear" }}
      />
    </svg>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  compound: "#C8FF00",
  isolation: "#9B7FFF",
  core: "#DA667B",
  mobility: "#C99A5C",
};

export function SessionView({ day, lastWeights, onComplete, onExit }: Props) {
  const exercises = day.exercises;
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  // exerciseId → completed sets
  const [loggedSets, setLoggedSets] = useState<Record<string, WorkoutSetLog[]>>({});
  const [weight, setWeight] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rest, setRest] = useState<{ remaining: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ex = exercises[exIdx];
  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
  const completedSets =
    Object.values(loggedSets).reduce((s, sets) => s + sets.length, 0);
  const progressPct = Math.min((completedSets / totalSets) * 100, 100);

  // Prefill weight when exercise changes
  useEffect(() => {
    if (!ex) return;
    const prev = lastWeights[ex.id];
    setWeight(prev ? String(prev) : "");
    setRepsInput("");
    if (!ex.isBodyweight) {
      const repsNum = ex.reps.match(/\d+/)?.[0] ?? "";
      setRepsInput(repsNum);
    }
    // Announce exercise
    const isNewEx = setIdx === 0;
    if (isNewEx) {
      setTimeout(() => {
        speak(`${ex.name}. ${ex.reps} reps. ${ex.formCue}`);
      }, 400);
    }
  }, [exIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startRest = useCallback((seconds: number, nextExName?: string) => {
    if (seconds <= 0) return;
    setRest({ remaining: seconds, total: seconds });
    timerRef.current = setInterval(() => {
      setRest((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          clearTimer();
          playBeep(880, 0.3);
          setTimeout(() => playBeep(1100, 0.3), 350);
          if (nextExName) setTimeout(() => speak(`Time's up. Next: ${nextExName}.`), 100);
          else setTimeout(() => speak("Time's up. Go!"), 100);
          return null;
        }
        if (prev.remaining === 4) playBeep(440, 0.15);
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }, [clearTimer]);

  const completeSet = () => {
    if (!ex) return;
    const w = ex.isBodyweight ? 0 : (parseFloat(weight) || 0);
    const r = parseInt(repsInput) || 0;
    const entry: WorkoutSetLog = { weight: w, reps: r };
    setLoggedSets((prev) => ({
      ...prev,
      [ex.id]: [...(prev[ex.id] ?? []), entry],
    }));

    const nextSetIdx = setIdx + 1;
    const nextExIdx = exIdx + 1;
    const isLastSetOfEx = nextSetIdx >= ex.sets;
    const isLastEx = isLastSetOfEx && nextExIdx >= exercises.length;

    if (isLastEx) {
      setDone(true);
      return;
    }

    const restSecs = ex.restSeconds;
    const nextEx = isLastSetOfEx ? exercises[nextExIdx] : null;

    if (restSecs > 0) {
      startRest(restSecs, nextEx?.name);
      // Advance state after timer (timer clears automatically)
      setTimeout(() => {
        if (isLastSetOfEx) {
          setExIdx(nextExIdx);
          setSetIdx(0);
        } else {
          setSetIdx(nextSetIdx);
        }
      }, restSecs * 1000 + 200);
    } else {
      if (isLastSetOfEx) {
        setExIdx(nextExIdx);
        setSetIdx(0);
      } else {
        setSetIdx(nextSetIdx);
      }
    }
  };

  const skipRest = () => {
    clearTimer();
    setRest(null);
  };

  const finishSession = () => {
    const logs: ExerciseSessionLog[] = exercises.map((e) => ({
      exerciseId: e.id,
      exerciseName: e.name,
      sets: loggedSets[e.id] ?? [],
    }));
    onComplete(logs);
  };

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!ex) return null;

  const prevWeight = lastWeights[ex.id];
  const catColor = CATEGORY_COLOR[ex.category] ?? "#FFFFFF";
  const setsForThisEx = loggedSets[ex.id]?.length ?? 0;

  // ── Done screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8 gap-6">
        <div className="text-6xl font-serif" style={{ color: "#C8FF00" }}>✓</div>
        <div>
          <h2 className="font-serif text-3xl text-white">{day.label} complete</h2>
          <p className="text-white/50 mt-2">Great work. You showed up.</p>
        </div>
        <button
          onClick={finishSession}
          className="px-8 py-4 rounded-2xl font-semibold text-black text-lg"
          style={{ background: "#C8FF00" }}
        >
          Save Workout
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: "#C8FF00" }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs font-medium" style={{ color: "#C8FF00" }}>{day.label}</p>
          <p className="text-white/40 text-xs mt-0.5">
            Exercise {exIdx + 1} of {exercises.length}
          </p>
        </div>
        <button
          onClick={onExit}
          className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main exercise area */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
        {/* Category + name */}
        <div>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ color: catColor, background: `${catColor}18` }}
          >
            {ex.category}
          </span>
          <h2 className="font-serif text-3xl text-white mt-3 leading-tight">{ex.name}</h2>
          <p className="text-white/50 text-sm mt-1">
            Set {setIdx + 1} of {ex.sets} · {ex.reps}
          </p>
        </div>

        {/* YouTube thumbnail */}
        {ex.videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${ex.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden relative group"
            style={{ background: "#1A1A1A" }}
          >
            <img
              src={`https://img.youtube.com/vi/${ex.videoId}/mqdefault.jpg`}
              alt={`${ex.name} demo`}
              className="w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ maxHeight: 160 }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.9)" }}>
                <div className="w-0 h-0 ml-1" style={{ borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "14px solid #0A0A0A" }} />
              </div>
            </div>
            <p className="absolute bottom-2 right-3 text-xs text-white/60">Watch demo</p>
          </a>
        )}

        {/* Previous weight */}
        {prevWeight && !ex.isBodyweight && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(200,255,0,0.07)", border: "1px solid rgba(200,255,0,0.15)" }}>
            <span className="text-xs text-white/50">Last session:</span>
            <span className="text-sm font-semibold" style={{ color: "#C8FF00" }}>{prevWeight} lbs</span>
            <button
              className="ml-auto text-xs text-white/40 hover:text-white transition-colors"
              onClick={() => setWeight(String(prevWeight))}
            >
              Use
            </button>
          </div>
        )}

        {/* Weight + reps inputs */}
        {!ex.isBodyweight && (
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Weight (lbs)</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeight((v) => String(Math.max(0, (parseFloat(v) || 0) - 5)))}
                className="w-11 h-11 rounded-xl text-xl font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                style={{ background: "#1A1A1A" }}
              >
                −
              </button>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                className="flex-1 text-center text-2xl font-semibold"
                style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.75rem", padding: "0.6rem", color: "#FFFFFF" }}
              />
              <button
                onClick={() => setWeight((v) => String((parseFloat(v) || 0) + 5))}
                className="w-11 h-11 rounded-xl text-xl font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                style={{ background: "#1A1A1A" }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {!ex.isBodyweight && (
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Reps completed</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRepsInput((v) => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                className="w-11 h-11 rounded-xl text-xl font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                style={{ background: "#1A1A1A" }}
              >
                −
              </button>
              <input
                type="number"
                value={repsInput}
                onChange={(e) => setRepsInput(e.target.value)}
                placeholder="0"
                className="flex-1 text-center text-2xl font-semibold"
                style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.75rem", padding: "0.6rem", color: "#FFFFFF" }}
              />
              <button
                onClick={() => setRepsInput((v) => String((parseInt(v) || 0) + 1))}
                className="w-11 h-11 rounded-xl text-xl font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                style={{ background: "#1A1A1A" }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Form cue */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Volume2 size={14} className="text-white/30 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-white/60 leading-relaxed">{ex.formCue}</p>
          <button
            onClick={() => speak(`${ex.name}. ${ex.formCue}`)}
            className="ml-auto text-white/30 hover:text-white transition-colors flex-shrink-0"
          >
            <Volume2 size={14} />
          </button>
        </div>

        {/* Set chips */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: ex.sets }, (_, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: i < setsForThisEx ? catColor : "rgba(255,255,255,0.06)",
                color: i < setsForThisEx ? "#000" : "rgba(255,255,255,0.4)",
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Complete Set button */}
      <div className="px-5 pb-6 flex-shrink-0">
        <button
          onClick={completeSet}
          className="w-full py-4 rounded-2xl font-semibold text-black text-lg"
          style={{ background: "#C8FF00" }}
        >
          {ex.isBodyweight ? "Done" : "Complete Set"}
        </button>
      </div>

      {/* Rest timer overlay */}
      {rest && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-8"
          style={{ background: "#0A0A0A", zIndex: 20 }}
        >
          <p className="text-white/50 text-sm uppercase tracking-widest">Rest</p>
          <div className="relative flex items-center justify-center">
            <RestRing remaining={rest.remaining} total={rest.total} />
            <div className="absolute flex flex-col items-center">
              <span className="font-serif text-5xl text-white">{rest.remaining}</span>
              <span className="text-xs text-white/40">sec</span>
            </div>
          </div>
          {exIdx + 1 < exercises.length && setIdx + 1 >= ex.sets && (
            <div className="space-y-1">
              <p className="text-xs text-white/30">Up next</p>
              <p className="font-serif text-xl text-white">{exercises[exIdx + 1]?.name}</p>
            </div>
          )}
          <button
            onClick={skipRest}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm text-white/50 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <SkipForward size={15} />
            Skip rest
          </button>
        </div>
      )}
    </div>
  );
}
