"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RepCard {
  id: string;
  title: string;
  instruction: string;
  tier: number;
  category: string;
  custom: boolean;
  ratingAvg: number;
  timesDrawn: number;
  active: boolean;
}

interface RepCompletion {
  id: string;
  cardId: string;
  beforeScore: number;
  afterScore: number;
  note?: string;
  redrawn: boolean;
  completedAt: string;
}

type Phase = "draw" | "before" | "complete" | "rate" | "done";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CFG = {
  1: { label: "T1", name: "Bronze", color: "#A0522D", bg: "rgba(160,82,45,0.11)", border: "rgba(160,82,45,0.28)" },
  2: { label: "T2", name: "Silver", color: "#8B7355", bg: "rgba(139,115,85,0.11)", border: "rgba(139,115,85,0.28)" },
  3: { label: "T3", name: "Gold",   color: "#C8A96E", bg: "rgba(212,184,150,0.16)", border: "rgba(212,184,150,0.45)" },
} as const;

type TierKey = 1 | 2 | 3;

function tierCfg(tier: number) {
  return TIER_CFG[(tier as TierKey)] ?? TIER_CFG[1];
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function buildDeltaChart(completions: RepCompletion[]) {
  const byDate = new Map<string, { befores: number[]; afters: number[] }>();
  completions.forEach(c => {
    const date = c.completedAt.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { befores: [], afters: [] });
    const d = byDate.get(date)!;
    d.befores.push(c.beforeScore);
    d.afters.push(c.afterScore);
  });
  return Array.from({ length: 30 }, (_, i) => {
    const d    = new Date(Date.now() - (29 - i) * 86400000);
    const date = d.toISOString().slice(0, 10);
    const rec  = byDate.get(date);
    const avg  = (arr: number[]) =>
      arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
    return {
      date:   `${d.getMonth() + 1}/${d.getDate()}`,
      before: rec ? avg(rec.befores) : null,
      after:  rec ? avg(rec.afters)  : null,
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
  const cfg = tierCfg(tier);
  return (
    <span style={{
      fontSize: "0.63rem",
      fontWeight: 800,
      letterSpacing: "0.07em",
      padding: "0.22rem 0.6rem",
      borderRadius: "20px",
      background: cfg.bg,
      color: cfg.color,
      border: `1.5px solid ${cfg.border}`,
      whiteSpace: "nowrap" as const,
    }}>
      {cfg.label} · {cfg.name}
    </span>
  );
}

function ScoreSlider({
  value, onChange, label, lowLabel = "calm", highLabel = "overwhelmed",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  lowLabel?: string;
  highLabel?: string;
}) {
  const pct   = ((value - 1) / 9) * 100;
  const color = pct < 34 ? "#71816D" : pct < 67 ? "#D4B896" : "#DA667B";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
        <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>
          {label}
        </p>
        <span style={{ fontSize: "2.1rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

function StarRow({ onRate, disabled }: { onRate: (s: number) => void; disabled: boolean }) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => !disabled && onRate(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => setHover(0)}
          disabled={disabled}
          style={{
            fontSize: "2.25rem",
            background: "none",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            color: star <= (hover || 0) ? "#D4B896" : "var(--border)",
            transition: "color 0.1s ease, transform 0.1s ease",
            transform: star <= hover ? "scale(1.18)" : "scale(1)",
            padding: "0.1rem 0.2rem",
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RepCardsTab() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [todayCard,        setTodayCard]        = useState<RepCard | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [completions,      setCompletions]      = useState<RepCompletion[]>([]);
  const [redrawn,          setRedrawn]          = useState(false);
  const [phase,            setPhase]            = useState<Phase>("draw");

  // ── Rep flow state ────────────────────────────────────────────────────────
  const [beforeScore, setBeforeScore] = useState(5);
  const [afterScore,  setAfterScore]  = useState(5);
  const [note,        setNote]        = useState("");
  const [ratingGiven, setRatingGiven] = useState<number | null>(null);

  // ── Custom card form ──────────────────────────────────────────────────────
  const [addingCustom,      setAddingCustom]      = useState(false);
  const [customTitle,       setCustomTitle]       = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [customTier,        setCustomTier]        = useState<TierKey>(1);
  const [customSaving,      setCustomSaving]      = useState(false);
  const [customSaved,       setCustomSaved]       = useState(false);

  // ── Async loading flags ───────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(true);
  const [redrawing, setRedrawing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [rating,    setRating]    = useState(false);

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch("/api/felt-safety/rep-cards/draw").then(r => r.json()),
      fetch("/api/felt-safety/rep-cards/completions")
        .then(r => r.ok ? r.json() : { completions: [] })
        .catch(() => ({ completions: [] })),
    ])
      .then(([drawData, compData]) => {
        const card: RepCard | null = drawData.card ?? null;
        const allCompletions: RepCompletion[] = compData.completions ?? [];

        setTodayCard(card);
        setRedrawn(!!drawData.redrawn);
        setCompletions(allCompletions);

        if (drawData.alreadyDrawn && card) {
          const alreadyDone = allCompletions.some(
            c => c.cardId === card.id && c.completedAt.startsWith(todayStr)
          );
          if (alreadyDone) {
            setAlreadyCompleted(true);
            setPhase("done");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Redraw ────────────────────────────────────────────────────────────────
  const handleRedraw = useCallback(async () => {
    setRedrawing(true);
    try {
      const res = await fetch("/api/felt-safety/rep-cards/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redraw" }),
      });
      const data = await res.json();
      if (data.card) {
        setTodayCard(data.card);
        setRedrawn(true);
        setPhase("draw");
      }
    } catch {/* swallow */} finally {
      setRedrawing(false);
    }
  }, []);

  // ── Log completion ────────────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (!todayCard) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/felt-safety/rep-cards/${todayCard.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beforeScore,
          afterScore,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (data.completion) {
        setCompletions(prev => [data.completion, ...prev]);
      }
      setPhase("rate");
    } catch {/* swallow */} finally {
      setSaving(false);
    }
  }, [todayCard, beforeScore, afterScore, note]);

  // ── Rate card ─────────────────────────────────────────────────────────────
  const handleRate = useCallback(async (stars: number) => {
    if (!todayCard || rating) return;
    setRating(true);
    setRatingGiven(stars);
    try {
      await fetch(`/api/felt-safety/rep-cards/${todayCard.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars }),
      });
      setPhase("done");
    } catch {/* swallow */} finally {
      setRating(false);
    }
  }, [todayCard, rating]);

  // ── Add custom card ───────────────────────────────────────────────────────
  const handleAddCustom = useCallback(async () => {
    if (!customTitle.trim() || !customInstruction.trim() || customSaving) return;
    setCustomSaving(true);
    try {
      const res = await fetch("/api/felt-safety/rep-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       customTitle.trim(),
          instruction: customInstruction.trim(),
          tier:        customTier,
        }),
      });
      if (res.ok) {
        setCustomSaved(true);
        setCustomTitle("");
        setCustomInstruction("");
        setCustomTier(1);
        setTimeout(() => {
          setCustomSaved(false);
          setAddingCustom(false);
        }, 1600);
      }
    } catch {/* swallow */} finally {
      setCustomSaving(false);
    }
  }, [customTitle, customInstruction, customTier, customSaving]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const delta      = beforeScore - afterScore;
  const chartData  = buildDeltaChart(completions);
  const hasHistory = completions.length > 0;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <style>{`@keyframes fs-spin { to { transform: rotate(360deg); } }`}</style>
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--purple)",
            animation: "fs-spin 0.75s linear infinite",
            margin: "0 auto 1.1rem",
          }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Drawing today's rep…</p>
        </div>
      </div>
    );
  }

  // ── No card available ─────────────────────────────────────────────────────
  if (!todayCard) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>🃏</p>
          <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.3rem" }}>No card available today</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Log twitches to unlock higher tiers and more cards.
          </p>
        </div>
      </div>
    );
  }

  const cfg = tierCfg(todayCard.tier);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 className="font-serif" style={{ fontSize: "1.8rem", color: "var(--text)", lineHeight: 1.1, marginBottom: "0.3rem" }}>
            Rep Cards
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            One card per day. Do the rep. Track the shift.
          </p>
        </div>
        <button
          onClick={() => setAddingCustom(v => !v)}
          style={{
            padding: "0.6rem 1.1rem",
            borderRadius: "12px",
            border: addingCustom ? "none" : "1.5px solid var(--border)",
            background: addingCustom ? "var(--purple)" : "var(--surface)",
            color:      addingCustom ? "#fff" : "var(--text-muted)",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {addingCustom ? "Cancel" : "+ Custom card"}
        </button>
      </div>

      {/* ── Custom card form ────────────────────────────────────────────────── */}
      {addingCustom && (
        <div className="card animate-slide-up" style={{ padding: "1.5rem" }}>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Add a custom rep card
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <input
              type="text"
              placeholder="Card title (e.g. The 30-Minute Hold)"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              style={{
                width: "100%", padding: "0.65rem 0.85rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)", fontSize: "0.9rem",
                outline: "none", fontFamily: "inherit",
              }}
            />
            <textarea
              placeholder="Instruction — exactly what does the person do?"
              value={customInstruction}
              onChange={e => setCustomInstruction(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "0.65rem 0.85rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)", fontSize: "0.9rem",
                outline: "none", fontFamily: "inherit",
                resize: "none",
              }}
            />

            {/* Tier picker */}
            <div>
              <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Tier
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {([1, 2, 3] as TierKey[]).map(t => {
                  const c = TIER_CFG[t];
                  const active = customTier === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setCustomTier(t)}
                      style={{
                        flex: 1,
                        padding: "0.6rem 0.4rem",
                        borderRadius: "10px",
                        border: active ? `2px solid ${c.color}` : "2px solid var(--border)",
                        background: active ? c.bg : "var(--surface2)",
                        color:  active ? c.color : "var(--text-muted)",
                        fontSize: "0.8rem",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {c.label} · {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleAddCustom}
              disabled={!customTitle.trim() || !customInstruction.trim() || customSaving || customSaved}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "12px",
                border: "none",
                background: customSaved
                  ? "linear-gradient(135deg, #71816D, #4A6741)"
                  : !customTitle.trim() || !customInstruction.trim() || customSaving
                    ? "rgba(124,92,252,0.12)"
                    : "linear-gradient(135deg, var(--purple), var(--pink))",
                color: (!customTitle.trim() || !customInstruction.trim() || customSaving) && !customSaved
                  ? "rgba(124,92,252,0.35)"
                  : "#fff",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: !customTitle.trim() || !customInstruction.trim() || customSaving || customSaved
                  ? "not-allowed"
                  : "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.02em",
              }}
            >
              {customSaved ? "Card added ✓" : customSaving ? "Saving…" : "Save card"}
            </button>
          </div>
        </div>
      )}

      {/* ── Today's card ─────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: "2rem",
          position: "relative",
          background: "linear-gradient(160deg, var(--surface) 0%, var(--surface2) 100%)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(124,92,252,0.07), 0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Tier badge — top right */}
        <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem" }}>
          <TierBadge tier={todayCard.tier} />
        </div>

        {/* Category pill */}
        <p style={{
          fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.45rem",
        }}>
          Today's rep · {todayCard.category}
        </p>

        {/* Title */}
        <h3
          className="font-serif"
          style={{
            fontSize: "1.55rem",
            color: "var(--text)",
            lineHeight: 1.2,
            marginBottom: "1.5rem",
            paddingRight: "7rem",
          }}
        >
          {todayCard.title}
        </h3>

        {/* ── PHASE: draw ───────────────────────────────────────────────────── */}
        {phase === "draw" && (
          <div className="animate-fade-in">
            <div style={{
              background: "var(--bg)",
              borderRadius: "0.85rem",
              padding: "1.1rem 1.35rem",
              marginBottom: "1.5rem",
              borderLeft: `3px solid ${cfg.color}`,
            }}>
              <p style={{ fontSize: "1rem", color: "var(--text)", lineHeight: 1.7 }}>
                {todayCard.instruction}
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setPhase("before")}
                style={{
                  flex: 1,
                  padding: "0.9rem 1.5rem",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #71816D, #4A6741)",
                  color: "#fff",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  boxShadow: "0 4px 14px rgba(74,103,65,0.28)",
                }}
              >
                Accept this rep →
              </button>
              {!redrawn && (
                <button
                  onClick={handleRedraw}
                  disabled={redrawing}
                  style={{
                    padding: "0.9rem 1.1rem",
                    borderRadius: "12px",
                    border: "1.5px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: redrawing ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    opacity: redrawing ? 0.6 : 1,
                  }}
                >
                  {redrawing ? "Drawing…" : "Redraw ↻"}
                </button>
              )}
            </div>

            {redrawn && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "0.65rem", fontStyle: "italic" }}>
                You've used your one redraw for today. This is the one.
              </p>
            )}
          </div>
        )}

        {/* ── PHASE: before ─────────────────────────────────────────────────── */}
        {phase === "before" && (
          <div className="animate-slide-up">
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              Before you start — rate your current anxiety so we can measure the shift.
            </p>
            <ScoreSlider
              value={beforeScore}
              onChange={setBeforeScore}
              label="Current anxiety level"
            />
            <button
              onClick={() => setPhase("complete")}
              style={{
                width: "100%",
                padding: "0.9rem",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #71816D, #4A6741)",
                color: "#fff",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "1.5rem",
                boxShadow: "0 4px 14px rgba(74,103,65,0.25)",
                letterSpacing: "0.01em",
              }}
            >
              Start the rep →
            </button>
          </div>
        )}

        {/* ── PHASE: complete ───────────────────────────────────────────────── */}
        {phase === "complete" && (
          <div className="animate-slide-up">
            {/* Card instruction reminder */}
            <div style={{
              background: "var(--bg)",
              borderRadius: "0.85rem",
              padding: "1rem 1.3rem",
              marginBottom: "1.5rem",
              borderLeft: `3px solid ${cfg.color}`,
            }}>
              <p style={{ fontSize: "0.92rem", color: "var(--text)", lineHeight: 1.65 }}>
                {todayCard.instruction}
              </p>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              How are you feeling now?
            </p>

            <ScoreSlider
              value={afterScore}
              onChange={setAfterScore}
              label="Anxiety after the rep"
            />

            <textarea
              placeholder="Note (optional) — what came up for you?"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
                fontSize: "0.85rem",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                marginTop: "1.1rem",
              }}
            />

            <button
              onClick={handleComplete}
              disabled={saving}
              style={{
                width: "100%",
                padding: "0.9rem",
                borderRadius: "12px",
                border: "none",
                background: saving
                  ? "rgba(74,103,65,0.22)"
                  : "linear-gradient(135deg, #71816D, #4A6741)",
                color: saving ? "rgba(74,103,65,0.45)" : "#fff",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                marginTop: "1rem",
                letterSpacing: "0.01em",
                transition: "all 0.15s ease",
              }}
            >
              {saving ? "Logging…" : "Log completion →"}
            </button>
          </div>
        )}

        {/* ── PHASE: rate ───────────────────────────────────────────────────── */}
        {phase === "rate" && (
          <div className="animate-slide-up" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Rep logged
            </p>
            <p style={{ fontSize: "1rem", color: "var(--text)", fontWeight: 600, marginBottom: "1.5rem", lineHeight: 1.4 }}>
              How useful was this card?
            </p>
            <StarRow onRate={handleRate} disabled={rating} />
            {rating && (
              <p style={{ fontSize: "0.78rem", color: "var(--text-light)", marginTop: "1rem" }}>Saving…</p>
            )}
          </div>
        )}

        {/* ── PHASE: done ───────────────────────────────────────────────────── */}
        {phase === "done" && (
          <div className="animate-slide-up">
            {alreadyCompleted ? (
              <div style={{
                background: "rgba(113,129,109,0.1)",
                borderRadius: "1rem",
                padding: "1.25rem 1.5rem",
                border: "1px solid rgba(113,129,109,0.22)",
              }}>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#4A6741", marginBottom: "0.25rem" }}>
                  Today's rep is already logged.
                </p>
                <p style={{ fontSize: "0.82rem", color: "#71816D" }}>
                  Come back tomorrow for a new card.
                </p>
              </div>
            ) : (
              <div style={{
                display: "flex",
                gap: "1.25rem",
                alignItems: "center",
                background: delta > 0
                  ? "linear-gradient(135deg, rgba(113,129,109,0.13), rgba(74,103,65,0.07))"
                  : delta === 0
                    ? "rgba(212,184,150,0.11)"
                    : "rgba(218,102,123,0.07)",
                borderRadius: "1rem",
                padding: "1.35rem 1.5rem",
                border: `1px solid ${
                  delta > 0
                    ? "rgba(113,129,109,0.28)"
                    : delta === 0
                      ? "rgba(212,184,150,0.3)"
                      : "rgba(218,102,123,0.2)"
                }`,
              }}>
                {/* Delta number */}
                <div style={{ flexShrink: 0, textAlign: "center" }}>
                  <p style={{
                    fontSize: "3.2rem",
                    fontWeight: 900,
                    lineHeight: 1,
                    color: delta > 0 ? "#4A6741" : delta === 0 ? "#8B7355" : "#DA667B",
                  }}>
                    {delta > 0 ? `−${delta}` : delta < 0 ? `+${Math.abs(delta)}` : "0"}
                  </p>
                  <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem", letterSpacing: "0.04em" }}>
                    points
                  </p>
                </div>

                {/* Message */}
                <div>
                  <p style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.35, marginBottom: "0.3rem" }}>
                    {delta > 3
                      ? `Your anxiety dropped ${delta} points — that's the proof.`
                      : delta > 0
                        ? "A little lighter. The rep is working."
                        : delta === 0
                          ? "Steady. The practice still counts."
                          : "It went up. The nervous system is still learning."}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {beforeScore} → {afterScore} anxiety
                    {ratingGiven !== null ? ` · ${ratingGiven}★` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 30-day anxiety shift chart ──────────────────────────────────────── */}
      {(phase === "done" || hasHistory) && (
        <div className="card animate-slide-up" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Anxiety shift — 30 days
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-light)", marginTop: "0.15rem" }}>
                Shrinking gap between lines = nervous system rewiring.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", color: "#DA667B", fontWeight: 600 }}>
                <span style={{ width: "16px", height: "2.5px", background: "#DA667B", display: "inline-block", borderRadius: "2px" }} />
                Before
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", color: "#71816D", fontWeight: 600 }}>
                <span style={{ width: "16px", height: "2.5px", background: "#71816D", display: "inline-block", borderRadius: "2px" }} />
                After
              </span>
            </div>
          </div>

          {hasHistory ? (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "300px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.08)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-light)" }}
                      interval={6}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-light)" }}
                      domain={[0, 10]}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(v: number, name: string) => [v, name === "before" ? "Before" : "After"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="before"
                      stroke="#DA667B"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#DA667B" }}
                      connectNulls={false}
                      name="before"
                    />
                    <Line
                      type="monotone"
                      dataKey="after"
                      stroke="#71816D"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#71816D" }}
                      connectNulls={false}
                      name="after"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{
              height: "120px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg)",
              borderRadius: "0.75rem",
            }}>
              <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
                Complete a rep to start tracking your anxiety shift.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
