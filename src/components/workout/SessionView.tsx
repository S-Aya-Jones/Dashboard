"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Volume2, SkipForward, Pause, Play, Plus, ChevronLeft, ChevronRight, ExternalLink, ChevronsRight } from "lucide-react";
import { ProgramDay, ProgramExercise, CORE_PRIMER, HIP_FLEXOR_UNLOCK, getWeekPhase, suggestWeight, CATEGORY_CUES, UNIVERSAL_CUES } from "./program";
import { ExerciseSessionLog, WorkoutSetLog } from "@/types/dashboard";

interface Props {
  day: ProgramDay;
  weekNum: number;
  lastWeights: Record<string, number>;
  streak: number;
  totalCompleted: number;
  isSunday: boolean;
  prepTime: number;
  onComplete: (logs: ExerciseSessionLog[]) => void;
  onExit: () => void;
}

interface WorkoutSection {
  id: string;
  label: string;
  color: string;
  exercises: ProgramExercise[];
}

// ── Audio / haptic utils ───────────────────────────────────────────────────────

function haptic(pattern: number | number[] = 15) {
  try { if (typeof navigator !== "undefined") navigator.vibrate(pattern); } catch { /* */ }
}

function playBeep(freq = 880, dur = 0.35) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* blocked */ }
}

// Client-side TTS cache: text → blob URL
const ttsCache = new Map<string, string>();

async function speak(text: string) {
  try {
    if (typeof window === "undefined") return;
    let url = ttsCache.get(text);
    if (!url) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      ttsCache.set(text, url);
    }
    new Audio(url).play();
  } catch {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.88; u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch { /* blocked */ }
  }
}

async function prewarmTTS(text: string) {
  if (ttsCache.has(text)) return;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    ttsCache.set(text, URL.createObjectURL(blob));
  } catch { /* silently fail */ }
}

// ── Components ─────────────────────────────────────────────────────────────────

function RestRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 52, circ = 2 * Math.PI * r, pct = total > 0 ? remaining / total : 0;
  return (
    <svg width={124} height={124} className="-rotate-90">
      <circle cx={62} cy={62} r={r} fill="none" stroke="rgba(124,92,252,0.07)" strokeWidth={7} />
      <circle cx={62} cy={62} r={r} fill="none" stroke="#7C5CFC" strokeWidth={7}
        strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s linear" }} />
    </svg>
  );
}

const CAT_COLOR: Record<string, string> = {
  compound: "#7C5CFC", isolation: "#9B7FFF",
  core: "#DA667B", mobility: "#C99A5C", flexibility: "#C99A5C",
};

function VideoBlock({ ex, animKey }: { ex: ProgramExercise; animKey: number }) {
  if (ex.videoId) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: "#000", aspectRatio: "16/9" }}>
        <iframe
          key={`${ex.videoId}-${animKey}`}
          src={`https://www.youtube.com/embed/${ex.videoId}?rel=0&modestbranding=1&controls=1&autoplay=1&mute=1&playsinline=1`}
          title={`${ex.name} tutorial`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          style={{ border: "none", display: "block" }}
        />
      </div>
    );
  }
  return (
    <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + " exercise form tutorial")}`}
      target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between px-4 py-3 rounded-2xl active:scale-95 transition-transform"
      style={{ background: "var(--surface2)", border: "1px solid rgba(124,92,252,0.06)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FF0000" }}>
          <div className="w-0 h-0 ml-0.5" style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "11px solid white" }} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Watch Demo</p>
          <p className="text-xs" style={{ color: "rgba(30,19,64,0.35)" }}>{ex.name} tutorial on YouTube</p>
        </div>
      </div>
      <ExternalLink size={13} style={{ color: "rgba(30,19,64,0.25)" }} />
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SessionView({ day, weekNum, lastWeights, streak, totalCompleted, isSunday, prepTime, onComplete, onExit }: Props) {
  const [customExList, setCustomExList] = useState<ProgramExercise[]>([]);

  // ── Sections ─────────────────────────────────────────────────────────────────
  const sections = useMemo((): WorkoutSection[] => [
    { id: "core",  label: "Core Primer",  color: "#DA667B", exercises: CORE_PRIMER },
    ...(day.isGluteDay ? [{ id: "hip", label: "Hip Flexors", color: "#C99A5C", exercises: HIP_FLEXOR_UNLOCK }] : []),
    { id: "main",  label: "Main Work",    color: "#7C5CFC", exercises: [...day.mainExercises, ...customExList] },
  ], [day, customExList]);

  const exercises = useMemo(() => sections.flatMap((s) => s.exercises), [sections]);

  const sectionStarts = useMemo(() => {
    const starts: number[] = [];
    let offset = 0;
    for (const s of sections) { starts.push(offset); offset += s.exercises.length; }
    return starts;
  }, [sections]);

  const phase = getWeekPhase(weekNum);

  // ── Session state ─────────────────────────────────────────────────────────────
  const [exIdx,          setExIdx]          = useState(0);
  const [setIdx,         setSetIdx]         = useState(0);
  const [weight,         setWeight]         = useState("");
  const [repsInput,      setRepsInput]      = useState("");
  const [loggedSets,     setLoggedSets]     = useState<Record<string, WorkoutSetLog[]>>({});
  const [rest,           setRest]           = useState<{ remaining: number; total: number } | null>(null);
  const [showMMP,        setShowMMP]        = useState(false);
  const [done,           setDone]           = useState(false);
  const [paused,         setPaused]         = useState(false);
  const [prepCountdown,  setPrepCountdown]  = useState<number | null>(null);
  const [showAddEx,      setShowAddEx]      = useState(false);
  const [addExName,      setAddExName]      = useState("");
  const [addExSets,      setAddExSets]      = useState(3);
  const [addExReps,      setAddExReps]      = useState("10");
  const [showExitConfirm,setShowExitConfirm]= useState(false);
  const [exTimeLeft,    setExTimeLeft]    = useState<number | null>(null);

  // Slide animation
  const [anim, setAnim] = useState<{ key: number; dir: "forward" | "back" }>({ key: 0, dir: "forward" });

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRestDoneRef = useRef<(() => void) | null>(null);
  const pausedRef     = useRef(false);
  const exTimer2Ref   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const ex = exercises[exIdx] as ProgramExercise | undefined;

  // Stable refs for use inside closures / effects
  const exRef          = useRef(ex);
  exRef.current        = ex;
  const loggedSetsRef  = useRef(loggedSets);
  loggedSetsRef.current = loggedSets;
  const exercisesRef   = useRef(exercises);
  exercisesRef.current = exercises;

  // ── Section derived values ────────────────────────────────────────────────────
  const { sectionIdx, localExIdx } = useMemo(() => {
    let offset = 0;
    for (let si = 0; si < sections.length; si++) {
      if (exIdx < offset + sections[si].exercises.length) {
        return { sectionIdx: si, localExIdx: exIdx - offset };
      }
      offset += sections[si].exercises.length;
    }
    return { sectionIdx: sections.length - 1, localExIdx: 0 };
  }, [exIdx, sections]);

  const currentSection = sections[sectionIdx];

  const isSectionDone = (s: WorkoutSection) =>
    s.exercises.every((e) => (loggedSets[e.id]?.length ?? 0) >= e.sets);

  // ── Progress ──────────────────────────────────────────────────────────────────
  const totalSets     = exercises.reduce((s, e) => s + e.sets, 0);
  const completedSets = Object.values(loggedSets).reduce((s, arr) => s + arr.length, 0);
  const progressPct   = Math.min((completedSets / Math.max(totalSets, 1)) * 100, 100);

  // ── Navigate exercises ────────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const goToExercise = useCallback((idx: number) => {
    if (idx < 0 || idx >= exercises.length) return;
    clearTimer(); setRest(null);
    setAnim((a) => ({ key: a.key + 1, dir: idx >= exIdx ? "forward" : "back" }));
    setExIdx(idx); setSetIdx(0);
    haptic(8);
  }, [exIdx, exercises.length, clearTimer]);

  const skipSection = () => {
    const nextStart = sectionStarts[sectionIdx + 1];
    if (nextStart !== undefined) goToExercise(nextStart);
  };

  // ── Swipe handlers ────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 55) {
      if (dx > 0) goToExercise(exIdx + 1);
      else        goToExercise(exIdx - 1);
    }
  };

  // ── Prefill weight + prep countdown on exercise change ────────────────────────
  useEffect(() => {
    if (!ex) return;
    const prev      = lastWeights[ex.id] ?? 0;
    const suggested = weekNum > 0 ? suggestWeight(prev, weekNum) : prev;
    setWeight(suggested > 0 ? String(suggested) : "");
    setRepsInput(ex.reps.match(/\d+/)?.[0] ?? "");

    if (prepTime > 0) { setPrepCountdown(prepTime); return; }

    if (ex.isGlute && ex.category === "compound") {
      const t1 = setTimeout(() => { setShowMMP(true); speak("Activate your glutes first. Squeeze and hold, then load them."); }, 0);
      const t2 = setTimeout(() => setShowMMP(false), 3000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const t = setTimeout(() => speak(`Now starting ${ex.name}. ${ex.formCue}`), 300);
    return () => clearTimeout(t);
  }, [exIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-warm TTS for next exercise
  useEffect(() => {
    const next = exercises[exIdx + 1];
    if (next) prewarmTTS(`Now starting ${next.name}. ${next.formCue}`);
  }, [exIdx, exercises]);

  // Periodic motivational cues — context-aware
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const fire = () => {
      if (!pausedRef.current && exRef.current) {
        const cur = exRef.current;
        const setsLogged = loggedSetsRef.current[cur.id]?.length ?? 0;
        const isLastSet = setsLogged >= cur.sets - 1;
        const isLastEx  = exercisesRef.current[exercisesRef.current.length - 1]?.id === cur.id;
        const contextCues: string[] = [
          ...(isLastSet && !isLastEx ? ["This is your last set. Make it your best.", "Last set — leave nothing behind."] : []),
          ...(isLastEx  ? ["Last exercise of the workout. Finish strong.", "This is where champions are made — the final push."] : []),
        ];
        const pool = [
          ...(cur.motivCues ?? []),
          ...(CATEGORY_CUES[cur.category] ?? []),
          ...UNIVERSAL_CUES,
          ...contextCues,
        ];
        speak(pool[Math.floor(Math.random() * pool.length)]);
      }
      timeoutId = setTimeout(fire, 38000 + Math.random() * 17000);
    };
    timeoutId = setTimeout(fire, 25000);
    return () => clearTimeout(timeoutId);
  }, [exIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timed exercises: visual countdown + speech milestones per set
  useEffect(() => {
    if (exTimer2Ref.current) { clearInterval(exTimer2Ref.current); exTimer2Ref.current = null; }
    setExTimeLeft(null);
    if (!ex) return;
    const match = ex.reps.match(/(\d+)\s*sec/);
    if (!match) return;
    const totalSecs = parseInt(match[1]);
    if (totalSecs < 5) return;
    // For first set: wait for prep countdown. For subsequent sets: short delay.
    const prepDelay = setIdx === 0 && prepTime > 0 ? (prepTime + 0.6) * 1000 : 600;

    const speechTimers: ReturnType<typeof setTimeout>[] = [];
    if (totalSecs > 25) speechTimers.push(setTimeout(() => { if (!pausedRef.current) speak("Twenty seconds left — stay with it."); }, prepDelay + (totalSecs - 20) * 1000));
    if (totalSecs > 15) speechTimers.push(setTimeout(() => { if (!pausedRef.current) speak("Ten more seconds. Don't let go!"); }, prepDelay + (totalSecs - 10) * 1000));
    if (totalSecs > 7)  speechTimers.push(setTimeout(() => { if (!pausedRef.current) speak("Five more seconds. Almost there!"); }, prepDelay + (totalSecs - 5) * 1000));

    const startTimer = setTimeout(() => {
      setExTimeLeft(totalSecs);
      exTimer2Ref.current = setInterval(() => {
        if (pausedRef.current) return;
        setExTimeLeft((p) => {
          if (p === null || p <= 0) { clearInterval(exTimer2Ref.current!); return null; }
          return p - 1;
        });
      }, 1000);
    }, prepDelay);

    return () => {
      speechTimers.forEach(clearTimeout);
      clearTimeout(startTimer);
      if (exTimer2Ref.current) { clearInterval(exTimer2Ref.current); exTimer2Ref.current = null; }
      setExTimeLeft(null);
    };
  }, [exIdx, setIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire voice when prep hits 0
  useEffect(() => {
    if (prepCountdown !== 0) return;
    setPrepCountdown(null);
    if (!ex) return;
    if (ex.isGlute && ex.category === "compound") {
      setShowMMP(true);
      speak("Activate your glutes first. Squeeze and hold, then load them.");
      setTimeout(() => setShowMMP(false), 3000);
    } else {
      speak(`Now starting ${ex.name}. ${ex.formCue}`);
    }
  }, [prepCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prep countdown tick
  useEffect(() => {
    if (prepCountdown === null || prepCountdown <= 0) return;
    if (pausedRef.current) return;
    const t = setTimeout(() => setPrepCountdown((p) => (p !== null ? p - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [prepCountdown, paused]);

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    haptic(next ? [10, 30] : 10);
  };

  const skipRest = () => {
    clearTimer(); setRest(null);
    const fn = onRestDoneRef.current; onRestDoneRef.current = null; fn?.();
  };

  const startRest = useCallback((seconds: number, nextExName: string | undefined, onDone: () => void) => {
    if (seconds <= 0) { onDone(); return; }
    onRestDoneRef.current = onDone;
    setRest({ remaining: seconds, total: seconds });
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setRest((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          clearTimer();
          playBeep(880, 0.3);
          setTimeout(() => playBeep(1100, 0.3), 360);
          haptic([30, 60, 30]);
          const msg = nextExName ? `Time's up. Next: ${nextExName}.` : "Time's up. Go!";
          setTimeout(() => speak(msg), 120);
          setTimeout(() => { onRestDoneRef.current?.(); onRestDoneRef.current = null; }, 200);
          return null;
        }
        if (prev.remaining === 4) playBeep(440, 0.15);
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }, [clearTimer]);

  const completeSet = () => {
    if (!ex) return;
    haptic([10, 20, 40]);
    const w = parseFloat(weight) || 0;
    const r = parseInt(repsInput) || 1;
    setLoggedSets((prev) => ({ ...prev, [ex.id]: [...(prev[ex.id] ?? []), { weight: w, reps: r }] }));

    const nextSetIdx  = setIdx + 1;
    const nextExIdx   = exIdx + 1;
    const lastSetOfEx = nextSetIdx >= ex.sets;
    const lastEx      = lastSetOfEx && nextExIdx >= exercises.length;

    if (lastEx) { setDone(true); haptic([50, 100, 50, 100, 100]); return; }

    const nextEx = lastSetOfEx ? exercises[nextExIdx] : null;
    const onDone = () => {
      if (lastSetOfEx) { setExIdx(nextExIdx); setSetIdx(0); }
      else             { setSetIdx(nextSetIdx); }
    };
    startRest(ex.restSeconds, nextEx?.name, onDone);
  };

  const addCustomExercise = () => {
    if (!addExName.trim()) return;
    setCustomExList((prev) => [...prev, {
      id: `custom-${Date.now()}`,
      name: addExName.trim(),
      sets: addExSets,
      reps: addExReps,
      restSeconds: 60,
      formCue: "Focus on form and controlled movement.",
      category: "isolation",
      isBodyweight: false,
    }]);
    setAddExName(""); setAddExSets(3); setAddExReps("10");
    setShowAddEx(false);
  };

  const finishSession = (partial = false) => {
    // Only save exercises that have at least one set logged
    const logs = exercises
      .map((e) => ({ exerciseId: e.id, exerciseName: e.name, sets: loggedSets[e.id] ?? [] }))
      .filter((l) => partial ? l.sets.length > 0 : true);
    if (partial && logs.length === 0) { onExit(); return; }
    onComplete(logs);
  };

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!ex) return null;

  const prevWeight = lastWeights[ex.id] ?? 0;
  const suggested  = weekNum > 0 ? suggestWeight(prevWeight, weekNum) : prevWeight;
  const catColor   = CAT_COLOR[ex.category] ?? "var(--text)";
  const setsLogged = loggedSets[ex.id]?.length ?? 0;
  const totalVolume = Object.values(loggedSets).reduce((t, sets) =>
    t + sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
  const isTimed = ex.reps.includes("sec") || ex.reps.includes("min");
  const ctaBg = currentSection.color;

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (done) {
    const sessionNum = totalCompleted + 1;
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6 p-8 text-center"
        style={{ animation: "popIn 0.35s ease-out" }}>
        {/* Session number badge */}
        <div className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(200,255,0,0.1)", border: "1px solid rgba(124,92,252,0.25)", color: "#7C5CFC" }}>
          Session #{sessionNum}
        </div>
        <div style={{ fontSize: "3.5rem", animation: "pulseGreen 1s ease-out", color: "#7C5CFC" }}>✓</div>
        <div className="space-y-1">
          <h2 className="font-serif text-3xl text-ink">{day.label} complete</h2>
          <p className="text-sm" style={{ color: "rgba(30,19,64,0.45)" }}>You showed up. That&apos;s the whole game.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          <div className="rounded-2xl p-4 text-center" style={{ background: "var(--surface2)" }}>
            <p className="font-serif text-2xl text-ink">{sessionNum}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>sessions</p>
          </div>
          {totalVolume > 0 && (
            <div className="rounded-2xl p-4 text-center" style={{ background: "var(--surface2)" }}>
              <p className="font-serif text-lg text-ink">{totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>lbs lifted</p>
            </div>
          )}
          {streak > 0 && (
            <div className="rounded-2xl p-4 text-center" style={{ background: "var(--surface2)" }}>
              <p className="font-serif text-2xl text-ink">{streak + 1}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>day streak</p>
            </div>
          )}
        </div>
        {isSunday && (
          <div className="w-full max-w-xs px-4 py-3 rounded-2xl text-sm text-center"
            style={{ background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.2)", color: "#7C5CFC" }}>
            Time to measure — track your hourglass progress
          </div>
        )}
        <button onClick={() => finishSession()}
          className="px-10 py-4 rounded-2xl font-semibold text-black text-lg active:scale-95 transition-transform"
          style={{ background: "#7C5CFC", animation: "pulseGreen 2s ease-out 0.5s" }}>
          Save Workout
        </button>
      </div>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden relative select-none" style={{ background: "var(--bg)" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Overall progress bar */}
      <div style={{ height: 3, background: "rgba(124,92,252,0.06)", flexShrink: 0 }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "#7C5CFC", transition: "width 0.6s ease" }} />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2.5">
        {/* Row 1: day label + actions */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: "#7C5CFC" }}>{day.label}</p>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowAddEx(true)}
              className="p-2 rounded-xl active:scale-90 transition-transform" style={{ color: "rgba(30,19,64,0.35)" }}>
              <Plus size={16} />
            </button>
            <button onClick={togglePause}
              className="p-2 rounded-xl active:scale-90 transition-transform"
              style={{ color: paused ? "#7C5CFC" : "rgba(30,19,64,0.35)" }}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button onClick={() => setShowExitConfirm(true)}
              className="p-2 rounded-xl active:scale-90 transition-transform" style={{ color: "rgba(30,19,64,0.35)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: section tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {sections.map((section, si) => {
            const done = isSectionDone(section);
            const isCurrent = si === sectionIdx;
            return (
              <button key={section.id}
                onClick={() => goToExercise(sectionStarts[si])}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: isCurrent ? section.color : done ? `${section.color}22` : "rgba(124,92,252,0.07)",
                  color: isCurrent ? "#000" : done ? section.color : "var(--text-muted)",
                }}>
                {done && !isCurrent && <span>✓</span>}
                {section.label}
                {!done && isCurrent && (
                  <span style={{ opacity: 0.7 }}>{localExIdx + 1}/{section.exercises.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 3: exercise dots + prev/next */}
        <div className="flex items-center gap-2">
          <button onClick={() => goToExercise(exIdx - 1)} disabled={exIdx === 0}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            style={{ background: "rgba(30,19,64,0.05)", color: exIdx === 0 ? "rgba(124,92,252,0.12)" : "rgba(30,19,64,0.55)" }}>
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 flex gap-1 overflow-hidden">
            {currentSection.exercises.map((_, i) => (
              <button key={i} onClick={() => goToExercise(sectionStarts[sectionIdx] + i)}
                className="flex-1 rounded-full transition-all"
                style={{
                  height: 4, minWidth: 4,
                  background: i === localExIdx
                    ? currentSection.color
                    : i < localExIdx
                    ? `${currentSection.color}55`
                    : "rgba(30,19,64,0.1)",
                }} />
            ))}
          </div>
          <button onClick={() => goToExercise(exIdx + 1)} disabled={exIdx === exercises.length - 1}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            style={{ background: "rgba(30,19,64,0.05)", color: exIdx === exercises.length - 1 ? "rgba(124,92,252,0.12)" : "rgba(30,19,64,0.55)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable exercise content — animates on change */}
      <div key={anim.key} className="flex-1 overflow-y-auto px-4 pb-4 space-y-4"
        style={{ animation: `${anim.dir === "forward" ? "slideInRight" : "slideInLeft"} 0.22s ease-out` }}>

        {weekNum > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs"
            style={{ background: phase.isDeload ? "rgba(218,102,123,0.1)" : "rgba(124,92,252,0.06)", color: phase.isDeload ? "#DA667B" : "rgba(30,19,64,0.45)" }}>
            {phase.isDeload ? "DELOAD WEEK — -40% weight" : `Week ${weekNum} · ${phase.label}`}
          </div>
        )}

        {/* Exercise name + meta */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${catColor}18`, color: catColor }}>
              {ex.category}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: `${currentSection.color}18`, color: currentSection.color }}>
              {currentSection.label}
            </span>
          </div>
          <h2 className="font-serif text-3xl text-ink mt-3 leading-tight">{ex.name}</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(30,19,64,0.45)" }}>
            Set {setIdx + 1} of {ex.sets} · {ex.reps}
          </p>
        </div>

        {/* Timed exercise countdown */}
        {exTimeLeft !== null && (() => {
          const m = ex.reps.match(/(\d+)\s*sec/);
          const total = m ? parseInt(m[1]) : 30;
          const pct = Math.max(0, Math.min(100, (exTimeLeft / total) * 100));
          const color = exTimeLeft <= 5 ? "#DA667B" : exTimeLeft <= 10 ? "#C99A5C" : "#7C5CFC";
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Hold</span>
                <span className="text-xl font-bold tabular-nums" key={exTimeLeft}
                  style={{ color, animation: exTimeLeft <= 5 ? "popIn 0.2s ease-out" : "none" }}>
                  {exTimeLeft}s
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.07)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 1s linear, background 0.5s ease" }} />
              </div>
            </div>
          );
        })()}

        {/* Video */}
        <VideoBlock ex={ex} animKey={anim.key} />

        {/* Previous weight hint */}
        {prevWeight > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: "rgba(200,255,0,0.07)", border: "1px solid rgba(200,255,0,0.15)" }}>
            <span className="text-xs flex-1" style={{ color: "rgba(30,19,64,0.45)" }}>
              Last time: <span className="font-semibold text-ink">{prevWeight} lbs</span>
              {suggested !== prevWeight
                ? <span style={{ color: "#7C5CFC" }}> → try {suggested}?</span>
                : " → match or beat it"}
            </span>
            <button onClick={() => setWeight(String(suggested))}
              className="text-xs font-medium px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
              style={{ background: "rgba(200,255,0,0.15)", color: "#7C5CFC" }}>
              Use
            </button>
          </div>
        )}

        {/* Weight stepper */}
        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            Weight (lbs){ex.isBodyweight ? " — optional, e.g. vest" : ""}
          </label>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeight((v) => String(Math.max(0, (parseFloat(v) || 0) - 5)))}
              className="w-12 h-12 rounded-xl text-xl font-semibold flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>−</button>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
              placeholder={ex.isBodyweight ? "0" : "lbs"}
              className="flex-1 text-center text-2xl font-semibold"
              style={{ background: "var(--surface2)", border: "1px solid rgba(124,92,252,0.12)", borderRadius: "0.75rem", padding: "0.65rem", color: "var(--text)", outline: "none" }} />
            <button onClick={() => setWeight((v) => String((parseFloat(v) || 0) + 5))}
              className="w-12 h-12 rounded-xl text-xl font-semibold flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>+</button>
          </div>
        </div>

        {/* Reps / Duration stepper */}
        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isTimed ? "Duration (seconds)" : "Reps completed"}
          </label>
          <div className="flex items-center gap-3">
            <button onClick={() => setRepsInput((v) => String(Math.max(0, (parseInt(v) || 0) - (isTimed ? 5 : 1))))}
              className="w-12 h-12 rounded-xl text-xl font-semibold flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>−</button>
            <input type="number" value={repsInput} onChange={(e) => setRepsInput(e.target.value)}
              placeholder={isTimed ? "sec" : "reps"}
              className="flex-1 text-center text-2xl font-semibold"
              style={{ background: "var(--surface2)", border: "1px solid rgba(124,92,252,0.12)", borderRadius: "0.75rem", padding: "0.65rem", color: "var(--text)", outline: "none" }} />
            <button onClick={() => setRepsInput((v) => String((parseInt(v) || 0) + (isTimed ? 5 : 1)))}
              className="w-12 h-12 rounded-xl text-xl font-semibold flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>+</button>
          </div>
        </div>

        {/* Form cue */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(30,19,64,0.04)", border: "1px solid rgba(124,92,252,0.06)" }}>
          <p className="text-sm flex-1 leading-relaxed" style={{ color: "rgba(30,19,64,0.55)" }}>{ex.formCue}</p>
          <button onClick={() => speak(`${ex.name}. ${ex.formCue}`)}
            className="flex-shrink-0 mt-0.5 active:scale-90 transition-transform" style={{ color: "rgba(30,19,64,0.3)" }}>
            <Volume2 size={14} />
          </button>
        </div>

        {/* Set chips */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: ex.sets }, (_, i) => (
            <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: i < setsLogged ? catColor : "rgba(124,92,252,0.07)",
                color: i < setsLogged ? "#000" : "rgba(30,19,64,0.35)",
                animation: i === setsLogged - 1 ? "popIn 0.3s ease-out" : "none",
              }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-5 flex-shrink-0 space-y-2">
        {sectionIdx < sections.length - 1 && (
          <button onClick={skipSection}
            className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            style={{ background: "rgba(30,19,64,0.05)", color: "rgba(30,19,64,0.35)" }}>
            <ChevronsRight size={14} />
            Skip to {sections[sectionIdx + 1].label}
          </button>
        )}
        <button onClick={completeSet}
          className="w-full py-4 rounded-2xl font-semibold text-black text-lg active:scale-95 transition-transform"
          style={{ background: ctaBg }}>
          {setsLogged >= ex.sets - 1 && exIdx === exercises.length - 1 ? "Complete Workout" : "Complete Set"}
        </button>
        {setsLogged >= ex.sets && exIdx < exercises.length - 1 && (
          <button onClick={() => goToExercise(exIdx + 1)}
            className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: `${currentSection.color}18`, color: currentSection.color, border: `1px solid ${currentSection.color}33` }}>
            Next Exercise <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* ── Overlays ── */}

      {/* Rest timer */}
      {rest && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center p-8"
          style={{ background: "var(--bg)", zIndex: 30, animation: "fadeIn 0.2s ease-out" }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: paused ? "#7C5CFC" : "var(--text-muted)" }}>
            {paused ? "Paused" : "Rest"}
          </p>
          <div className="relative flex items-center justify-center">
            <RestRing remaining={rest.remaining} total={rest.total} />
            <div className="absolute flex flex-col items-center">
              <span className="font-serif text-5xl text-ink">{rest.remaining}</span>
              <span className="text-xs" style={{ color: "rgba(30,19,64,0.35)" }}>sec</span>
            </div>
          </div>
          {exIdx + 1 < exercises.length && setIdx + 1 >= ex.sets && (
            <div className="space-y-0.5">
              <p className="text-xs" style={{ color: "rgba(30,19,64,0.3)" }}>Up next</p>
              <p className="font-serif text-xl text-ink">{exercises[exIdx + 1]?.name}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
              style={{ background: paused ? "rgba(200,255,0,0.15)" : "rgba(124,92,252,0.07)", color: paused ? "#7C5CFC" : "var(--text-muted)" }}>
              {paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
            </button>
            <button onClick={skipRest}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
              style={{ background: "rgba(124,92,252,0.07)", color: "var(--text-muted)" }}>
              <SkipForward size={14} /> Skip
            </button>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {paused && !rest && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center"
          style={{ background: "rgba(10,10,10,0.97)", zIndex: 50, animation: "fadeIn 0.15s ease-out" }}>
          <p className="font-serif text-4xl text-ink">Paused</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Take your time. Hydrate. Breathe.</p>
          <button onClick={togglePause}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-black text-base active:scale-95 transition-transform"
            style={{ background: "#7C5CFC" }}>
            <Play size={16} fill="black" /> Resume
          </button>
        </div>
      )}

      {/* Prep countdown */}
      {prepCountdown !== null && prepCountdown > 0 && !paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center"
          style={{ background: "var(--bg)", zIndex: 45 }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Get into position</p>
          <p className="font-serif" key={prepCountdown}
            style={{ fontSize: "6rem", lineHeight: 1, color: currentSection.color, animation: "popIn 0.25s ease-out" }}>
            {prepCountdown}
          </p>
          <p className="font-serif text-2xl text-ink">{ex.name}</p>
          {ex.formCue && (
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: "rgba(30,19,64,0.45)" }}>{ex.formCue}</p>
          )}
          <button onClick={() => setPrepCountdown(0)}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
            style={{ background: "rgba(124,92,252,0.07)", color: "var(--text-muted)" }}>
            Skip
          </button>
        </div>
      )}

      {/* Mind-muscle prompt */}
      {showMMP && (
        <div className="absolute inset-0 flex items-center justify-center p-8"
          style={{ background: "rgba(10,10,10,0.95)", zIndex: 40, animation: "fadeIn 0.2s ease-out" }}>
          <div className="text-center space-y-3">
            <p className="font-serif text-2xl text-ink leading-snug">
              Squeeze your glute now<br />— hold —<br />now load it
            </p>
            <p className="text-xs" style={{ color: "rgba(30,19,64,0.35)" }}>Starting in 3 seconds…</p>
          </div>
        </div>
      )}

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="absolute inset-0 flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.85)", zIndex: 70, animation: "fadeIn 0.15s ease-out" }}>
          <div className="rounded-2xl p-6 w-full max-w-xs space-y-4 text-center"
            style={{ background: "var(--surface2)", animation: "popIn 0.2s ease-out" }}>
            <p className="font-serif text-xl text-ink">End this workout?</p>
            <p className="text-sm" style={{ color: "rgba(30,19,64,0.45)" }}>
              {completedSets > 0
                ? `You've completed ${completedSets} set${completedSets === 1 ? "" : "s"}. Save your progress?`
                : "No sets logged yet."}
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => setShowExitConfirm(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                style={{ background: "rgba(124,92,252,0.08)", color: "var(--text)" }}>
                Keep going
              </button>
              {completedSets > 0 && (
                <button onClick={() => finishSession(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                  style={{ background: "#7C5CFC", color: "#fff" }}>
                  Save Progress &amp; Exit
                </button>
              )}
              <button onClick={onExit}
                className="w-full py-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                style={{ background: "rgba(218,102,123,0.15)", color: "#DA667B" }}>
                Abandon Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add exercise sheet */}
      {showAddEx && (
        <div className="absolute inset-0 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)", zIndex: 60 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddEx(false); }}>
          <div className="rounded-t-3xl p-6 space-y-4" style={{ background: "#141414", animation: "slideUp 0.25s ease-out" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">Add Exercise</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,19,64,0.35)" }}>Added to Main Work</p>
              </div>
              <button onClick={() => setShowAddEx(false)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <input type="text" placeholder="Exercise name"
              value={addExName} onChange={(e) => setAddExName(e.target.value)}
              style={{ width: "100%", background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.08)", borderRadius: "0.75rem", padding: "0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sets</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddExSets((s) => Math.max(1, s - 1))}
                    className="w-10 h-10 rounded-xl text-lg font-semibold flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: "rgba(124,92,252,0.06)", color: "var(--text)" }}>−</button>
                  <span className="flex-1 text-center font-semibold text-ink">{addExSets}</span>
                  <button onClick={() => setAddExSets((s) => s + 1)}
                    className="w-10 h-10 rounded-xl text-lg font-semibold flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: "rgba(124,92,252,0.06)", color: "var(--text)" }}>+</button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Reps</p>
                <input type="text" placeholder="e.g. 10–12" value={addExReps}
                  onChange={(e) => setAddExReps(e.target.value)}
                  style={{ width: "100%", background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.08)", borderRadius: "0.75rem", padding: "0.6rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none" }} />
              </div>
            </div>
            <button onClick={addCustomExercise}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ background: addExName.trim() ? "#7C5CFC" : "rgba(124,92,252,0.25)", color: addExName.trim() ? "#000" : "rgba(30,19,64,0.3)" }}>
              Add to Main Work
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
