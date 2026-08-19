"use client";

import { useEffect, useState } from "react";
import { Flag, ChevronDown, Video, Sun } from "lucide-react";
import { weekFor, nextCheckpoint, assessmentsIn, WEEKLY_HOURS, WEEKLY_TOTAL, BLOCK_FORMAT } from "@/lib/semesterPlan";
import { CALENDAR } from "@/lib/assessments";
import { CAT_COLORS } from "@/lib/weekPlan";
import { isoDate } from "@/lib/dayPlan";

// What this week is for.
//
// The week plan says when she studies. This says what she studies — the
// semester plan's focus for whichever of the fourteen weeks today falls in,
// so "Block 1 — nearest assessment" has an answer without her working it out.

export function SemesterWeekPanel() {
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setToday(isoDate(new Date())); }, []);
  if (!today) return null;

  const w = weekFor(today);
  const cp = nextCheckpoint(today);
  if (!w) return null;

  const assessments = assessmentsIn(w);
  const events = CALENDAR.filter(c => c.date >= w.from && c.date <= w.to && c.date >= today);

  return (
    <div className="rounded-2xl p-4 md:p-5"
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${w.heavy ? "rgba(192,80,60,0.45)" : "var(--border)"}`,
      }}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>
          Week {w.n} of 14
          {w.heavy && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full align-middle"
              style={{ background: "rgba(192,80,60,0.12)", color: "#C0503C" }}>
              pressure point
            </span>
          )}
        </h3>
        <span className="text-[11px]" style={{ color: "var(--text-light)" }}>
          {new Date(`${w.from}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" – "}
          {new Date(`${w.to}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {assessments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {assessments.map(a => (
            <span key={a.id} className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ background: `${CAT_COLORS.study}14`, color: CAT_COLORS.study }}>
              {a.short} {a.kind === "exam" ? "Exam" : "Quiz"} {a.number}
              {" · "}
              {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
              {" · "}{a.weightPct}%
            </span>
          ))}
        </div>
      )}

      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{w.focus}</p>

      <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--text)" }}>Get ahead on:</strong> {w.getAhead}
      </p>

      {events.length > 0 && (
        <div className="mt-3 rounded-xl px-3 py-2.5 space-y-1.5" style={{ background: "var(--bg)" }}>
          {events.map(e => (
            <div key={e.id} className="flex gap-2">
              {e.kind === "review"
                ? <Video size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#2E6FBF" }} />
                : <Sun size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#C97A52" }} />}
              <div className="min-w-0">
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
                  {e.kind === "review" ? ` ${e.time} · ` : " · "}{e.title}
                </span>
                {e.note && (
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{e.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cp && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
          <div className="flex items-center gap-1.5">
            <Flag size={12} style={{ color: "#C97A52" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              {cp.title} —{" "}
              {new Date(`${cp.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </span>
          </div>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{cp.decide}</p>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)}
        className="mt-3 text-xs inline-flex items-center gap-1" style={{ color: "var(--text-light)" }}>
        How the week adds up
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .18s" }} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
            {WEEKLY_HOURS.map(h => (
              <div key={h.slot} className="flex items-baseline gap-2 text-[11px] leading-relaxed">
                <span className="tabular-nums font-semibold w-10 text-right" style={{ color: "var(--text)" }}>
                  {h.hours === 0 ? "—" : `${h.hours}h`}
                </span>
                <span className="font-semibold w-32 flex-shrink-0" style={{ color: "var(--text)" }}>{h.slot}</span>
                <span style={{ color: "var(--text-muted)" }}>{h.note}</span>
              </div>
            ))}
            <p className="text-[11px] mt-2 pt-2" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
              <strong style={{ color: "var(--text)" }}>{WEEKLY_TOTAL} hours</strong> against the plan&apos;s 20–22 —
              and no early mornings. The original put 60 minutes before work five days a week; those hours are in
              Saturday&apos;s block and Sunday evening instead.
            </p>
          </div>

          <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-light)" }}>
              Every study block, same shape
            </p>
            {BLOCK_FORMAT.map(b => (
              <div key={b.minutes} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="tabular-nums font-semibold w-8 flex-shrink-0" style={{ color: "var(--text)" }}>{b.minutes}m</span>
                <span style={{ color: "var(--text-muted)" }}>{b.what}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
