"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { Plus, Flame, TrendingUp, BarChart2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TwitchLog {
  id: string;
  triggerType: string;
  intensity: number;
  acted: boolean;
  note?: string;
  createdAt: string;
}

type TriggerKey = "scorekeeping" | "owed" | "monitoring" | "directing" | "preloading" | "airing" | "other";
type Tab = "today" | "patterns";

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGERS: { key: TriggerKey; label: string; desc: string; color: string }[] = [
  { key: "scorekeeping", label: "Scorekeeping", desc: "tallying who did what for whom",          color: "#8B7355" },
  { key: "owed",         label: "Owed",         desc: "feeling owed / wanting repercussions",    color: "#A0522D" },
  { key: "monitoring",   label: "Monitoring",   desc: "urge to check on / audit someone",        color: "#5C6B8A" },
  { key: "directing",    label: "Directing",    desc: "urge to tell someone what to do",         color: "#4A6741" },
  { key: "preloading",   label: "Preloading",   desc: "threatening future consequences",         color: "#7B4F2E" },
  { key: "airing",       label: "Airing",       desc: "raise an issue the moment it appears",   color: "#6B4C8B" },
  { key: "other",        label: "Other",        desc: "",                                        color: "#6B6B6B" },
];

const LEVELS = [
  { min: 0,   max: 9,          name: "Novice Lifter",  desc: "Just getting started" },
  { min: 10,  max: 24,         name: "Training Block", desc: "Building the habit" },
  { min: 25,  max: 49,         name: "Form Check",     desc: "Pattern is forming" },
  { min: 50,  max: 99,         name: "Heavy Set",      desc: "Consistent practice" },
  { min: 100, max: 199,        name: "Plate Stacker",  desc: "Real momentum" },
  { min: 200, max: 499,        name: "1RM Hunter",     desc: "Advanced practitioner" },
  { min: 500, max: Infinity,   name: "Elite Rep",      desc: "Mastery in motion" },
];

const TIME_LABELS = ["12–3a", "3–6a", "6–9a", "9a–12p", "12–3p", "3–6p", "6–9p", "9p–12a"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Analytics helpers ────────────────────────────────────────────────────────

function calcResistedStreak(logs: TwitchLog[]): number {
  let streak = 0;
  for (const log of logs) {
    if (!log.acted) streak++;
    else break;
  }
  return streak;
}

function getLevel(total: number) {
  return LEVELS.find(l => total >= l.min && total <= l.max) ?? LEVELS[0];
}

function buildHeatmap(logs: TwitchLog[]): number[][] {
  const grid: number[][] = Array(7).fill(null).map(() => Array(8).fill(0));
  logs.forEach(log => {
    const d     = new Date(log.createdAt);
    const dow   = d.getDay();
    const block = Math.floor(d.getHours() / 3);
    grid[dow][block]++;
  });
  return grid;
}

function buildRatioTrend(logs: TwitchLog[]) {
  const byDate = new Map<string, { sat: number; total: number }>();
  logs.forEach(log => {
    const date = log.createdAt.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { sat: 0, total: 0 });
    const d = byDate.get(date)!;
    d.total++;
    if (!log.acted) d.sat++;
  });
  return Array.from({ length: 30 }, (_, i) => {
    const d    = new Date(Date.now() - (29 - i) * 86400000);
    const date = d.toISOString().slice(0, 10);
    const rec  = byDate.get(date);
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      rate: rec && rec.total > 0 ? Math.round((rec.sat / rec.total) * 100) : null,
    };
  });
}

function buildIntensityTrend(logs: TwitchLog[]) {
  const byDate = new Map<string, number[]>();
  logs.forEach(log => {
    const date = log.createdAt.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(log.intensity);
  });
  return Array.from({ length: 30 }, (_, i) => {
    const d    = new Date(Date.now() - (29 - i) * 86400000);
    const date = d.toISOString().slice(0, 10);
    const vals = byDate.get(date);
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      avg:  vals && vals.length > 0
        ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
        : null,
    };
  });
}

function buildTriggerBreakdown(logs: TwitchLog[]) {
  const counts: Record<string, number> = {};
  logs.forEach(l => { counts[l.triggerType] = (counts[l.triggerType] ?? 0) + 1; });
  return TRIGGERS
    .map(t => ({ name: t.label, count: counts[t.key] ?? 0, color: t.color }))
    .sort((a, b) => b.count - a.count);
}

// ─── Log Modal ────────────────────────────────────────────────────────────────

interface LogEntry { triggerType: TriggerKey; intensity: number; acted: boolean; note: string }

function TwitchLogModal({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (e: LogEntry) => Promise<void>;
}) {
  const [trigger,   setTrigger]   = useState<TriggerKey | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [acted,     setActed]     = useState(false);
  const [note,      setNote]      = useState("");
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    if (open) {
      setTrigger(null); setIntensity(5); setActed(false); setNote(""); setSaving(false); setDone(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!trigger) return;
    setSaving(true);
    await onSave({ triggerType: trigger, intensity, acted, note });
    setDone(true);
    setTimeout(onClose, 900);
  };

  if (done) {
    return (
      <Modal open={open} onClose={onClose} width="max-w-sm">
        <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>{acted ? "📝" : "🌿"}</div>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: "0.25rem" }}>
            {acted ? "Logged." : "Sat with it. That's the rep."}
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {acted ? "Awareness is step one." : "Your nervous system just learned something."}
          </p>
        </div>
      </Modal>
    );
  }

  const triggerMeta = TRIGGERS.find(t => t.key === trigger);

  return (
    <Modal open={open} onClose={onClose} title="Log a Twitch" width="max-w-md">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Trigger chips */}
        <div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
            What kind?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.45rem" }}>
            {TRIGGERS.map(t => (
              <button key={t.key} onClick={() => setTrigger(t.key)} style={{
                padding: "0.55rem 0.4rem",
                borderRadius: "10px",
                border: trigger === t.key ? `2px solid ${t.color}` : "2px solid transparent",
                background: trigger === t.key ? `${t.color}18` : "var(--bg)",
                color: trigger === t.key ? t.color : "var(--text-muted)",
                fontSize: "0.78rem",
                fontWeight: trigger === t.key ? 700 : 500,
                cursor: "pointer",
                textAlign: "center",
                lineHeight: 1.2,
                transition: "all 0.12s ease",
              }}>
                {t.label}
              </button>
            ))}
          </div>
          {triggerMeta?.desc && (
            <p style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "0.4rem", fontStyle: "italic" }}>
              {triggerMeta.desc}
            </p>
          )}
        </div>

        {/* Intensity */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Intensity
            </p>
            <span style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{intensity}</span>
          </div>
          <input type="range" min={1} max={10} value={intensity}
            onChange={e => setIntensity(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
            <span>mild</span><span>overwhelming</span>
          </div>
        </div>

        {/* Acted / Sat toggle */}
        <div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
            What happened?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button onClick={() => setActed(true)} style={{
              padding: "0.85rem",
              borderRadius: "12px",
              border: acted ? "2px solid #DA667B" : "2px solid var(--border)",
              background: acted ? "rgba(218,102,123,0.08)" : "var(--bg)",
              color: acted ? "#DA667B" : "var(--text-muted)",
              fontSize: "0.88rem",
              fontWeight: acted ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}>
              Acted on it
            </button>
            <button onClick={() => setActed(false)} style={{
              padding: "0.85rem",
              borderRadius: "12px",
              border: !acted ? "2px solid #71816D" : "2px solid var(--border)",
              background: !acted ? "rgba(113,129,109,0.08)" : "var(--bg)",
              color: !acted ? "#71816D" : "var(--text-muted)",
              fontSize: "0.88rem",
              fontWeight: !acted ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}>
              Sat with it ✓
            </button>
          </div>
        </div>

        {/* Note */}
        <textarea
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{
            width: "100%", padding: "0.6rem 0.75rem",
            borderRadius: "10px",
            border: "1.5px solid var(--border)",
            background: "var(--surface2)",
            color: "var(--text)", fontSize: "0.85rem",
            resize: "none", outline: "none", fontFamily: "inherit",
          }}
        />

        {/* Submit */}
        <button onClick={handleSave} disabled={!trigger || saving} style={{
          width: "100%", padding: "0.85rem",
          borderRadius: "12px", border: "none",
          background: !trigger || saving
            ? "rgba(124,92,252,0.2)"
            : acted
              ? "linear-gradient(135deg, #DA667B, #E879F9)"
              : "linear-gradient(135deg, #71816D, #4A6741)",
          color: !trigger || saving ? "rgba(124,92,252,0.4)" : "#fff",
          fontSize: "0.95rem", fontWeight: 700,
          cursor: !trigger || saving ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          letterSpacing: "0.02em",
        }}>
          {saving ? "Logging…" : acted ? "Log it" : "Log it — sat with it ✓"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function HeatmapView({ logs }: { logs: TwitchLog[] }) {
  const grid   = buildHeatmap(logs);
  const maxVal = Math.max(1, ...grid.flat());

  return (
    <div>
      <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1rem" }}>
        When twitches fire
      </p>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "320px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
            <div />
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 600, color: "var(--text-muted)" }}>{d}</div>
            ))}
          </div>
          {TIME_LABELS.map((label, blockIdx) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", gap: "3px", marginBottom: "3px", alignItems: "center" }}>
              <div style={{ fontSize: "0.58rem", color: "var(--text-light)", textAlign: "right", paddingRight: "6px" }}>{label}</div>
              {DAYS.map((_, dayIdx) => {
                const count   = grid[dayIdx][blockIdx];
                const opacity = count === 0 ? 0.06 : 0.15 + (count / maxVal) * 0.75;
                return (
                  <div key={dayIdx} title={count > 0 ? `${count} twitch${count !== 1 ? "es" : ""}` : undefined} style={{
                    height: "26px", borderRadius: "5px",
                    background: `rgba(124,92,252,${opacity})`,
                    transition: "background 0.2s",
                  }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: "0.7rem", color: "var(--text-light)", marginTop: "0.75rem" }}>
        Darker = higher frequency. Your peak windows are where the Mantra Engine will target first.
      </p>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const tabStyle = (active: boolean) => ({
  display: "flex" as const,
  alignItems: "center" as const,
  gap: "0.4rem",
  padding: "0.5rem 1rem",
  borderRadius: "9px",
  border: "none",
  background: active ? "var(--surface)" : "transparent",
  color: active ? "var(--purple)" : "var(--text-muted)",
  fontWeight: active ? 600 : 400,
  fontSize: "0.85rem",
  cursor: "pointer" as const,
  boxShadow: active ? "0 1px 4px rgba(124,92,252,0.12)" : "none",
  transition: "all 0.15s ease",
});

export function FeltSafetyView() {
  const [logs,    setLogs]    = useState<TwitchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [tab,     setTab]     = useState<Tab>("today");

  useEffect(() => {
    fetch("/api/felt-safety/twitches")
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async (entry: LogEntry) => {
    const res = await fetch("/api/felt-safety/twitches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const { log } = await res.json();
    setLogs(prev => [log, ...prev]);
  }, []);

  const todayStr      = new Date().toISOString().slice(0, 10);
  const todayLogs     = logs.filter(l => l.createdAt?.startsWith(todayStr));
  const totalResisted = logs.filter(l => !l.acted).length;
  const streak        = calcResistedStreak(logs);
  const level         = getLevel(totalResisted);
  const allTimeRate   = logs.length > 0 ? Math.round((totalResisted / logs.length) * 100) : 0;
  const todayResisted = todayLogs.filter(l => !l.acted).length;
  const todayActed    = todayLogs.filter(l => l.acted).length;
  const ratioTrend    = buildRatioTrend(logs);
  const intensityTrend    = buildIntensityTrend(logs);
  const triggerBreakdown  = buildTriggerBreakdown(logs);
  const activeTriggers    = triggerBreakdown.filter(t => t.count > 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="font-serif" style={{ fontSize: "2.25rem", color: "var(--text)", lineHeight: 1.1, marginBottom: "0.3rem" }}>
            Felt Safety
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Progressive overload for emotional regulation. The rep is restraint.
          </p>
        </div>
        <button onClick={() => setLogOpen(true)} style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.75rem 1.25rem",
          borderRadius: "14px", border: "none",
          background: "linear-gradient(135deg, var(--purple) 0%, var(--pink) 100%)",
          color: "#fff", fontSize: "0.9rem", fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(124,92,252,0.35)",
          flexShrink: 0,
        }}>
          <Plus size={18} /> Log a Twitch
        </button>
      </div>

      {/* Hero stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>

        <div className="card" style={{
          padding: "1.25rem",
          gridColumn: "span 2",
          background: "linear-gradient(135deg, rgba(113,129,109,0.1) 0%, rgba(74,103,65,0.06) 100%)",
          border: "1px solid rgba(113,129,109,0.22)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "1.25rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#71816D", marginBottom: "0.15rem" }}>
                Resisted
              </p>
              <p style={{ fontSize: "3.5rem", fontWeight: 900, color: "#4A6741", lineHeight: 1 }}>{totalResisted}</p>
            </div>
            <div style={{ paddingBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#4A6741" }}>{level.name}</p>
              <p style={{ fontSize: "0.72rem", color: "#71816D" }}>{level.desc}</p>
            </div>
            {streak > 0 && (
              <div style={{ marginLeft: "auto", textAlign: "right", paddingBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "flex-end" }}>
                  <Flame size={16} style={{ color: "#F59E0B" }} />
                  <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)" }}>{streak}</span>
                </div>
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>streak</p>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
            All-time rate
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)" }}>{allTimeRate}%</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>sat with it</p>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
            Today
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)" }}>{todayLogs.length}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {todayResisted > 0 && <span style={{ color: "#71816D" }}>{todayResisted} sat</span>}
            {todayResisted > 0 && todayActed > 0 && " · "}
            {todayActed > 0 && <span style={{ color: "#DA667B" }}>{todayActed} acted</span>}
            {todayLogs.length === 0 && "—"}
          </p>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
            Total logged
          </p>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text)" }}>{logs.length}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>twitches</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg)", borderRadius: "12px", padding: "4px", width: "fit-content" }}>
        <button onClick={() => setTab("today")} style={tabStyle(tab === "today")}>
          <span style={{ fontSize: "0.85rem" }}>Today</span>
        </button>
        <button onClick={() => setTab("patterns")} style={tabStyle(tab === "patterns")}>
          <TrendingUp size={14} />
          <span>Patterns</span>
        </button>
      </div>

      {/* Today */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {loading ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
          ) : todayLogs.length === 0 ? (
            <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "1.75rem", marginBottom: "0.6rem" }}>🌿</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No twitches logged today.</p>
              <p style={{ color: "var(--text-light)", fontSize: "0.8rem", marginTop: "0.2rem" }}>Tap "Log a Twitch" when an urge appears.</p>
            </div>
          ) : (
            todayLogs.map(log => {
              const trigger = TRIGGERS.find(t => t.key === log.triggerType);
              return (
                <div key={log.id} className="card" style={{
                  padding: "0.9rem 1.25rem",
                  display: "flex", alignItems: "center", gap: "1rem",
                  borderLeft: `3px solid ${log.acted ? "#DA667B" : "#71816D"}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: log.note ? "0.3rem" : 0 }}>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, padding: "0.18rem 0.5rem",
                        borderRadius: "20px",
                        background: `${trigger?.color ?? "#888"}18`,
                        color: trigger?.color ?? "#888",
                      }}>
                        {trigger?.label ?? log.triggerType}
                      </span>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, padding: "0.18rem 0.5rem",
                        borderRadius: "20px",
                        background: log.acted ? "rgba(218,102,123,0.1)" : "rgba(113,129,109,0.1)",
                        color: log.acted ? "#DA667B" : "#71816D",
                      }}>
                        {log.acted ? "acted" : "sat with it ✓"}
                      </span>
                    </div>
                    {log.note && (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{log.note}</p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{log.intensity}</p>
                    <p style={{ fontSize: "0.62rem", color: "var(--text-light)" }}>intensity</p>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-light)", flexShrink: 0 }}>
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Patterns */}
      {tab === "patterns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Restraint rate trend */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Restraint rate — 30 days
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
                  % of twitches sat with. Upward trend = rewiring.
                </p>
              </div>
              <TrendingUp size={16} style={{ color: "#71816D" }} />
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={ratioTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-light)" }} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-light)" }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v}%`, "Sat with it"]}
                />
                <Line type="monotone" dataKey="rate" stroke="#71816D" strokeWidth={2.5}
                  dot={{ r: 3, fill: "#71816D" }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Heatmap */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <HeatmapView logs={logs} />
          </div>

          {/* Trigger breakdown */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Which twitches fire most
            </p>
            {activeTriggers.length === 0 ? (
              <p style={{ color: "var(--text-light)", fontSize: "0.85rem", textAlign: "center", padding: "1rem 0" }}>
                No twitches logged yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={activeTriggers.length * 44 + 16}>
                <BarChart data={activeTriggers} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-light)" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--text)" }} width={78} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {activeTriggers.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Intensity trend */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Average intensity — 30 days
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
                  Downward trend = urges losing their grip.
                </p>
              </div>
              <BarChart2 size={16} style={{ color: "var(--text-muted)" }} />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={intensityTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-light)" }} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-light)" }} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [v, "avg intensity"]}
                />
                <Line type="monotone" dataKey="avg" stroke="var(--purple)" strokeWidth={2}
                  dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      <TwitchLogModal open={logOpen} onClose={() => setLogOpen(false)} onSave={handleSave} />
    </div>
  );
}
