"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, TrendingUp } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";
import { ASSESSMENTS } from "@/lib/assessments";
import { allCourseGrades, verdict, letterFor, QUIZ_1, type Score } from "@/lib/grades";

// Where the A actually stands, today.
//
// The semester plan does this arithmetic once, from Quiz 1, in a PDF. It stops
// being true the moment the next score lands — and the number moving is the
// entire point. Enter a score here and every target recalculates.
//
// Checked against the plan's own figures: banked, lost and the average needed
// match to two decimals on all four courses, and its Micro Exam 1 scenarios
// (95% → needs 91.5, 80% → needs 94.8) come out the same.

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const TONE = {
  good: "#0F8A55",
  warn: "#C97A52",
  hard: "#C0503C",
};

export function GradesView({ data, update }: Props) {
  const scores: Score[] = data.assessmentScores ?? QUIZ_1;
  const [editing, setEditing] = useState<string | null>(null);
  const [earned, setEarned] = useState("");
  const [outOf, setOutOf] = useState("");

  const grades = useMemo(() => allCourseGrades(scores), [scores]);

  const save = (id: string) => {
    const e = parseFloat(earned);
    const o = parseFloat(outOf);
    if (!Number.isFinite(e) || !Number.isFinite(o) || o <= 0) return;
    update(d => ({
      ...d,
      assessmentScores: [...(d.assessmentScores ?? QUIZ_1).filter(s => s.id !== id), { id, earned: e, outOf: o }],
    }));
    setEditing(null);
    setEarned(""); setOutOf("");
  };

  const clear = (id: string) => {
    update(d => ({ ...d, assessmentScores: (d.assessmentScores ?? QUIZ_1).filter(s => s.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Where the A stands</h2>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every score you enter moves these numbers. Assignments and attendance are counted as full
          marks — that&apos;s 10 free points per course and the cheapest insurance there is.
        </p>
      </div>

      {grades.map(g => {
        const v = verdict(g);
        const needA = g.neededFor.A ?? 0;
        return (
          <div key={g.short} className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderLeft: `4px solid ${TONE[v.tone]}` }}>

            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h3 className="font-serif text-xl" style={{ color: "var(--text)" }}>{g.course}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>needs</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: TONE[v.tone] }}>
                  {g.aStillPossible ? `${needA.toFixed(1)}%` : "—"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>for an A</span>
              </div>
            </div>

            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{v.text}</p>

            {/* Banked, lost, still open — the three numbers that explain the target */}
            <div className="flex gap-2 mt-3">
              {([
                ["Banked", g.banked, "#0F8A55"],
                ["Lost", g.lost, "#C0503C"],
                ["Still open", g.remaining, "var(--text-light)"],
              ] as const).map(([label, val, color]) => (
                <div key={label} className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>{label}</div>
                  <div className="text-lg font-bold tabular-nums" style={{ color }}>{val.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 h-2 rounded-full overflow-hidden flex" style={{ background: "var(--surface2)" }}>
              <motion.div animate={{ width: `${g.banked}%` }} style={{ background: "#0F8A55" }} />
              <motion.div animate={{ width: `${g.lost}%` }} style={{ background: "#C0503C", opacity: 0.55 }} />
            </div>

            {/* Every assessment, scored or not */}
            <div className="mt-4 space-y-1">
              {ASSESSMENTS.filter(a => a.short === g.short).map(a => {
                const s = scores.find(x => x.id === a.id);
                const pct = s && s.outOf > 0 ? (s.earned / s.outOf) * 100 : null;
                const isEditing = editing === a.id;
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: pct !== null ? "var(--bg)" : undefined }}>
                    <span className="text-xs w-24 flex-shrink-0" style={{ color: "var(--text)" }}>
                      {a.kind === "exam" ? "Exam" : "Quiz"} {a.number}
                    </span>
                    <span className="text-[11px] tabular-nums w-16 flex-shrink-0" style={{ color: "var(--text-light)" }}>
                      {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[11px] w-8 flex-shrink-0 tabular-nums" style={{ color: "var(--text-light)" }}>
                      {a.weightPct}%
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input autoFocus type="number" inputMode="decimal" placeholder="got" value={earned}
                          onChange={e => setEarned(e.target.value)}
                          className="w-16 text-sm px-2 py-1 rounded-lg"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <span style={{ color: "var(--text-light)" }}>/</span>
                        <input type="number" inputMode="decimal" placeholder="of" value={outOf}
                          onChange={e => setOutOf(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") save(a.id); }}
                          className="w-16 text-sm px-2 py-1 rounded-lg"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <button onClick={() => save(a.id)} className="px-2 py-1 rounded-lg text-xs font-bold"
                          style={{ background: "var(--text)", color: "var(--surface)" }}>Save</button>
                        <button onClick={() => setEditing(null)} className="text-xs" style={{ color: "var(--text-light)" }}>×</button>
                      </div>
                    ) : pct !== null ? (
                      <>
                        <span className="text-sm font-semibold tabular-nums flex-1"
                          style={{ color: pct >= 90 ? "#0F8A55" : pct >= 80 ? "#C97A52" : "#C0503C" }}>
                          {s!.earned}/{s!.outOf} · {pct.toFixed(0)}%
                        </span>
                        <button onClick={() => { setEditing(a.id); setEarned(String(s!.earned)); setOutOf(String(s!.outOf)); }}
                          className="text-[11px] underline" style={{ color: "var(--text-light)" }}>edit</button>
                        <button onClick={() => clear(a.id)} className="text-[11px]" style={{ color: "var(--text-light)" }}>×</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditing(a.id); setEarned(""); setOutOf("100"); }}
                        className="text-xs flex-1 text-left" style={{ color: "var(--text-light)" }}>
                        + add score
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {g.upcoming[0] && (
              <p className="text-[11px] mt-3" style={{ color: "var(--text-light)" }}>
                Next: {g.upcoming[0].kind === "exam" ? "Exam" : "Quiz"} {g.upcoming[0].number} on{" "}
                {new Date(`${g.upcoming[0].date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" · "}{g.upcoming[0].weightPct}% of the grade
              </p>
            )}
          </div>
        );
      })}

      {/* The things that cost A's without being hard */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={15} style={{ color: "#C0503C" }} />
          <h3 className="section-title">Automatic zeros</h3>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          None of these are about how well you know the material. They cost A&apos;s more often than
          hard questions do.
        </p>
        <ul className="space-y-1.5">
          {[
            "Download every quiz and exam the day it posts — 48 hours before at the latest. Miss the window and it's a zero however prepared you were.",
            "Tech check before every sitting: webcam, mic, bandwidth, Examplify login. A dead ExamMonitor feed means no points.",
            "Never log in late. Late arrivals get no extra time, announced or not.",
            "Anything that threatens a test date goes to the Director and Assistant Director before the scheduled time. After the fact is a zero.",
            "Course evaluations within 3 calendar days. Physiology turns an incomplete evaluation into an I, then an F after a month.",
            "Cite any AI help and write in your own voice. All four syllabi allow it; unacknowledged use is misconduct.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: "var(--text)" }}>
              <Check size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-light)" }} />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={15} style={{ color: "var(--text-muted)" }} />
          <h3 className="section-title">If a week goes wrong, cut in this order</h3>
        </div>
        <ol className="space-y-1">
          {[
            "Get-ahead work for future weeks",
            "The second daily pass on your strongest course",
            "CMB blocks — it has the most banked points",
            "Physiology blocks",
          ].map((t, i) => (
            <li key={i} className="text-xs flex gap-2" style={{ color: "var(--text)" }}>
              <span className="font-bold tabular-nums" style={{ color: "var(--text-light)" }}>{i + 1}</span>{t}
            </li>
          ))}
        </ol>
        <p className="text-xs mt-2.5 leading-relaxed" style={{ color: "#C0503C" }}>
          Never cut: the Micro daily deck, any assessment prep inside 4 days, or the error log.
        </p>
      </div>
    </div>
  );
}
