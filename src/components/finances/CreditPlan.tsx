"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";

// The score on its own tells you nothing you can act on. This is the report
// read back as a ranked list: what's dragging it, ordered by how much that
// factor is worth against how bad the number is, with the concrete move under
// each one.

interface Finding {
  id: string;
  factor: string;
  weight: number;
  severity: "critical" | "high" | "moderate" | "low" | "good";
  headline: string;
  detail: string;
  actions: string[];
  timeline: string;
}

interface Plan {
  score: number | null;
  band: string;
  spread: number | null;
  utilisation: number | null;
  findings: Finding[];
  firstMove: string | null;
  nextReviewDate: string;
}

const SEV_COLOR: Record<Finding["severity"], string> = {
  critical: "#C0503C",
  high:     "#C97A52",
  moderate: "#C99A5C",
  low:      "#8A7A66",
  good:     "#3F6F5E",
};

const SEV_LABEL: Record<Finding["severity"], string> = {
  critical: "Biggest drag", high: "Costing you", moderate: "Worth fixing",
  low: "Minor", good: "Working for you",
};

export function CreditPlan() {
  const [data, setData] = useState<{ plan: Plan | null; change: number | null; reportDate?: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credit/plan", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const plan = data?.plan;
  if (!plan) return null;

  return (
    <div className="space-y-4">
      {/* The number, and whether it moved */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Middle score
            </p>
            <p className="font-serif text-4xl mt-1" style={{ color: "var(--text)" }}>
              {plan.score ?? "—"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {plan.band}
              {plan.spread !== null && plan.spread > 0 && ` · ${plan.spread} points between bureaus`}
            </p>
          </div>
          {data.change !== null && data.change !== 0 && (
            <div className="flex items-center gap-1.5" style={{ color: data.change > 0 ? "#3F6F5E" : "#C0503C" }}>
              {data.change > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="text-lg font-bold tabular-nums">
                {data.change > 0 ? "+" : ""}{data.change}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>since last pull</span>
            </div>
          )}
        </div>

        {plan.utilisation !== null && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Card utilisation
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                {plan.utilisation}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(plan.utilisation, 100)}%`,
                  background: plan.utilisation >= 50 ? "#C0503C" : plan.utilisation >= 30 ? "#C99A5C" : "#3F6F5E",
                }}
              />
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-light)" }}>
              Under 10% is where this stops costing you anything
            </p>
          </div>
        )}

        {plan.firstMove && (
          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--purple)" }}>
              Do this first
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{plan.firstMove}</p>
          </div>
        )}
      </div>

      {/* Every factor, worst first */}
      <div className="space-y-2">
        {plan.findings.map((f) => {
          const isOpen = open === f.id;
          const color = SEV_COLOR[f.severity];
          return (
            <div
              key={f.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderLeft: `3px solid ${color}` }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: `${color}22`, color }}>
                      {SEV_LABEL[f.severity]}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-light)" }}>
                      {f.factor} · {f.weight}% of your score
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-1.5 leading-snug" style={{ color: "var(--text)" }}>
                    {f.headline}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{f.detail}</p>
                </div>
                <ChevronDown
                  size={15}
                  className="flex-shrink-0 mt-1"
                  style={{ color: "var(--text-light)", transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <ol className="space-y-2">
                    {f.actions.map((a, i) => (
                      <li key={i} className="text-sm leading-relaxed flex gap-2.5" style={{ color: "var(--text)" }}>
                        <span className="font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
                          {i + 1}
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs leading-relaxed rounded-lg px-3 py-2"
                    style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
                    {f.timeline}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-light)" }}>
        Read from your {data.reportDate} report. Pull a fresh one around{" "}
        {new Date(plan.nextReviewDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} to see what moved.
      </p>
    </div>
  );
}
