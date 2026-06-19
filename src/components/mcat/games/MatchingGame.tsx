"use client";

import { useState, useEffect } from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { Flashcard } from "@/types/dashboard";

interface Tile {
  id: string;
  pairId: string;
  text: string;
  type: "term" | "def";
}

interface Props {
  cards: Flashcard[];
  onDone: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchingGame({ cards, onDone }: Props) {
  const pairs = cards.slice(0, 6);
  const [tiles, setTiles] = useState<Tile[]>(() =>
    shuffle(pairs.flatMap(c => [
      { id: `t-${c.id}`, pairId: c.id, text: c.front, type: "term" as const },
      { id: `d-${c.id}`, pairId: c.id, text: c.back,  type: "def"  as const },
    ]))
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched]   = useState<Set<string>>(new Set());
  const [wrong, setWrong]       = useState<string | null>(null);
  const [seconds, setSeconds]   = useState(0);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (matched.size === pairs.length && pairs.length > 0) setDone(true);
  }, [matched, pairs.length]);

  function handleClick(tile: Tile) {
    if (matched.has(tile.pairId) || tile.id === selected || done) return;
    if (!selected) {
      setSelected(tile.id);
      return;
    }
    const selTile = tiles.find(t => t.id === selected);
    if (!selTile) { setSelected(tile.id); return; }

    if (selTile.pairId === tile.pairId) {
      setMatched(prev => new Set(Array.from(prev).concat(tile.pairId)));
      setSelected(null);
    } else {
      setWrong(tile.id);
      setTimeout(() => { setWrong(null); setSelected(null); }, 600);
    }
  }

  function restart() {
    const newPairs = cards.slice(0, 6);
    setTiles(shuffle(newPairs.flatMap(c => [
      { id: `t-${c.id}`, pairId: c.id, text: c.front, type: "term" as const },
      { id: `d-${c.id}`, pairId: c.id, text: c.back,  type: "def"  as const },
    ])));
    setSelected(null);
    setMatched(new Set());
    setWrong(null);
    setSeconds(0);
    setDone(false);
  }

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  if (cards.length < 2) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--text-muted)" }}>Need at least 2 flashcards to play!</p>
        <button onClick={onDone} style={backBtn}>Back</button>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Trophy size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>All Matched!</h2>
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 24 }}>Finished in {fmt(seconds)}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={restart} style={{ ...actionBtn, background: "var(--grad)", color: "#fff", border: "none" }}>
            <RotateCcw size={14} /> Play Again
          </button>
          <button onClick={onDone} style={backBtn}>Back to Games</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13, color: "var(--text-muted)" }}>
        <span>{matched.size} / {pairs.length} matched</span>
        <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{fmt(seconds)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {tiles.map(tile => {
          const isMatched  = matched.has(tile.pairId);
          const isSelected = selected === tile.id;
          const isWrong    = wrong === tile.id || (wrong !== null && selected === tile.id);
          return (
            <button
              key={tile.id}
              onClick={() => handleClick(tile)}
              style={{
                padding: "14px 10px",
                borderRadius: 12,
                border: `2px solid ${isMatched ? "var(--green)" : isWrong ? "var(--red)" : isSelected ? "var(--purple)" : "var(--border)"}`,
                background: isMatched ? "rgba(16,185,129,0.08)" : isWrong ? "rgba(239,68,68,0.08)" : isSelected ? "rgba(124,92,252,0.1)" : "var(--surface)",
                color: isMatched ? "var(--green)" : "var(--text)",
                cursor: isMatched ? "default" : "pointer",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                lineHeight: 1.4,
                minHeight: 70,
                textAlign: "center" as const,
                transition: "all 0.15s",
                opacity: isMatched ? 0.6 : 1,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: isMatched ? "var(--green)" : "var(--text-muted)", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                {tile.type === "term" ? "TERM" : "DEF"}
              </div>
              {tile.text.length > 60 ? tile.text.slice(0, 57) + "…" : tile.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "10px 20px", borderRadius: 12, border: "2px solid",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 8,
};
const backBtn: React.CSSProperties = {
  padding: "10px 20px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "var(--surface)",
  color: "var(--text-muted)", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
