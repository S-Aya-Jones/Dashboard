"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Anchor, Heart, X } from "lucide-react";

/** Always-reachable panic help: box breathing, 5-4-3-2-1 grounding, and
 *  coping statements written for panic specifically (the feeling peaks and
 *  falls on its own — the job is to not flee). */
export function PanicToolkit() {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<"breathe" | "ground" | "truths">("breathe");

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        animate={{ boxShadow: ["0 4px 20px rgba(43,179,163,.25)", "0 4px 28px rgba(43,179,163,.5)", "0 4px 20px rgba(43,179,163,.25)"] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="fixed bottom-24 md:bottom-8 right-5 z-40 inline-flex items-center gap-2 px-5 py-3.5 rounded-full font-bold text-white text-sm"
        style={{ background: "linear-gradient(135deg,#2bb3a3,#3aa864)" }}>
        <Heart size={17} /> I need help now
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            style={{ background: "rgba(20,18,35,.55)", backdropFilter: "blur(6px)" }}
            onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl p-6"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl" style={{ color: "var(--text)" }}>You&apos;re safe. Let&apos;s ride it out.</h3>
                <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
              </div>

              <div className="flex gap-2 mb-5">
                {([["breathe", "Breathe", Wind], ["ground", "Ground", Anchor], ["truths", "Truths", Heart]] as const).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => setTool(k)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold"
                    style={tool === k
                      ? { background: "var(--purple)", color: "white" }
                      : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              {tool === "breathe" && <BoxBreathing />}
              {tool === "ground" && <Grounding />}
              {tool === "truths" && <Truths />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const PHASES = [
  { label: "Breathe in", secs: 4, scale: 1.35 },
  { label: "Hold", secs: 4, scale: 1.35 },
  { label: "Breathe out", secs: 6, scale: 0.85 },
  { label: "Hold", secs: 2, scale: 0.85 },
];

function BoxBreathing() {
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(PHASES[0].secs);
  const [cycles, setCycles] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(l => {
        if (l > 1) return l - 1;
        const next = (phaseRef.current + 1) % PHASES.length;
        phaseRef.current = next;
        setPhase(next);
        if (next === 0) setCycles(c => c + 1);
        return PHASES[next].secs;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const p = PHASES[phase];
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        animate={{ scale: p.scale }}
        transition={{ duration: p.secs, ease: "easeInOut" }}
        className="w-40 h-40 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,rgba(124,92,252,.25),rgba(43,179,163,.25))",
                 border: "2px solid var(--purple)" }}>
        <div className="text-center">
          <div className="font-serif text-2xl" style={{ color: "var(--text)" }}>{p.label}</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--purple)" }}>{left}</div>
        </div>
      </motion.div>
      <p className="text-sm text-center max-w-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Long exhales tell your nervous system the threat is over. Keep going until the number stops mattering.
      </p>
      {cycles > 0 && (
        <span className="text-xs font-bold" style={{ color: "#2bb3a3" }}>{cycles} cycle{cycles > 1 ? "s" : ""} done</span>
      )}
    </div>
  );
}

const GROUND_STEPS = [
  { n: 5, sense: "things you can SEE", hint: "Name them out loud. Colours, shapes, edges." },
  { n: 4, sense: "things you can FEEL", hint: "Seat, steering wheel, feet on the floor, air on your skin." },
  { n: 3, sense: "things you can HEAR", hint: "Engine, traffic, your own breath." },
  { n: 2, sense: "things you can SMELL", hint: "Or two smells you like, if there's nothing." },
  { n: 1, sense: "thing you can TASTE", hint: "Or one thing you're grateful for." },
];

function Grounding() {
  const [i, setI] = useState(0);
  const step = GROUND_STEPS[i];
  const done = i >= GROUND_STEPS.length;

  if (done) {
    return (
      <div className="text-center py-6">
        <p className="font-serif text-xl mb-2" style={{ color: "var(--text)" }}>You&apos;re here. You&apos;re in your body.</p>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>Notice the anxiety already moved. It always does.</p>
        <button onClick={() => setI(0)} className="px-5 py-2.5 rounded-xl font-semibold text-white" style={{ background: "var(--purple)" }}>
          Run it again
        </button>
      </div>
    );
  }

  return (
    <div className="py-4">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          className="text-center">
          <div className="font-serif text-6xl mb-1" style={{ color: "var(--purple)" }}>{step.n}</div>
          <div className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>{step.sense}</div>
          <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.hint}</p>
        </motion.div>
      </AnimatePresence>
      <button onClick={() => setI(n => n + 1)}
        className="mt-6 w-full py-3 rounded-xl font-semibold text-white" style={{ background: "var(--purple)" }}>
        Done — next
      </button>
    </div>
  );
}

const TRUTHS = [
  "Panic peaks in about 10 minutes and then falls. It cannot stay high — your body physically won't let it.",
  "This feeling is adrenaline. It's uncomfortable, not dangerous. Nothing is wrong with your heart.",
  "You are not going to faint. Panic raises your blood pressure — fainting needs it to drop.",
  "If you pull over and wait instead of turning back, the fear teaches your brain the wrong lesson gets erased.",
  "You have felt exactly this before and it passed every single time. Your record is 100%.",
  "The goal was never to feel calm while doing it. The goal is to do it while not calm.",
  "Slowing down is allowed. Stopping the car is allowed. Turning around is the only thing that costs you progress.",
];

function Truths() {
  return (
    <div className="space-y-2.5 py-1 max-h-[52vh] overflow-y-auto">
      {TRUTHS.map((t, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
          className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
          {t}
        </motion.div>
      ))}
    </div>
  );
}
