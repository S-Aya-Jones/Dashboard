"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mantra {
  id: string;
  text: string;
  faithFlag: boolean;
  custom: boolean;
  active: boolean;
}

// ─── MantrasTab ───────────────────────────────────────────────────────────────

export function MantrasTab() {
  const [mantras,    setMantras]    = useState<Mantra[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [faithMode,  setFaithMode]  = useState(false);
  const [newText,    setNewText]    = useState("");
  const [newFaith,   setNewFaith]   = useState(false);
  const [adding,     setAdding]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const filtered = mantras.filter(m => faithMode ? m.faithFlag : !m.faithFlag);

  const fetchMantras = useCallback(async () => {
    try {
      const res  = await fetch("/api/felt-safety/mantras");
      const data = await res.json();
      setMantras(data.mantras ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMantras(); }, [fetchMantras]);

  // Rotate current mantra every 10 seconds in the display
  useEffect(() => {
    if (filtered.length === 0) return;
    const t = setInterval(() => {
      setCurrentIdx(i => (i + 1) % filtered.length);
    }, 10_000);
    return () => clearInterval(t);
  }, [filtered.length]);

  // Reset index when faith mode changes
  useEffect(() => { setCurrentIdx(0); }, [faithMode]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/felt-safety/mantras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText.trim(), faithFlag: newFaith }),
      });
      const data = await res.json();
      setMantras(prev => [...prev, data.mantra]);
      setNewText("");
      setNewFaith(false);
      setShowForm(false);
    } catch { /* ignore */ }
    finally { setAdding(false); }
  };

  const currentMantra = filtered[currentIdx] ?? filtered[0];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Faith mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 className="font-serif" style={{ fontSize: "1.5rem", color: "var(--text)", margin: 0 }}>Mantras</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0.2rem 0 0" }}>Words that anchor instead of instruct.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "0.8rem", color: faithMode ? "var(--text-muted)" : "var(--text)", fontWeight: faithMode ? 400 : 600 }}>
            Neutral
          </span>
          <button
            onClick={() => setFaithMode(f => !f)}
            style={{
              position: "relative",
              width: 44, height: 24,
              borderRadius: 12,
              border: "none",
              background: faithMode ? "#7C5CFC" : "var(--border)",
              cursor: "pointer",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
            aria-label="Toggle faith mode"
          >
            <span style={{
              position: "absolute",
              top: 3, left: faithMode ? 23 : 3,
              width: 18, height: 18,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
          <span style={{ fontSize: "0.8rem", color: faithMode ? "var(--text)" : "var(--text-muted)", fontWeight: faithMode ? 600 : 400 }}>
            Faith
          </span>
        </div>
      </div>

      {/* Current mantra display */}
      {!loading && currentMantra && (
        <div style={{
          background: faithMode
            ? "linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(218,102,123,0.06) 100%)"
            : "linear-gradient(135deg, rgba(113,129,109,0.08) 0%, rgba(212,184,150,0.06) 100%)",
          borderRadius: "18px",
          padding: "2.5rem 2rem",
          textAlign: "center",
          border: `1px solid ${faithMode ? "rgba(124,92,252,0.18)" : "rgba(113,129,109,0.18)"}`,
          position: "relative",
          overflow: "hidden",
        }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1rem" }}>
            {faithMode ? "Faith mode" : "Neutral mode"} · rotating
          </p>
          <blockquote style={{
            fontFamily: "Georgia, 'Cormorant Garamond', serif",
            fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
            fontWeight: 400,
            color: "var(--text)",
            lineHeight: 1.5,
            margin: "0 0 1.25rem",
            fontStyle: "italic",
          }}>
            &ldquo;{currentMantra.text}&rdquo;
          </blockquote>
          {filtered.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
              {filtered.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  style={{
                    width: i === currentIdx ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    border: "none",
                    background: i === currentIdx ? (faithMode ? "#7C5CFC" : "#71816D") : "var(--border)",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all 0.2s",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Twilio webhook info */}
      <div className="card" style={{ padding: "1.25rem", background: "rgba(124,92,252,0.04)" }}>
        <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          SMS / Twilio
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 0.5rem" }}>
          Your Twilio SMS webhook can pull the current mantra at:
        </p>
        <code style={{
          display: "block",
          fontSize: "0.75rem",
          color: "var(--purple)",
          background: "var(--bg)",
          padding: "0.5rem 0.75rem",
          borderRadius: "8px",
          fontFamily: "monospace",
          wordBreak: "break-all",
        }}>
          GET /api/felt-safety/mantras/current?faith=true
        </code>
        <p style={{ fontSize: "0.75rem", color: "var(--text-light)", marginTop: "0.4rem", margin: "0.4rem 0 0" }}>
          Omit <code>?faith</code> for all mantras. Rotates hourly.
        </p>
      </div>

      {/* Mantra list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: 0 }}>
            {faithMode ? "Faith mantras" : "Neutral mantras"} ({filtered.length})
          </p>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--purple)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
            }}
          >
            {showForm ? "Cancel" : "+ Add mantra"}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ padding: "1.25rem", marginBottom: "0.75rem", border: "1.5px solid rgba(124,92,252,0.2)" }}>
            <textarea
              placeholder="Write a mantra that grounds you…"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "0.6rem 0.75rem",
                borderRadius: "10px",
                border: "1.5px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)", fontSize: "0.9rem",
                resize: "none", outline: "none",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
                lineHeight: 1.6,
                marginBottom: "0.75rem",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-muted)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newFaith}
                  onChange={e => setNewFaith(e.target.checked)}
                  style={{ accentColor: "var(--purple)" }}
                />
                Faith mantra
              </label>
              <button
                onClick={handleAdd}
                disabled={!newText.trim() || adding}
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: "10px",
                  border: "none",
                  background: !newText.trim() || adding ? "rgba(124,92,252,0.2)" : "var(--purple)",
                  color: !newText.trim() || adding ? "rgba(124,92,252,0.4)" : "#fff",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: !newText.trim() || adding ? "not-allowed" : "pointer",
                }}
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✨</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
              No {faithMode ? "faith" : "neutral"} mantras yet. Add one above.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {filtered.map((m, i) => (
              <div key={m.id} className="card" style={{
                padding: "1rem 1.25rem",
                borderLeft: `3px solid ${i === currentIdx ? (faithMode ? "#7C5CFC" : "#71816D") : "transparent"}`,
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
              onClick={() => setCurrentIdx(i)}
              >
                <p style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "0.95rem",
                  fontStyle: "italic",
                  color: "var(--text)",
                  lineHeight: 1.55,
                  margin: "0 0 0.4rem",
                }}>
                  &ldquo;{m.text}&rdquo;
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {m.custom && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                      borderRadius: "20px",
                      background: "rgba(124,92,252,0.1)",
                      color: "var(--purple)",
                    }}>custom</span>
                  )}
                  {m.faithFlag && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                      borderRadius: "20px",
                      background: "rgba(218,102,123,0.1)",
                      color: "#DA667B",
                    }}>faith</span>
                  )}
                  {i === currentIdx && (
                    <span style={{ fontSize: "0.68rem", color: "var(--text-light)" }}>→ showing now</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
