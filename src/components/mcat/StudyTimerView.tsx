"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, RotateCcw, Clock, BarChart2 } from "lucide-react";
import { StudyTimerLog, DashboardData } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { format, isToday, parseISO } from "date-fns";

const SUBJECTS = [
  { name: "Behavioral Sciences", color: "#7C5CFC" },
  { name: "Biochemistry",        color: "#E879F9" },
  { name: "Biology",             color: "#10B981" },
  { name: "CARS",                color: "#FB923C" },
  { name: "General Chemistry",   color: "#F59E0B" },
  { name: "Organic Chemistry",   color: "#EF4444" },
  { name: "Physics",             color: "#6366F1" },
];

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(secs: number): string {
  const h = secs / 3600;
  if (h < 0.1) return `${Math.round(secs / 60)}m`;
  return `${h.toFixed(1)}h`;
}

function subjectColor(name: string): string {
  return SUBJECTS.find((s) => s.name === name)?.color ?? "#7C5CFC";
}

function calcStreak(logs: StudyTimerLog[]): number {
  if (!logs.length) return 0;
  const days = Array.from(new Set(logs.map((l) => l.date))).sort().reverse();
  let streak = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  let cursor = today;
  for (const day of days) {
    if (day === cursor) {
      streak++;
      // move cursor back one day
      const d = new Date(cursor + "T12:00:00");
      d.setDate(d.getDate() - 1);
      cursor = format(d, "yyyy-MM-dd");
    } else {
      break;
    }
  }
  return streak;
}

function bestDay(logs: StudyTimerLog[]): { date: string; secs: number } | null {
  if (!logs.length) return null;
  const byDate: Record<string, number> = {};
  for (const l of logs) {
    byDate[l.date] = (byDate[l.date] ?? 0) + l.durationSeconds;
  }
  const best = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  return { date: best[0], secs: best[1] };
}

export function StudyTimerView({ data, update }: Props) {
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [showAllTime, setShowAllTime] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Accurate timer using Date.now() deltas
  useEffect(() => {
    if (running && startTime !== null) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, startTime]);

  function handleStart() {
    if (!activeSubject) return;
    const now = Date.now();
    // If resuming, offset startTime so elapsed stays continuous
    setStartTime(now - elapsed * 1000);
    if (!sessionStart) setSessionStart(now - elapsed * 1000);
    setRunning(true);
  }

  function handlePause() {
    setRunning(false);
  }

  function handleStop() {
    if (!activeSubject || elapsed === 0) {
      setRunning(false);
      setElapsed(0);
      setStartTime(null);
      setSessionStart(null);
      return;
    }
    const log: StudyTimerLog = {
      id: id(),
      date: format(new Date(), "yyyy-MM-dd"),
      subject: activeSubject,
      durationSeconds: elapsed,
      startedAt: new Date(sessionStart ?? Date.now() - elapsed * 1000).toISOString(),
    };
    update((d) => ({
      ...d,
      studyTimerLogs: [...(d.studyTimerLogs ?? []), log],
    }));
    setRunning(false);
    setElapsed(0);
    setStartTime(null);
    setSessionStart(null);
  }

  function handleReset() {
    setRunning(false);
    setElapsed(0);
    setStartTime(null);
    setSessionStart(null);
  }

  const allLogs = data.studyTimerLogs ?? [];
  const todayLogs = allLogs.filter((l) => {
    try { return isToday(parseISO(l.date)); } catch { return false; }
  });

  // Group today's logs by subject
  const todayBySubject: Record<string, number> = {};
  for (const l of todayLogs) {
    todayBySubject[l.subject] = (todayBySubject[l.subject] ?? 0) + l.durationSeconds;
  }
  const todayTotal = Object.values(todayBySubject).reduce((a, b) => a + b, 0);

  // All-time by subject
  const allBySubject: Record<string, number> = {};
  for (const l of allLogs) {
    allBySubject[l.subject] = (allBySubject[l.subject] ?? 0) + l.durationSeconds;
  }
  const allTotal = Object.values(allBySubject).reduce((a, b) => a + b, 0);
  const maxSubjectSecs = Math.max(...Object.values(allBySubject), 1);

  const streak = calcStreak(allLogs);
  const best = bestDay(allLogs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--grad)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Clock size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Study Timer</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Track time per MCAT subject</p>
        </div>
      </div>

      {/* Timer Panel */}
      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Subject selector */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Select Subject
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUBJECTS.map((s) => {
              const active = activeSubject === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => { if (!running) setActiveSubject(active ? null : s.name); }}
                  disabled={running}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    border: "2px solid",
                    borderColor: active ? s.color : "var(--border)",
                    background: active ? s.color : "white",
                    color: active ? "#fff" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: running ? "not-allowed" : "pointer",
                    opacity: running && !active ? 0.5 : 1,
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timer display */}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div
            style={{
              fontSize: elapsed >= 3600 ? 52 : 64,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              background: "var(--grad)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.02em",
            }}
          >
            {formatElapsed(elapsed)}
          </div>
          {activeSubject && (
            <p style={{ marginTop: 8, fontSize: 14, color: subjectColor(activeSubject), fontWeight: 600 }}>
              {activeSubject}
            </p>
          )}
          {!activeSubject && (
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)" }}>
              Select a subject to start
            </p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          {!running ? (
            <button
              onClick={handleStart}
              disabled={!activeSubject}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 28px",
                borderRadius: 14,
                border: "none",
                background: activeSubject ? "var(--grad)" : "#C4B8F0",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: activeSubject ? "pointer" : "not-allowed",
                boxShadow: activeSubject ? "0 4px 16px rgba(124,92,252,0.3)" : "none",
              }}
            >
              <Play size={18} fill="#fff" />
              {elapsed > 0 ? "Resume" : "Start"}
            </button>
          ) : (
            <button
              onClick={handlePause}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 28px",
                borderRadius: 14,
                border: "none",
                background: "#F59E0B",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
              }}
            >
              <Pause size={18} fill="#fff" />
              Pause
            </button>
          )}

          <button
            onClick={handleStop}
            disabled={elapsed === 0}
            title="Stop & Save"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 20px",
              borderRadius: 14,
              border: "2px solid",
              borderColor: elapsed > 0 ? "#10B981" : "var(--border)",
              background: elapsed > 0 ? "rgba(16,185,129,0.08)" : "white",
              color: elapsed > 0 ? "#10B981" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: 14,
              cursor: elapsed > 0 ? "pointer" : "not-allowed",
            }}
          >
            <Square size={16} fill={elapsed > 0 ? "#10B981" : "var(--text-muted)"} />
            Stop & Save
          </button>

          <button
            onClick={handleReset}
            title="Reset"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44,
              borderRadius: 12,
              border: "2px solid var(--border)",
              background: "white",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Today's Study Log */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Clock size={16} color="#7C5CFC" />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>Today&apos;s Study Log</h3>
          {todayTotal > 0 && (
            <div
              style={{
                marginLeft: "auto",
                padding: "4px 12px",
                borderRadius: 20,
                background: "var(--grad)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {formatHours(todayTotal)} total
            </div>
          )}
        </div>

        {todayTotal === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
            No sessions logged today. Start your first session above!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Stacked bar */}
            <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", background: "var(--bg)" }}>
              {SUBJECTS.filter((s) => todayBySubject[s.name]).map((s) => (
                <div
                  key={s.name}
                  style={{
                    width: `${(todayBySubject[s.name] / todayTotal) * 100}%`,
                    background: s.color,
                    transition: "width 0.5s ease",
                  }}
                />
              ))}
            </div>

            {/* Per-subject rows */}
            {SUBJECTS.filter((s) => todayBySubject[s.name]).map((s) => {
              const secs = todayBySubject[s.name];
              const pct = Math.round((secs / todayTotal) * 100);
              return (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, minWidth: 10 }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>{pct}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color, minWidth: 44, textAlign: "right" }}>
                    {formatHours(secs)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All-time stats (collapsible) */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <button
          onClick={() => setShowAllTime((v) => !v)}
          style={{
            width: "100%",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            borderBottom: showAllTime ? "1px solid var(--border)" : "none",
          }}
        >
          <BarChart2 size={18} color="#7C5CFC" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", flex: 1, textAlign: "left" }}>
            All-Time Stats
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {formatHours(allTotal)} total
          </span>
          <span style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1 }}>
            {showAllTime ? "▲" : "▼"}
          </span>
        </button>

        {showAllTime && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Streak & best day */}
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(124,92,252,0.08), rgba(232,121,249,0.08))",
                  border: "1.5px solid var(--border)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#7C5CFC", lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Day Streak</div>
              </div>
              <div
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))",
                  border: "1.5px solid rgba(16,185,129,0.2)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#10B981", lineHeight: 1 }}>
                  {best ? formatHours(best.secs) : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Best Day {best ? `(${format(parseISO(best.date), "MMM d")})` : ""}
                </div>
              </div>
            </div>

            {/* Horizontal bar chart */}
            {allTotal > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  Hours by Subject (All Time)
                </p>
                {SUBJECTS.filter((s) => allBySubject[s.name]).sort((a, b) => (allBySubject[b.name] ?? 0) - (allBySubject[a.name] ?? 0)).map((s) => {
                  const secs = allBySubject[s.name] ?? 0;
                  const barPct = (secs / maxSubjectSecs) * 100;
                  return (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, minWidth: 10 }} />
                      <span style={{ width: 130, fontSize: 12, color: "var(--text)", fontWeight: 500, flexShrink: 0 }}>
                        {s.name}
                      </span>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: "100%",
                            background: s.color,
                            borderRadius: 4,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.color, minWidth: 40, textAlign: "right" }}>
                        {formatHours(secs)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {allTotal === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center" }}>
                No study sessions logged yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
