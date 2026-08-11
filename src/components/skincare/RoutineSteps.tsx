"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sun, Moon, RotateCcw, Pencil, Sparkles, AlertTriangle, Camera } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { StepRing } from "./StepRing";
import { routineSteps, waitLabel, routineMinutes, ruleWarnings, CORE_RULES } from "@/lib/skincareSteps";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// Something she can follow while her hands are wet.
//
// One step at a time rather than the whole list: at 8pm after a fourteen-hour
// day, a wall of seven products is a thing to skip. Ticking a step starts the
// wait timer for the next one, so the ten minutes a retinoid needs before
// moisturiser happens by itself instead of being remembered.

export function RoutineSteps({ data, update }: Props) {
  const [which, setWhich] = useState<"am" | "pm" | "weekly">(new Date().getHours() < 15 ? "am" : "pm");
  const [showRules, setShowRules] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [waitLeft, setWaitLeft] = useState(0);
  const [waitTotal, setWaitTotal] = useState(0);
  const photoFor = useRef<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = routineSteps(data.skincareProducts ?? [], which);
  const total = routineMinutes(steps);
  const warnings = ruleWarnings(steps, which);
  const doneCount = steps.filter(s => done[s.product.id]).length;

  useEffect(() => {
    if (waitLeft <= 0) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => setWaitLeft(v => (v <= 1 ? 0 : v - 1)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [waitLeft]);

  // Switching routine or starting over shouldn't inherit the other one's ticks.
  function reset(next?: "am" | "pm" | "weekly") {
    setDone({});
    setWaitLeft(0);
    setWaitTotal(0);
    if (next) setWhich(next);
  }

  function tick(id: string, waitSec: number) {
    const nowDone = !done[id];
    setDone(d => ({ ...d, [id]: nowDone }));
    const w = nowDone && waitSec > 0 ? waitSec : 0;
    setWaitLeft(w);
    setWaitTotal(w);
  }

  async function attachPhoto(file: File) {
    const id = photoFor.current;
    if (!id) return;
    const dataUrl = await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = e => res(e.target?.result as string);
      fr.readAsDataURL(file);
    });

    // 240px square is all a 44px thumbnail ever needs.
    const small = await new Promise<string>(res => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return res(dataUrl);
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        res(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });

    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: small }),
    });
    if (!res.ok) return;
    const { mediaId } = await res.json();
    if (!mediaId) return;

    update(d => ({
      ...d,
      skincareProducts: (d.skincareProducts ?? []).map(p => (p.id === id ? { ...p, mediaId } : p)),
    }));
    photoFor.current = null;
  }

  function saveHowTo(id: string, howTo: string) {
    update(d => ({
      ...d,
      skincareProducts: (d.skincareProducts ?? []).map(p => (p.id === id ? { ...p, howTo } : p)),
    }));
    setEditing(null);
  }

  return (
    <Card>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachPhoto(f); }}
      />
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-serif text-xl" style={{ color: "var(--text)" }}>Your routine, in order</h2>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { k: "am" as const,     icon: Sun,      label: "Morning" },
            { k: "pm" as const,     icon: Moon,     label: "Night" },
            { k: "weekly" as const, icon: Sparkles, label: "Peel night" },
          ]).map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              onClick={() => reset(k)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
              style={which === k
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-light)" }}>
        {steps.length} steps · about {total} minutes{doneCount ? ` · ${doneCount} done` : ""}
        {which === "pm" && " · six nights a week"}
        {which === "weekly" && " · one night a week, never an active-treatment night"}
      </p>

      {/* Her own rules, broken. Shown rather than silently corrected. */}
      {warnings.length > 0 && (
        <div className="rounded-xl px-3 py-2.5 mb-3 space-y-1"
          style={{ background: "rgba(193,74,58,0.08)", border: "1px solid rgba(193,74,58,0.3)" }}>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs flex items-start gap-2" style={{ color: "var(--text)" }}>
              <AlertTriangle size={12} style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }} />
              {w}
            </p>
          ))}
        </div>
      )}

      <button onClick={() => setShowRules(v => !v)} className="text-xs underline mb-3"
        style={{ color: "var(--text-muted)" }}>
        {showRules ? "Hide the rules" : "The rules"}
      </button>
      {showRules && (
        <ul className="space-y-1 mb-3 pl-1">
          {CORE_RULES.map((r, i) => (
            <li key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>· {r}</li>
          ))}
        </ul>
      )}

      {waitLeft > 0 && (
        <div className="rounded-2xl p-4 mb-3"
          style={{ background: "rgba(180,85,47,0.06)", border: "1px solid rgba(180,85,47,0.25)" }}>
          <StepRing left={waitLeft} total={waitTotal} onSkip={() => setWaitLeft(0)} />
        </div>
      )}

      {steps.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No products in this routine yet — add them below and the steps write themselves.
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map(s => {
            const isDone = !!done[s.product.id];
            return (
              <div key={s.product.id} className="rounded-xl p-3"
                style={{
                  background: isDone ? "rgba(63,111,94,0.06)" : "var(--surface2)",
                  border: `1px solid ${isDone ? "rgba(63,111,94,0.3)" : "var(--border)"}`,
                }}>
                <div className="flex items-start gap-3">
                  {/* The bottle, so she recognises it rather than reading it. */}
                  <button
                    onClick={() => { photoFor.current = s.product.id; photoInput.current?.click(); }}
                    aria-label={`Photo for ${s.product.name}`}
                    className="rounded-xl overflow-hidden flex-shrink-0 grid place-items-center"
                    style={{
                      width: 44, height: 44,
                      background: s.product.mediaId ? "transparent" : "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-light)",
                    }}
                  >
                    {s.product.mediaId
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={`/api/media/${s.product.mediaId}`} alt="" className="w-full h-full object-cover" />
                      : <Camera size={14} />}
                  </button>
                  <button
                    onClick={() => tick(s.product.id, s.waitAfterSec)}
                    aria-label={isDone ? "Undo" : "Done"}
                    className="w-7 h-7 rounded-full grid place-items-center flex-shrink-0 text-xs font-bold"
                    style={isDone
                      ? { background: "#3F6F5E", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--text-muted)", border: "1.5px solid var(--border2)" }}
                  >
                    {isDone ? <Check size={13} /> : s.n}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text)", textDecoration: isDone ? "line-through" : "none" }}>
                      {s.product.name}
                      {s.product.isTesting && (
                        <span className="text-xs font-normal ml-2" style={{ color: "var(--purple)" }}>on trial</span>
                      )}
                    </p>

                    {editing === s.product.id ? (
                      <textarea
                        autoFocus
                        defaultValue={s.howTo}
                        rows={3}
                        onBlur={e => saveHowTo(s.product.id, e.target.value)}
                        className="w-full mt-1.5 text-xs rounded-lg p-2"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                      />
                    ) : (
                      s.howTo && (
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          {s.howTo}
                        </p>
                      )
                    )}

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {s.frequency && (
                        <span className="text-[11px]" style={{ color: "var(--text-light)" }}>{s.frequency}</span>
                      )}
                      {s.waitAfterSec > 0 && (
                        <span className="text-[11px]" style={{ color: "var(--purple)" }}>{waitLabel(s.waitAfterSec)}</span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => setEditing(editing === s.product.id ? null : s.product.id)}
                    aria-label="Edit this step"
                    className="p-1 rounded flex-shrink-0" style={{ color: "var(--text-light)" }}>
                    <Pencil size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {doneCount > 0 && (
            <button onClick={() => reset()} className="text-xs inline-flex items-center gap-1.5 underline"
              style={{ color: "var(--text-muted)" }}>
              <RotateCcw size={11} /> Start over
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] mt-4 leading-relaxed" style={{ color: "var(--text-light)" }}>
        The instructions are standard sequencing — water before oil, actives on dry skin, sunscreen
        last. Anything your dermatologist tells you wins; tap the pencil to change any step.
      </p>
    </Card>
  );
}
