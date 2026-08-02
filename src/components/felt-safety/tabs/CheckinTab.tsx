"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Checkin {
  id: string;
  userId: string;
  answer: string;
  dayRating: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_RATINGS = [
  { key: "stormy", label: "Stormy", emoji: "🌩️", color: "#DA667B", bg: "rgba(218,102,123,0.08)", border: "rgba(218,102,123,0.42)" },
  { key: "choppy", label: "Choppy", emoji: "🌊",  color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.42)"  },
  { key: "steady", label: "Steady", emoji: "⛵",  color: "#7C5CFC", bg: "rgba(124,92,252,0.08)",  border: "rgba(124,92,252,0.42)"  },
  { key: "calm",   label: "Calm",   emoji: "🌅",  color: "#71816D", bg: "rgba(113,129,109,0.08)", border: "rgba(113,129,109,0.42)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateKey(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-CA");
}

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function calcStreak(checkins: Checkin[]): number {
  const days = new Set(checkins.map(c => toLocalDateKey(c.createdAt)));
  let count = 0;
  const ref = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    if (days.has(d.toLocaleDateString("en-CA"))) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getRatingMeta(key: string) {
  return DAY_RATINGS.find(r => r.key === key) ?? DAY_RATINGS[2];
}

function formatDisplayDate(isoString: string): string {
  const localDate = toLocalDateKey(isoString);
  if (localDate === todayKey()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDate === yesterday.toLocaleDateString("en-CA")) return "Yesterday";
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Section Label ────────────────────────────────────────────────────────────

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

// ─── Streak Banner ────────────────────────────────────────────────────────────

function StreakBanner({ streak }: { streak: number }) {
  if (streak === 0) return null;

  const msg =
    streak === 1  ? "A good start. Keep showing up." :
    streak < 7    ? "You're building something real." :
    streak < 14   ? "A full week of honest presence." :
    streak < 30   ? "This is a practice now." :
                    "This is becoming who you are.";

  return (
    <div className="card" style={{
      padding: "1.1rem 1.5rem",
      background: "linear-gradient(135deg, rgba(113,129,109,0.1) 0%, rgba(74,103,65,0.05) 100%)",
      border: "1px solid rgba(113,129,109,0.22)",
      display: "flex",
      alignItems: "center",
      gap: "1.25rem",
    }}>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <p style={{
          fontSize: "2.5rem",
          fontWeight: 900,
          color: "#4A6741",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          {streak}
        </p>
        <p style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#71816D",
          marginTop: "0.15rem",
        }}>
          day streak
        </p>
      </div>
      <div style={{
        width: "1px",
        height: "2.5rem",
        background: "rgba(113,129,109,0.25)",
        flexShrink: 0,
      }} />
      <p style={{ fontSize: "0.85rem", color: "#71816D", lineHeight: 1.55, fontWeight: 500 }}>
        {msg}
      </p>
    </div>
  );
}

// ─── Completed-today card ─────────────────────────────────────────────────────

function CompletedTodayCard({ checkin }: { checkin: Checkin }) {
  const rating = getRatingMeta(checkin.dayRating);
  return (
    <div className="card animate-fade-in" style={{
      padding: "1.75rem 2rem",
      background: `linear-gradient(135deg, ${rating.bg} 0%, var(--surface) 100%)`,
      border: `1.5px solid ${rating.border}`,
      display: "flex",
      flexDirection: "column",
      gap: "1.25rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1.85rem", lineHeight: 1 }}>{rating.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: rating.color,
            marginBottom: "0.1rem",
          }}>
            {rating.label} day &middot; checked in
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
            {formatTime(checkin.createdAt)}
          </p>
        </div>
      </div>

      <p style={{
        fontSize: "0.95rem",
        color: "var(--text)",
        lineHeight: 1.72,
        fontStyle: "italic",
        borderLeft: `3px solid ${rating.border}`,
        paddingLeft: "1rem",
        margin: 0,
      }}>
        {checkin.answer}
      </p>

      <p style={{
        fontSize: "0.82rem",
        color: "var(--text-muted)",
        textAlign: "center",
        paddingTop: "0.75rem",
        borderTop: "1px solid var(--border)",
        letterSpacing: "0.015em",
        margin: 0,
      }}>
        See you tomorrow.
      </p>
    </div>
  );
}

// ─── Digest entry card ────────────────────────────────────────────────────────

function DigestCard({ checkin }: { checkin: Checkin }) {
  const rating = getRatingMeta(checkin.dayRating);
  return (
    <div className="card animate-slide-up" style={{
      padding: "1rem 1.25rem",
      borderLeft: `3px solid ${rating.border}`,
      display: "flex",
      flexDirection: "column",
      gap: "0.55rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.05rem", lineHeight: 1, flexShrink: 0 }}>{rating.emoji}</span>
        <span style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: rating.color,
        }}>
          {rating.label}
        </span>
        <span style={{
          fontSize: "0.72rem",
          color: "var(--text-light)",
          marginLeft: "auto",
          flexShrink: 0,
        }}>
          {formatDisplayDate(checkin.createdAt)}
        </span>
      </div>
      <p style={{
        fontSize: "0.88rem",
        color: "var(--text)",
        lineHeight: 1.62,
        paddingLeft: "1.65rem",
        margin: 0,
      }}>
        {checkin.answer}
      </p>
    </div>
  );
}

// ─── Empty digest ─────────────────────────────────────────────────────────────

function EmptyDigest() {
  return (
    <div className="card" style={{ padding: "1.75rem", textAlign: "center" }}>
      <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🌿</p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: 500 }}>
        No check-ins yet.
      </p>
      <p style={{ color: "var(--text-light)", fontSize: "0.78rem", marginTop: "0.2rem" }}>
        Today can be the first entry.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckinTab() {
  const [checkins,   setCheckins]   = useState<Checkin[]>([]);
  const [answer,     setAnswer]     = useState("");
  const [dayRating,  setDayRating]  = useState("");
  const [submitted,  setSubmitted]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const today         = todayKey();
  const todayCheckin  = checkins.find(c => toLocalDateKey(c.createdAt) === today) ?? null;
  const streak        = calcStreak(checkins);
  const isDoneToday   = !!(todayCheckin || submitted);

  // One entry per day, newest first, up to 7 unique days
  const digestMap = new Map<string, Checkin>();
  for (const c of [...checkins].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )) {
    const key = toLocalDateKey(c.createdAt);
    if (!digestMap.has(key)) digestMap.set(key, c);
    if (digestMap.size >= 7) break;
  }
  const digestList = Array.from(digestMap.values());

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/felt-safety/checkins")
      .then(r => r.json())
      .then(d => setCheckins(d.checkins ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const trimmed = answer.trim();
    if (!trimmed || !dayRating || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/felt-safety/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: trimmed, dayRating }),
      });
      const data = await res.json();
      if (data.checkin) {
        setCheckins(prev => [data.checkin, ...prev]);
      }
      setSubmitted(true);
      setAnswer("");
      setDayRating("");
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }, [answer, dayRating, submitting]);

  const canSubmit = answer.trim().length > 0 && dayRating !== "" && !submitting;

  // ── Render ─────────────────────────────────────────────────────────────────

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
          Daily Check-In
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          One honest minute at the end of the day. No wrong answers.
        </p>
      </div>

      {/* Streak */}
      {!loading && <StreakBanner streak={streak} />}

      {/* Loading */}
      {loading && (
        <div className="card" style={{
          padding: "2.5rem",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.88rem",
        }}>
          Loading…
        </div>
      )}

      {/* Completed today */}
      {!loading && todayCheckin && (
        <CompletedTodayCard checkin={todayCheckin} />
      )}

      {/* Submitted but todayCheckin not yet in state (edge case) */}
      {!loading && submitted && !todayCheckin && (
        <div className="card animate-fade-in" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>🌅</p>
          <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.25rem" }}>
            Check-in logged.
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            See you tomorrow.
          </p>
        </div>
      )}

      {/* Journal form — only when not done */}
      {!loading && !isDoneToday && (
        <div className="card" style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          background: "linear-gradient(160deg, var(--surface) 0%, var(--surface2) 100%)",
        }}>

          {/* Prompt + textarea */}
          <div>
            <p style={{
              fontSize: "1.05rem",
              color: "var(--text)",
              fontWeight: 600,
              lineHeight: 1.55,
              fontStyle: "italic",
              marginBottom: "1rem",
            }}>
              &ldquo;Where did you feel unsafe today, and what did you do about it?&rdquo;
            </p>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Take your time. Write honestly…"
              rows={5}
              style={{
                width: "100%",
                padding: "1rem 1.1rem",
                borderRadius: "14px",
                border: "1.5px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: "0.93rem",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.72,
                transition: "border-color 0.15s ease",
                boxSizing: "border-box",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(124,92,252,0.42)"; }}
              onBlur={e =>  { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <p style={{ fontSize: "0.7rem", color: "var(--text-light)", marginTop: "0.45rem" }}>
              This is private. No judgement, no score.
            </p>
          </div>

          {/* Day rating */}
          <div>
            <p style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "0.75rem",
            }}>
              How was today overall?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
              {DAY_RATINGS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setDayRating(dayRating === r.key ? "" : r.key)}
                  style={{
                    padding: "0.8rem 0.4rem",
                    borderRadius: "12px",
                    border: dayRating === r.key
                      ? `2px solid ${r.border}`
                      : "2px solid transparent",
                    background: dayRating === r.key ? r.bg : "var(--bg)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.38rem",
                    transition: "all 0.14s ease",
                    outline: "none",
                  }}
                >
                  <span style={{ fontSize: "1.45rem", lineHeight: 1 }}>{r.emoji}</span>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: dayRating === r.key ? 700 : 500,
                    color: dayRating === r.key ? r.color : "var(--text-muted)",
                    letterSpacing: "0.015em",
                  }}>
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "0.9rem",
              borderRadius: "14px",
              border: "none",
              background: canSubmit
                ? "linear-gradient(135deg, #7C5CFC 0%, #E879F9 100%)"
                : "rgba(124,92,252,0.12)",
              color: canSubmit ? "#fff" : "rgba(124,92,252,0.38)",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
              boxShadow: canSubmit ? "0 4px 18px rgba(124,92,252,0.3)" : "none",
            }}
          >
            {submitting ? "Logging…" : "Log check-in"}
          </button>

        </div>
      )}

      {/* Weekly digest — always visible */}
      <section>
        <SectionLabel>Last 7 days</SectionLabel>
        {loading ? (
          <div className="card" style={{
            padding: "1.5rem",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}>
            Loading…
          </div>
        ) : digestList.length === 0 ? (
          <EmptyDigest />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {digestList.map(c => (
              <DigestCard key={c.id} checkin={c} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
