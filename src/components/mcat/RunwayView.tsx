"use client";

import { useMemo, useState } from "react";
import { DashboardData, MCATRunwayCompletion } from "@/types/dashboard";
import { CHIP_LABELS, RUNWAY_DAYS, RUNWAY_PHASES, RUNWAY_TOTAL_DAYS, RUNWAY_WEEKS } from "@/lib/mcatRunwayPlan";
import { Check } from "lucide-react";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const PHASE_COLOR: Record<1 | 2 | 3, string> = { 1: "#4FB6A8", 2: "#9B7FE6", 3: "#E8745C" };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toggleDay(update: Props["update"], day: number, isDone: boolean) {
  update((d) => {
    const completions = d.mcatRunwayCompletions ?? [];
    if (isDone) {
      return { ...d, mcatRunwayCompletions: completions.filter((c) => c.day !== day) };
    }
    const entry: MCATRunwayCompletion = { day, completedAt: new Date().toISOString() };
    return { ...d, mcatRunwayCompletions: [...completions.filter((c) => c.day !== day), entry] };
  });
}

export function RunwayView({ data, update }: Props) {
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());

  const completedDays = useMemo(
    () => new Set((data.mcatRunwayCompletions ?? []).map((c) => c.day)),
    [data.mcatRunwayCompletions]
  );
  const doneCount = completedDays.size;
  const pct = Math.round((doneCount / RUNWAY_TOTAL_DAYS) * 100);

  const recentFLs = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (data.practiceTests ?? [])
      .filter((t) => t.source === "aamc_fl" && new Date(t.date).getTime() >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data.practiceTests]);

  const flAverage = useMemo(() => {
    if (recentFLs.length === 0) return null;
    return Math.round(recentFLs.reduce((s, t) => s + t.total, 0) / recentFLs.length);
  }, [recentFLs]);

  function toggleWeek(weekIndex: number) {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIndex)) next.delete(weekIndex);
      else next.add(weekIndex);
      return next;
    });
  }

  return (
    <div className="aya-dark space-y-6 animate-fade-in -mx-1">
      {/* Hero */}
      <div className="glass p-6 text-center">
        <p className="aya-serif text-5xl md:text-6xl" style={{ color: "var(--aya-text)" }}>
          {RUNWAY_TOTAL_DAYS}
          <span className="text-lg font-semibold ml-2" style={{ color: "var(--aya-text-faint)" }}>days</span>
        </p>
        <p className="text-xs font-semibold tracking-wider mt-1" style={{ color: "var(--aya-text-faint)" }}>
          MCAT RUNWAY
        </p>
        <div className="flex justify-center gap-6 mt-4">
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--aya-text)" }}>{doneCount}</p>
            <p className="text-[10px]" style={{ color: "var(--aya-text-faint)" }}>days logged</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--aya-text)" }}>{RUNWAY_TOTAL_DAYS - doneCount}</p>
            <p className="text-[10px]" style={{ color: "var(--aya-text-faint)" }}>days left</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--aya-magenta)" }}>{pct}%</p>
            <p className="text-[10px]" style={{ color: "var(--aya-text-faint)" }}>runway burned</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass p-4">
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #4FB6A8, #9B7FE6, #E8745C)" }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--aya-text-faint)" }}>
          {doneCount} of {RUNWAY_TOTAL_DAYS} days executed
        </p>
      </div>

      {/* Burndown grid */}
      <div className="glass p-4">
        <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>
          BURNDOWN
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10px,1fr))] gap-1 mt-3">
          {RUNWAY_DAYS.map((d) => {
            const done = completedDays.has(d.day);
            return (
              <div
                key={d.day}
                title={`Day ${d.day}`}
                className="aspect-square rounded-[3px] cursor-pointer"
                style={{
                  background: done ? PHASE_COLOR[d.phase] : `${PHASE_COLOR[d.phase]}30`,
                  opacity: done ? 1 : 0.6,
                }}
                onClick={() => toggleDay(update, d.day, done)}
              />
            );
          })}
        </div>
      </div>

      {/* Spine reminder */}
      <div className="glass glass-glow p-4">
        <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-gold)" }}>
          THE DAILY SPINE
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--aya-text)" }}>
          Anki · CARS · Log misses — done every day before anything else.
        </p>
      </div>

      {/* AAMC FL average */}
      <div className="glass p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>
              AAMC FL AVERAGE · LAST 30 DAYS
            </p>
            <p className="aya-serif text-3xl mt-1" style={{ color: "var(--aya-text)" }}>
              {flAverage ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--aya-text-faint)" }}>Target</p>
            <p className="text-sm font-semibold" style={{ color: "var(--aya-green)" }}>518+</p>
          </div>
        </div>
        {recentFLs.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {recentFLs.map((t) => (
              <span
                key={t.id}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--aya-text-muted)" }}
              >
                {t.label || "FL"} · {t.total}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Phases / weeks / days */}
      {RUNWAY_PHASES.map((phase) => (
        <div key={phase.phase} className="space-y-3">
          <div className="glass p-4" style={{ borderLeft: `4px solid ${PHASE_COLOR[phase.phase]}` }}>
            <p className="text-xs font-semibold tracking-wider" style={{ color: PHASE_COLOR[phase.phase] }}>
              PHASE {phase.no}
            </p>
            <p className="aya-serif text-lg mt-0.5" style={{ color: "var(--aya-text)" }}>{phase.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-faint)" }}>{phase.sub}</p>
          </div>

          {RUNWAY_WEEKS.filter((w) => w.phase === phase.phase).map((week) => {
            const collapsed = collapsedWeeks.has(week.index);
            return (
              <div key={week.index} className="glass p-4">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => toggleWeek(week.index)}
                >
                  <div>
                    <span className="text-xs font-semibold" style={{ color: "var(--aya-text-faint)" }}>
                      Wk {String(week.index).padStart(2, "0")} · d{week.startDay}–{week.endDay}
                    </span>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--aya-text)" }}>
                      {week.name}
                    </p>
                    {week.focus && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-faint)" }}>{week.focus}</p>
                    )}
                  </div>
                  <span style={{ color: "var(--aya-text-faint)" }}>{collapsed ? "▸" : "▾"}</span>
                </button>

                {!collapsed && (
                  <div className="mt-3 space-y-2">
                    {week.days.map((d) => {
                      const done = completedDays.has(d.day);
                      const dow = DOW[(d.day - 1) % 7];
                      return (
                        <div
                          key={d.day}
                          className="flex gap-3 rounded-xl p-2.5"
                          style={{
                            background: d.long ? "rgba(255,255,255,0.04)" : "transparent",
                            opacity: done ? 0.55 : 1,
                          }}
                        >
                          <button
                            onClick={() => toggleDay(update, d.day, done)}
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: done ? "var(--aya-green)" : "transparent",
                              border: done ? "none" : "1.5px solid var(--aya-border)",
                            }}
                          >
                            {done && <Check size={14} color="#170B2E" />}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold" style={{ color: "var(--aya-text-faint)" }}>
                                {dow}
                              </span>
                              {d.chips.map((c) => (
                                <span
                                  key={c}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${PHASE_COLOR[d.phase]}26`, color: PHASE_COLOR[d.phase] }}
                                >
                                  {CHIP_LABELS[c]}
                                </span>
                              ))}
                            </div>
                            <p
                              className="text-sm mt-1 leading-snug"
                              style={{ color: "var(--aya-text-muted)" }}
                              dangerouslySetInnerHTML={{ __html: d.task }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="glass p-4">
        <p className="text-sm" style={{ color: "var(--aya-text-muted)" }}>
          <strong style={{ color: "var(--aya-text)" }}>The one metric that tells the truth:</strong> your AAMC
          full-length average in the final month. If a month out you&apos;re not tracking toward 518+, that&apos;s
          the honest signal to push the date or recalibrate.
        </p>
      </div>
    </div>
  );
}
