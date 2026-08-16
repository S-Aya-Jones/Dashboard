"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Play, Pause, RotateCcw, Volume2, VolumeX, Info } from "lucide-react";
import { dentalSteps, dentalSeconds, encouragement, type DentalStep } from "@/lib/dentalRoutine";

// Brush mode.
//
// The reason two minutes doesn't happen is that nobody can feel two minutes.
// So it runs as four thirty-second quadrants that advance themselves, and it
// talks, because at 10pm with a toothbrush in your mouth you are not reading
// anything.

interface Props {
  /** Days in a row with a completed session, for the encouragement line. */
  streak?: number;
  onComplete?: (when: "am" | "pm") => void;
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DentalRoutine({ streak = 0, onComplete }: Props) {
  const [when, setWhen] = useState<"am" | "pm">(new Date().getHours() < 15 ? "am" : "pm");
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState(true);
  const [why, setWhy] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = dentalSteps(when);
  const step: DentalStep | undefined = steps[i];

  const say = useCallback((text: string) => {
    if (!voice || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch { /* voice is a nicety, never a dependency */ }
  }, [voice]);

  const goTo = useCallback((idx: number) => {
    const next = steps[idx];
    setI(idx);
    setLeft(next?.seconds ?? 0);
    if (next) say(next.say);
  }, [steps, say]);

  const advance = useCallback(() => {
    if (i + 1 >= steps.length) {
      setRunning(false);
      setFinished(true);
      say("Done. Nothing but water from here.");
      onComplete?.(when);
      return;
    }
    goTo(i + 1);
  }, [i, steps.length, goTo, say, onComplete, when]);

  // The countdown for a timed step; untimed steps wait for a tap.
  useEffect(() => {
    if (!running || !step || step.seconds === 0) return;
    tick.current = setInterval(() => {
      setLeft(v => {
        if (v <= 1) { advance(); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running, step, advance]);

  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const start = () => {
    setFinished(false);
    setRunning(true);
    goTo(0);
  };

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setI(0);
    setLeft(0);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  };

  const totalSec = dentalSeconds(when);
  const doneSec = steps.slice(0, i).reduce((s, x) => s + x.seconds, 0) + ((step?.seconds ?? 0) - left);
  const pct = totalSec > 0 ? Math.min(100, (doneSec / totalSec) * 100) : 0;

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="section-title flex-1">Teeth</h3>
        <button onClick={() => setVoice(v => !v)} aria-label={voice ? "Mute" : "Unmute"}
          className="p-1.5 rounded-lg" style={{ color: voice ? "var(--text)" : "var(--text-light)" }}>
          {voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <div className="flex gap-1">
          {(["am", "pm"] as const).map(w => (
            <button key={w} onClick={() => { setWhen(w); reset(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={when === w
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              {w === "am" ? "Morning" : "Night"}
            </button>
          ))}
        </div>
      </div>

      {!running && !finished && (
        <>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {mmss(totalSec)} — four thirty-second quadrants that move themselves on
            {when === "pm" ? ", with flossing first" : ""}. It talks, so you don&apos;t have to read
            anything with a toothbrush in your mouth.
          </p>
          <button onClick={start}
            className="mt-4 w-full py-3.5 rounded-xl text-base font-bold inline-flex items-center justify-center gap-2"
            style={{ background: "#3F6F5E", color: "#fff" }}>
            <Play size={16} /> Start brushing
          </button>
          <ul className="mt-4 space-y-1">
            {steps.map(s => (
              <li key={s.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="tabular-nums w-8 text-right" style={{ color: "var(--text-light)" }}>
                  {s.seconds ? `${s.seconds}s` : "—"}
                </span>
                {s.title}
              </li>
            ))}
          </ul>
        </>
      )}

      {running && step && (
        <>
          <div className="rounded-xl px-4 py-5 text-center" style={{ background: "var(--bg)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>
              Step {i + 1} of {steps.length}
            </p>
            <p className="font-serif text-2xl mt-1" style={{ color: "var(--text)" }}>{step.title}</p>
            {step.seconds > 0 && (
              <p className="text-5xl font-bold tabular-nums mt-2" style={{ color: "#3F6F5E" }}>{left}</p>
            )}
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.how}</p>
            {step.why && (
              <button onClick={() => setWhy(why === step.id ? null : step.id)}
                className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-light)" }}>
                <Info size={12} /> why this matters
              </button>
            )}
            {why === step.id && step.why && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.why}</p>
            )}
          </div>

          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#3F6F5E", borderRadius: 4, transition: "width .3s" }} />
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => setRunning(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ background: "var(--bg)", color: "var(--text)", border: "1.5px solid var(--border)" }}>
              <Pause size={14} /> Pause
            </button>
            <button onClick={advance}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              {step.seconds > 0 ? "Next" : "Done — next"}
            </button>
          </div>
        </>
      )}

      {!running && !finished && i > 0 && (
        <button onClick={() => setRunning(true)}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "#3F6F5E", color: "#fff" }}>
          Resume
        </button>
      )}

      {finished && (
        <div className="text-center py-4">
          <Check size={40} style={{ color: "#3F6F5E" }} className="mx-auto mb-2" />
          <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Teeth done</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {encouragement("dental", streak, when)}
          </p>
          <button onClick={reset}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg)", color: "var(--text)", border: "1.5px solid var(--border)" }}>
            <RotateCcw size={13} /> Again
          </button>
        </div>
      )}
    </div>
  );
}
