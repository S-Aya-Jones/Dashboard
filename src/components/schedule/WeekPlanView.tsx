"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  WEEK, CAT_COLORS, CAT_LABELS, DAY_ORDER, DAY_SHORT,
  planMinutes as mins, type Cat,
} from "@/lib/weekPlan";

// The master weekly template, rendered one day at a time.
//
// The plan itself lives in lib/weekPlan.ts so the Today page renders the same
// schedule this page shows — they used to be two separate lists that had
// drifted apart.

function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function chicagoNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

export function WeekPlanView() {
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    setNow(chicagoNow());
    const t = setInterval(() => setNow(chicagoNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = now?.getDay() ?? null;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Before the clock resolves on the client, show Monday rather than nothing.
  const day = picked ?? today ?? 1;
  const isToday = day === today;
  const plan = WEEK[day];

  const currentIdx = isToday
    ? plan.blocks.findIndex((b) => nowMin >= mins(b.start) && nowMin < mins(b.end))
    : -1;
  const nextIdx = isToday
    ? plan.blocks.findIndex((b) => mins(b.start) > nowMin)
    : -1;

  const heading = isToday
    ? now!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : plan.name;

  return (
    <div className="space-y-5">
      {/* Day picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DAY_ORDER.map((d) => {
          const on = d === day;
          const isNow = d === today;
          return (
            <button
              key={d}
              onClick={() => setPicked(d)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                background: on ? "var(--text)" : "var(--surface)",
                color:      on ? "var(--surface)" : "var(--text-muted)",
                border:     `1.5px solid ${on ? "var(--text)" : "var(--border)"}`,
              }}
            >
              {DAY_SHORT[d]}
              {isNow && !on && (
                <span
                  className="inline-block ml-1.5 rounded-full align-middle"
                  style={{ width: 5, height: 5, background: "var(--purple)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* The day itself */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>{heading}</h2>
            {isToday && currentIdx >= 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Right now: <span style={{ color: "var(--text)", fontWeight: 600 }}>{plan.blocks[currentIdx].label}</span>
              </p>
            )}
            {isToday && currentIdx < 0 && nextIdx >= 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Next up at {fmt(plan.blocks[nextIdx].start)}:{" "}
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{plan.blocks[nextIdx].label}</span>
              </p>
            )}
          </div>
          {plan.sub && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-light)" }}>{plan.sub}</p>
          )}
        </div>

        <div className="px-4 py-3 md:px-6 md:py-4">
          {plan.blocks.map((b, i) => {
            const active = i === currentIdx;
            const past   = isToday && nowMin >= mins(b.end);
            return (
              <div
                key={i}
                className="flex gap-3 md:gap-4 rounded-xl px-2 md:px-3 py-2.5"
                style={{
                  background: active ? "rgba(180,85,47,0.07)" : undefined,
                  opacity: past ? 0.5 : 1,
                }}
              >
                <span
                  className="text-xs tabular-nums text-right pt-0.5 flex-shrink-0 leading-relaxed"
                  style={{ color: "var(--text-light)", width: "5.5rem" }}
                >
                  {fmt(b.start)}<br />{fmt(b.end)}
                </span>
                <span
                  className="w-1 rounded-full flex-shrink-0 self-stretch"
                  style={{ background: CAT_COLORS[b.cat] }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="leading-snug"
                    style={{ color: "var(--text)", fontWeight: active ? 700 : 500 }}
                  >
                    {b.label}
                    {active && (
                      <span className="ml-2 text-xs font-bold" style={{ color: "var(--purple)" }}>now</span>
                    )}
                  </p>
                  {b.note && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {b.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supporting detail, out of the way until asked for */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
        <button
          onClick={() => setShowRules((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold"
          style={{ background: "var(--surface)", color: "var(--text-muted)" }}
        >
          How this week works
          <ChevronDown
            size={15}
            style={{ transform: showRules ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
          />
        </button>
        {showRules && (
          <div className="px-5 pb-5 pt-1 space-y-4" style={{ background: "var(--surface)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Evenings anchor to that morning’s classes — Biochem and Physio on Monday and
              Wednesday, CMB and Micro on Tuesday and Thursday. Same-day review is the strongest
              defence against forgetting. Within five days of a quiz or seven of an exam, that
              course takes Block 1 instead.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Exam-week mode: shadowing pauses first, Saturday exposure shrinks to a 30-minute
              maintenance drive, and MCAT drops to Wednesday only.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {(Object.keys(CAT_COLORS) as Cat[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-light)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[c] }} />
                  {CAT_LABELS[c]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
