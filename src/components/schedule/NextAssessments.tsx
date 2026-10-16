"use client";

import { useEffect, useState } from "react";
import { CAT_COLORS } from "@/lib/weekPlan";
import { upcoming, daysUntil, type Assessment } from "@/lib/assessments";

// What's actually coming, from the syllabi.
//
// A week view hides the shape of this: the assessments cluster, and they
// cluster across courses. Four of them fall in nine days at the end of August,
// none in the same subject. Seeing that as a list is the difference between
// planning for Monday and planning for the month.

function label(a: Assessment): string {
  return `${a.short} ${a.kind === "exam" ? "Exam" : "Quiz"} ${a.number}`;
}

export function NextAssessments() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  if (!now) return null;

  const next = upcoming(now, 6);
  if (!next.length) return null;

  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>What&apos;s coming</h3>
        <span className="text-[11px]" style={{ color: "var(--text-light)" }}>From your four syllabi</span>
      </div>

      <div className="space-y-1.5">
        {next.map(a => {
          const d = daysUntil(a.date, now);
          // Exam week starts at 7 days out, quiz week at 5 — the same rule the
          // week plan uses to decide which course takes Block 1.
          const hot = d <= (a.kind === "exam" ? 7 : 5);
          const tone = d <= 2 ? "#C0503C" : hot ? "#C97A52" : "var(--text-muted)";
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: "var(--bg)", borderLeft: `3px solid ${hot ? tone : "transparent"}` }}>
              <div className="text-center flex-shrink-0" style={{ width: "3.5rem" }}>
                <div className="text-lg font-bold tabular-nums leading-none" style={{ color: tone }}>
                  {d === 0 ? "today" : d}
                </div>
                {d !== 0 && (
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-light)" }}>
                    {d === 1 ? "day" : "days"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
                  {label(a)}
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${CAT_COLORS.study}1f`, color: CAT_COLORS.study }}>
                    {a.weightPct}%
                  </span>
                </p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
                  {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" at "}
                  {a.time === "08:00" ? "8am" : a.time === "13:00" ? "1pm" : a.time}
                  {" · "}{a.topics[0]}{a.topics.length > 1 ? ` +${a.topics.length - 1} more` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "var(--text-light)" }}>
        All four syllabi say dates move by email and Blackboard is the authority. Treat this as
        the plan, not the record.
      </p>
    </div>
  );
}
