"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Car, Mountain, CalendarClock, AlertTriangle } from "lucide-react";

interface PlanStep {
  title: string; why: string; when: string;
  phobia: string; difficulty: number; route?: string;
}
interface Plan { readAloud: string; steps: PlanStep[]; watchFor: string }

/** Asks the model to read her actual logged sessions and propose the next
 *  steps from the data — not a generic starter ladder. */
export function NextSteps({ onLog }: { onLog: (t: { phobia: string; label: string }) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/exposure/plan", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Could not build a plan"); return; }
      setPlan(d.plan);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,rgba(180,85,47,.12),rgba(43,179,163,.10))", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Wand2 size={17} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold" style={{ color: "var(--text)" }}>What should I actually do next?</h3>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Reads every session you&apos;ve logged — your routes, your fear ratings, what&apos;s plateaued —
          and picks three steps one notch past what you&apos;ve already proven you can do.
        </p>
        <button onClick={generate} disabled={loading}
          className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
          style={{ background: "var(--purple)" }}>
          {loading ? "Reading your data…" : plan ? "Rebuild from latest data" : "Build my next steps"}
        </button>
        {err && <p className="text-sm mt-2" style={{ color: "#c0392b" }}>{err}</p>}
      </div>

      <AnimatePresence>
        {plan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {plan.readAloud && (
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{plan.readAloud}</p>
              </div>
            )}

            {plan.steps?.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(180,85,47,.12)", color: "var(--purple)" }}>
                    {s.phobia === "heights" ? <Mountain size={16} /> : <Car size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.title}</div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.why}</p>
                    {s.when && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold" style={{ color: "var(--purple)" }}>
                        <CalendarClock size={12} /> {s.when}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="h-1.5 rounded-full flex-1 max-w-[120px] overflow-hidden" style={{ background: "var(--bg)" }}>
                        <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: `${s.difficulty}%` }}
                          style={{ background: s.difficulty > 70 ? "#c0392b" : s.difficulty > 45 ? "#e8842c" : "#2bb3a3" }} />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>≈{s.difficulty} fear</span>
                      {s.route && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "var(--bg)", color: "var(--text-muted)" }}>{s.route}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onLog({ phobia: s.phobia || "driving", label: s.title })}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 text-white"
                    style={{ background: "var(--purple)" }}>
                    Did it
                  </button>
                </div>
              </motion.div>
            ))}

            {plan.watchFor && (
              <div className="rounded-xl px-4 py-3 text-sm leading-relaxed flex gap-2.5"
                style={{ background: "rgba(232,132,44,.08)", border: "1px solid rgba(232,132,44,.3)", color: "var(--text)" }}>
                <AlertTriangle size={16} style={{ color: "#e8842c", flexShrink: 0, marginTop: 2 }} />
                {plan.watchFor}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
