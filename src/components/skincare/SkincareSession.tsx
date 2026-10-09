"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, Volume2, VolumeX, Check, ChevronRight, Sparkles } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";
import { routineSteps, type RoutineStep } from "@/lib/skincareSteps";
import { encouragement } from "@/lib/dentalRoutine";
import { ProductPhoto } from "./ProductPhoto";
import { celebrate } from "@/lib/confetti";

// Routine mode: someone standing next to her.
//
// The checklist version answers "what's in my routine". This answers "walk me
// through it" — full screen, one step at a time, the bottle big enough to
// recognise at arm's length, a ring that visibly empties while a retinoid
// waits, and a voice reading the step so she never has to look at the phone
// with wet hands.
//
// Voice is ON here, unlike the checklist. She asked to be walked through it,
// and a guide that has to be switched on isn't a guide.

interface Props {
  data: DashboardData;
  which: "am" | "pm" | "weekly";
  onClose: () => void;
}

const RING = 128;
const R = 58;
const CIRC = 2 * Math.PI * R;

export function SkincareSession({ data, which, onClose }: Props) {
  const steps = routineSteps(data.skincareProducts ?? [], which);
  const [i, setI] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(0);
  const [voice, setVoice] = useState(true);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const step: RoutineStep | undefined = steps[i];

  const say = useCallback((text: string) => {
    if (!voice || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96;
      window.speechSynthesis.speak(u);
    } catch { /* voice is a nicety, never a dependency */ }
  }, [voice]);

  // Read the step when it arrives. The name first, then how — she needs to know
  // which bottle to pick up before she needs to know what to do with it.
  useEffect(() => {
    if (!step || waiting || finished) return;
    say(`Step ${step.n}. ${step.product.name}. ${step.howTo}`.slice(0, 240));
  }, [step, waiting, finished, say]);

  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const advance = useCallback(() => {
    if (!step) return;
    const isLast = i + 1 >= steps.length;

    if (step.waitAfterSec > 0 && !waiting && !isLast) {
      setWaiting(true);
      setLeft(step.waitAfterSec);
      setTotal(step.waitAfterSec);
      say(`Now wait ${step.waitAfterSec} seconds before the next one.`);
      return;
    }

    setWaiting(false);
    if (isLast) {
      setFinished(true);
      say("That's the whole routine. Done.");
      celebrate().catch(() => {});
      return;
    }
    setI(n => n + 1);
  }, [step, i, steps.length, waiting, say]);

  // The wait between steps, counted down rather than remembered.
  useEffect(() => {
    if (!waiting || paused) return;
    tick.current = setInterval(() => {
      setLeft(v => {
        if (v <= 1) {
          setWaiting(false);
          setI(n => Math.min(n + 1, steps.length - 1));
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [waiting, paused, steps.length]);

  // Lock the page behind it — this is a takeover, not a panel.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!steps.length) {
    return (
      <Overlay onClose={onClose}>
        <p className="text-lg" style={{ color: "var(--text)" }}>Nothing in this routine yet.</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Add products to the {which === "am" ? "morning" : which === "pm" ? "evening" : "weekly"} routine first.
        </p>
      </Overlay>
    );
  }

  const pct = ((i + (waiting ? 1 : 0)) / steps.length) * 100;
  const waitPct = total > 0 ? left / total : 0;

  return (
    <Overlay onClose={onClose}>
      {/* Progress across the top */}
      <div className="absolute left-0 right-0 top-0 px-5 pt-5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} aria-label="Leave routine"
            className="p-2 rounded-full" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
            <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: "#3F6F5E", borderRadius: 4 }} />
          </div>
          <button onClick={() => setVoice(v => !v)} aria-label={voice ? "Mute" : "Unmute"}
            className="p-2 rounded-full" style={{ background: "var(--surface)", color: voice ? "var(--text)" : "var(--text-light)" }}>
            {voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
        <p className="text-[11px] text-center mt-2 font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-light)" }}>
          {finished ? "Done" : `Step ${step!.n} of ${steps.length}`}
          {" · "}{which === "am" ? "Morning" : which === "pm" ? "Evening" : "Peel night"}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center px-6">
            <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.2, repeat: 2 }}>
              <Sparkles size={56} style={{ color: "#C9A227" }} className="mx-auto mb-4" />
            </motion.div>
            <h2 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Routine done</h2>
            <p className="text-base mt-3 leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "22rem" }}>
              {encouragement("skincare", 0, which)}
            </p>
            <button onClick={onClose}
              className="mt-7 px-7 py-3 rounded-2xl text-base font-bold"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              Close
            </button>
          </motion.div>
        ) : waiting ? (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center px-6">
            {/* The ring empties, so the wait is something she can see rather
                than something she has to trust. */}
            <div className="relative mx-auto" style={{ width: RING, height: RING }}>
              <svg width={RING} height={RING} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" strokeWidth={8}
                  stroke="var(--surface2)" />
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" strokeWidth={8}
                  stroke="#3F6F5E" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - waitPct)}
                  style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <motion.div
                animate={{ scale: paused ? 1 : [1, 1.06, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 grid place-items-center">
                <span className="text-4xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{left}</span>
              </motion.div>
            </div>
            <p className="text-lg mt-5 font-semibold" style={{ color: "var(--text)" }}>Let it absorb</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Next: {steps[Math.min(i + 1, steps.length - 1)]?.product.name}
            </p>
            <div className="flex gap-2 justify-center mt-6">
              <button onClick={() => setPaused(p => !p)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                style={{ background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)" }}>
                {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume" : "Pause"}
              </button>
              <button onClick={() => { setWaiting(false); setI(n => Math.min(n + 1, steps.length - 1)); }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--text)", color: "var(--surface)" }}>
                Skip the wait
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key={step!.product.id}
            initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.28 }}
            className="text-center px-6 w-full" style={{ maxWidth: "26rem" }}>

            {/* The bottle, big enough to recognise from across the sink. */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-5 rounded-3xl grid place-items-center overflow-hidden"
              style={{ width: 148, height: 148, background: "var(--surface)", border: "1.5px solid var(--border)" }}>
              {step!.product.mediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${step!.product.mediaId}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <ProductPhoto name={step!.product.name} brand={step!.product.brand} size={148} />
              )}
            </motion.div>

            <h2 className="font-serif text-2xl leading-tight" style={{ color: "var(--text)" }}>
              {step!.product.name}
            </h2>
            {step!.frequency && (
              <p className="text-[11px] mt-1 font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>
                {step!.frequency}
              </p>
            )}
            <p className="text-base mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {step!.howTo || "Apply an even layer."}
            </p>

            <button onClick={advance}
              className="mt-8 w-full py-4 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2"
              style={{ background: "#3F6F5E", color: "#fff" }}>
              <Check size={17} />
              {step!.waitAfterSec > 0 && i + 1 < steps.length
                ? `Done — wait ${step!.waitAfterSec}s`
                : i + 1 >= steps.length ? "Done — finish" : "Done — next"}
            </button>

            {i + 1 < steps.length && (
              <button onClick={() => { setWaiting(false); setI(n => n + 1); }}
                className="mt-3 text-xs inline-flex items-center gap-1" style={{ color: "var(--text-light)" }}>
                Skip this one <ChevronRight size={12} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: "var(--bg)" }}
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}
