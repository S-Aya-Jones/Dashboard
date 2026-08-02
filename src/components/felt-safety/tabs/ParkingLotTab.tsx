"use client";

import { useState, useEffect, useCallback, type ReactNode, type KeyboardEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParkingLotEntry {
  id: string;
  userId: string;
  content: string;
  decision?: "raise" | "let_go";
  decidedAt?: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCK_MS = 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isReady(entry: ParkingLotEntry): boolean {
  return new Date(entry.createdAt).getTime() + LOCK_MS <= Date.now();
}

function timeRemaining(entry: ParkingLotEntry): string {
  const msLeft = new Date(entry.createdAt).getTime() + LOCK_MS - Date.now();
  if (msLeft <= 0) return "Ready";
  const totalMins = Math.ceil(msLeft / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / (1000 * 60 * 60));
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(ms / 60_000);
  if (m >= 1) return `${m}m ago`;
  return "Just now";
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: "0.6rem",
    }}>
      {children}
    </p>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyParking() {
  return (
    <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
      <p style={{ fontSize: "1.75rem", marginBottom: "0.6rem" }}>🌿</p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 500 }}>
        Nothing parked yet.
      </p>
      <p style={{ color: "var(--text-light)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
        Write a grievance above instead of raising it right away.
      </p>
    </div>
  );
}

// ─── Resting entry card ───────────────────────────────────────────────────────

function RestingCard({ entry }: { entry: ParkingLotEntry }) {
  return (
    <div className="card animate-slide-up" style={{
      padding: "1rem 1.25rem",
      borderLeft: "3px solid rgba(164,147,198,0.35)",
      opacity: 0.7,
      display: "flex",
      flexDirection: "column",
      gap: "0.55rem",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
        <span style={{ fontSize: "1rem", lineHeight: 1.4, flexShrink: 0, marginTop: "0.1rem" }}>
          🔒
        </span>
        <p style={{
          fontSize: "0.88rem",
          color: "var(--text-muted)",
          lineHeight: 1.55,
          flex: 1,
          fontStyle: "italic",
        }}>
          {entry.content}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingLeft: "1.6rem" }}>
        <span style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--text-light)",
          textTransform: "uppercase",
        }}>
          Resting…
        </span>
        <span style={{
          fontSize: "0.72rem",
          color: "var(--text-light)",
          background: "rgba(164,147,198,0.12)",
          borderRadius: "99px",
          padding: "0.15rem 0.55rem",
          fontVariantNumeric: "tabular-nums",
        }}>
          {timeRemaining(entry)}
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-light)", marginLeft: "auto" }}>
          {formatAge(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Ready-to-decide entry card ───────────────────────────────────────────────

function ReadyCard({
  entry,
  onDecide,
  deciding,
}: {
  entry: ParkingLotEntry;
  onDecide: (id: string, decision: "raise" | "let_go") => void;
  deciding: boolean;
}) {
  return (
    <div className="card animate-slide-up" style={{
      padding: "1.1rem 1.25rem",
      borderLeft: "3px solid #D4B896",
      border: "1px solid rgba(212,184,150,0.55)",
      boxShadow: "0 4px 24px rgba(212,184,150,0.2)",
      display: "flex",
      flexDirection: "column",
      gap: "0.8rem",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <p style={{
          fontSize: "0.9rem",
          color: "var(--text)",
          lineHeight: 1.55,
          flex: 1,
          fontWeight: 500,
        }}>
          {entry.content}
        </p>
        <span style={{ fontSize: "0.68rem", color: "#8B7355", flexShrink: 0, marginTop: "0.15rem" }}>
          {formatAge(entry.createdAt)}
        </span>
      </div>
      <div>
        <p style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "#8B7355",
          marginBottom: "0.5rem",
          letterSpacing: "0.03em",
        }}>
          Still worth raising?
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => onDecide(entry.id, "raise")}
            disabled={deciding}
            style={{
              flex: 1,
              padding: "0.6rem 0.75rem",
              borderRadius: "10px",
              border: "1.5px solid rgba(218,102,123,0.45)",
              background: "rgba(218,102,123,0.06)",
              color: "#DA667B",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: deciding ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            Raise it
          </button>
          <button
            onClick={() => onDecide(entry.id, "let_go")}
            disabled={deciding}
            style={{
              flex: 1,
              padding: "0.6rem 0.75rem",
              borderRadius: "10px",
              border: "1.5px solid rgba(113,129,109,0.45)",
              background: "rgba(113,129,109,0.06)",
              color: "#4A6741",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: deciding ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            Let it go
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Raised entry card ────────────────────────────────────────────────────────

function RaisedCard({ entry }: { entry: ParkingLotEntry }) {
  return (
    <div className="card" style={{
      padding: "0.9rem 1.25rem",
      borderLeft: "3px solid rgba(218,102,123,0.4)",
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
    }}>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: "0.88rem",
          color: "var(--text)",
          lineHeight: 1.5,
        }}>
          {entry.content}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0 }}>
        <span style={{
          fontSize: "0.62rem",
          fontWeight: 700,
          padding: "0.18rem 0.55rem",
          borderRadius: "99px",
          background: "rgba(218,102,123,0.12)",
          color: "#DA667B",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          Raised
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-light)" }}>
          {formatAge(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Let-go entry card (with fade) ───────────────────────────────────────────

function LetGoCard({ entry, isFading }: { entry: ParkingLotEntry; isFading: boolean }) {
  return (
    <div className="card" style={{
      padding: "0.85rem 1.25rem",
      opacity: isFading ? 0 : 0.45,
      transition: "opacity 0.6s ease",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      pointerEvents: "none",
    }}>
      <p style={{
        flex: 1,
        fontSize: "0.84rem",
        color: "var(--text-muted)",
        lineHeight: 1.45,
        textDecoration: "line-through",
        textDecorationColor: "rgba(113,129,109,0.45)",
      }}>
        {entry.content}
      </p>
      <span style={{
        fontSize: "0.62rem",
        fontWeight: 700,
        padding: "0.18rem 0.55rem",
        borderRadius: "99px",
        background: "rgba(113,129,109,0.1)",
        color: "#71816D",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}>
        Released
      </span>
    </div>
  );
}

// ─── Insight metric banner ────────────────────────────────────────────────────

function InsightBanner({ letGoCount, totalDecided }: { letGoCount: number; totalDecided: number }) {
  const pct = totalDecided > 0 ? Math.round((letGoCount / totalDecided) * 100) : 0;
  const barWidth = `${pct}%`;

  return (
    <div className="card" style={{
      padding: "1rem 1.25rem",
      background: "linear-gradient(135deg, rgba(113,129,109,0.07) 0%, rgba(74,103,65,0.04) 100%)",
      border: "1px solid rgba(113,129,109,0.2)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <p style={{ fontSize: "0.78rem", color: "#71816D", fontWeight: 600 }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#4A6741", fontVariantNumeric: "tabular-nums" }}>
            {letGoCount}
          </span>
          {" "}of{" "}
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{totalDecided}</span>
          {" "}entries released
        </p>
        <span style={{ fontSize: "0.72rem", color: "#71816D", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: "4px",
        background: "rgba(113,129,109,0.15)",
        borderRadius: "99px",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: barWidth,
          background: "linear-gradient(90deg, #71816D, #4A6741)",
          borderRadius: "99px",
          transition: "width 0.6s ease",
        }} />
      </div>
      <p style={{ fontSize: "0.7rem", color: "var(--text-light)", marginTop: "0.45rem" }}>
        The grievances you chose to release, not suppress.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParkingLotTab() {
  const [entries,    setEntries]    = useState<ParkingLotEntry[]>([]);
  const [newContent, setNewContent] = useState("");
  const [fading,     setFading]     = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deciding,   setDeciding]   = useState<Set<string>>(new Set());

  // Tick every minute so time-remaining labels stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/felt-safety/parking-lot")
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePark = useCallback(async () => {
    const trimmed = newContent.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/felt-safety/parking-lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const { entry } = await res.json();
      if (entry) setEntries(prev => [entry, ...prev]);
      setNewContent("");
    } catch {
      // silently fail — no toast infrastructure in scope
    } finally {
      setSubmitting(false);
    }
  }, [newContent, submitting]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePark();
    }
  }, [handlePark]);

  const handleDecide = useCallback(async (id: string, decision: "raise" | "let_go") => {
    if (deciding.has(id)) return;
    setDeciding(prev => { const s = new Set(prev); s.add(id); return s; });

    // Optimistic UI
    if (decision === "let_go") {
      // Start fade immediately
      setFading(prev => { const s = new Set(prev); s.add(id); return s; });
      // After animation, mark in state
      setTimeout(() => {
        setEntries(prev =>
          prev.map(e => e.id === id ? { ...e, decision: "let_go" } : e)
        );
        setFading(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 600);
    } else {
      setEntries(prev =>
        prev.map(e => e.id === id ? { ...e, decision: "raise" } : e)
      );
    }

    try {
      await fetch(`/api/felt-safety/parking-lot/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch {}

    setDeciding(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [deciding]);

  // Partition
  const undecided     = entries.filter(e => !e.decision);
  const restingList   = undecided.filter(e => !isReady(e));
  const readyList     = undecided.filter(e => isReady(e));
  const raisedList    = entries.filter(e => e.decision === "raise");
  const letGoList     = entries.filter(e => e.decision === "let_go");

  const letGoCount    = letGoList.length;
  const totalDecided  = raisedList.length + letGoList.length;
  const hasAny        = entries.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h2 className="font-serif" style={{
          fontSize: "1.5rem",
          color: "var(--text)",
          lineHeight: 1.2,
          marginBottom: "0.3rem",
        }}>
          Parking Lot
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Write it here instead of raising it. Let it rest 24 hours — most grievances dissolve on their own.
        </p>
      </div>

      {/* Insight metric */}
      {totalDecided > 0 && (
        <InsightBanner letGoCount={letGoCount} totalDecided={totalDecided} />
      )}

      {/* New entry form */}
      <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          What&apos;s on your mind?
        </p>
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the grievance, frustration, or issue…"
          rows={3}
          style={{
            width: "100%",
            padding: "0.7rem 0.85rem",
            borderRadius: "12px",
            border: "1.5px solid var(--border)",
            background: "var(--surface2)",
            color: "var(--text)",
            fontSize: "0.88rem",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.55,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>
            Cmd+Enter to park
          </p>
          <button
            onClick={handlePark}
            disabled={!newContent.trim() || submitting}
            style={{
              padding: "0.65rem 1.35rem",
              borderRadius: "12px",
              border: "none",
              background: !newContent.trim() || submitting
                ? "rgba(124,92,252,0.15)"
                : "linear-gradient(135deg, #8B7355, #D4B896)",
              color: !newContent.trim() || submitting
                ? "rgba(124,92,252,0.4)"
                : "#fff",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: !newContent.trim() || submitting ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.03em",
            }}
          >
            {submitting ? "Parking…" : "Park it"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Loading…
        </div>
      )}

      {/* Empty */}
      {!loading && !hasAny && <EmptyParking />}

      {/* Ready to decide */}
      {!loading && readyList.length > 0 && (
        <section>
          <SectionLabel>Ready to decide — 24h passed</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {readyList.map(entry => (
              <ReadyCard
                key={entry.id}
                entry={entry}
                onDecide={handleDecide}
                deciding={deciding.has(entry.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resting entries */}
      {!loading && restingList.length > 0 && (
        <section>
          <SectionLabel>Resting</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {restingList.map(entry => (
              <RestingCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Raised */}
      {!loading && raisedList.length > 0 && (
        <section>
          <SectionLabel>Raised</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {raisedList.map(entry => (
              <RaisedCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Released */}
      {!loading && letGoList.length > 0 && (
        <section>
          <SectionLabel>Released</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {letGoList.map(entry => (
              <LetGoCard
                key={entry.id}
                entry={entry}
                isFading={fading.has(entry.id)}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
