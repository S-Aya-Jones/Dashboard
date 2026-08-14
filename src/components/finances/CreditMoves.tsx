"use client";

import { useEffect, useState } from "react";
import { CreditCard, ShieldAlert, Phone, RefreshCw, CheckCircle2, Circle, ChevronDown, Target } from "lucide-react";
import type { ActionPlan, Move, MoveAction } from "@/lib/creditActionPlan";
import { CREDIT_UPDATED } from "@/lib/creditEvents";

// The plan, named down to the account: pay this, here's what's hurting, do
// this, check this, and where your score should land.
//
// The factor breakdown underneath (CreditPlan) still explains the 35/30/15/10
// weights. This is the part she actually executes, so it leads.

interface Props {
  done: string[];
  onDone: (ids: string[]) => void;
}

const ICON: Record<MoveAction, typeof CreditCard> = {
  pay: CreditCard, dispute: ShieldAlert, call: Phone,
  autopay: RefreshCw, check: RefreshCw, ask: Target,
};

const IMPACT: Record<Move["impact"], { label: string; color: string }> = {
  large:  { label: "Big win", color: "#C0503C" },
  medium: { label: "Worth doing", color: "#C97A52" },
  small:  { label: "Small", color: "#8A7A66" },
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function CreditMoves({ done, onDone }: Props) {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/credit/plan", { cache: "no-store" })
        .then(r => r.json())
        .then(d => {
          setPlan(d.actionPlan ?? null);
          // The first move opens itself — the whole point is that she doesn't
          // have to decide where to start.
          setOpen(o => o ?? d.actionPlan?.moves?.[0]?.id ?? null);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener(CREDIT_UPDATED, load);
    return () => window.removeEventListener(CREDIT_UPDATED, load);
  }, []);

  if (!plan?.moves.length) return null;

  const toggle = (id: string) =>
    onDone(done.includes(id) ? done.filter(d => d !== id) : [...done, id]);

  const p = plan.projection;
  const remaining = plan.moves.filter(m => !done.includes(m.id));
  const payTotal = remaining
    .filter(m => m.action === "pay")
    .reduce((s, m) => s + (m.amount ?? 0), 0);

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Target size={17} style={{ color: "#C0503C" }} />
        <h3 className="section-title flex-1">Your moves</h3>
        <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {plan.moves.length - remaining.length}/{plan.moves.length} done
        </span>
      </div>

      {/* Where this lands */}
      {p.current !== null && p.low !== null && p.high !== null && (
        <div className="rounded-xl px-4 py-3 mt-3" style={{ background: "var(--bg)" }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>You&apos;re at</span>
            <span className="stat text-2xl" style={{ color: "var(--text)" }}>{p.current}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>· do all of this and you should land around</span>
            <span className="stat text-2xl" style={{ color: p.high >= p.target ? "#3F6F5E" : "#C97A52" }}>
              {p.low}–{p.high}
            </span>
          </div>

          {/* The two lines that matter for approval */}
          <div className="mt-3 relative h-2 rounded-full" style={{ background: "var(--surface2)" }}>
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, ((p.current - 300) / 550) * 100)}%`, background: "var(--text-light)" }} />
            <div className="absolute inset-y-0 rounded-full"
              style={{
                left: `${Math.min(100, ((p.current - 300) / 550) * 100)}%`,
                width: `${Math.max(0, Math.min(100, ((p.high - p.current) / 550) * 100))}%`,
                background: "#C97A52", opacity: 0.55,
              }} />
            {[p.floor, p.target].map(v => (
              <div key={v} className="absolute -top-1"
                style={{ left: `${((v - 300) / 550) * 100}%`, width: 2, height: 16, background: "var(--text)", opacity: 0.35 }} />
            ))}
          </div>
          {/* The two thresholds read as a caption. Labelling them on the bar
              itself put "670 · with a cosigner" straight through
              "700 · on your own" — thirty points is not thirty pixels. */}
          <p className="text-[10px] mt-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>{p.floor}</strong> is where a private lender
            will look at you with a cosigner · <strong style={{ color: "var(--text)" }}>{p.target}</strong> on
            your own, at a rate worth having.
          </p>
          <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-light)" }}>
            {p.note}
          </p>
        </div>
      )}

      {/* What it costs, in money */}
      {payTotal > 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Everything left to pay: <strong style={{ color: "var(--text)" }}>{money(payTotal)}</strong>
          {plan.utilisation.current !== null && ` · takes your cards from ${plan.utilisation.current}% to under 9%`}
        </p>
      )}

      {plan.summaryOnly && (
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--text-light)" }}>
          Your report didn&apos;t give per-account detail, so these are at the level of your
          totals. Upload a full report and each card gets named with its own number.
        </p>
      )}

      {/* The moves */}
      <div className="space-y-2 mt-4">
        {plan.moves.map((m, i) => {
          const isDone = done.includes(m.id);
          const isOpen = open === m.id;
          const Icon = ICON[m.action];
          const imp = IMPACT[m.impact];
          return (
            <div key={m.id} className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg)", borderLeft: `3px solid ${isDone ? "#3F6F5E" : imp.color}`, opacity: isDone ? 0.55 : 1 }}>
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <button onClick={() => toggle(m.id)} className="flex-shrink-0 mt-0.5" aria-label="Mark done">
                  {isDone
                    ? <CheckCircle2 size={16} style={{ color: "#3F6F5E" }} />
                    : <Circle size={16} style={{ color: "var(--text-light)" }} />}
                </button>

                <button onClick={() => setOpen(isOpen ? null : m.id)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon size={11} style={{ color: imp.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: imp.color }}>
                      {i === 0 && !isDone ? "Start here" : imp.label}
                    </span>
                    {m.estPoints[1] > 0 && (
                      <span className="text-[10px] font-semibold" style={{ color: "var(--text-light)" }}>
                        ~{m.estPoints[0]}–{m.estPoints[1]} pts
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--text-light)" }}>· {m.when}</span>
                  </div>
                  <p className="text-sm font-semibold mt-0.5 leading-snug"
                    style={{ color: "var(--text)", textDecoration: isDone ? "line-through" : undefined }}>
                    {i + 1}. {m.title}
                  </p>
                </button>

                <ChevronDown size={14} className="flex-shrink-0 mt-1"
                  style={{ color: "var(--text-light)", transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .18s" }} />
              </div>

              {isOpen && (
                <div className="px-3 pb-3 pl-11 space-y-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-light)" }}>
                      What&apos;s hurting
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{m.hurting}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-light)" }}>
                      Do this
                    </p>
                    <ol className="space-y-1.5">
                      {m.steps.map((s, j) => (
                        <li key={j} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--text)" }}>
                          <span className="font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>{j + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-light)" }}>
                      Check it worked
                    </p>
                    <p className="text-xs leading-relaxed rounded-lg px-2.5 py-2"
                      style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                      {m.check}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
