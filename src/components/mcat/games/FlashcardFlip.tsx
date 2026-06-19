"use client";

import { useState } from "react";
import { Check, X, RotateCcw, Trophy } from "lucide-react";
import { Flashcard } from "@/types/dashboard";

interface Props {
  cards: Flashcard[];
  onDone: () => void;
}

export function FlashcardFlip({ cards, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  function answer(knew: boolean) {
    if (knew) setCorrect(c => c + 1);
    if (idx + 1 >= cards.length) {
      setDone(true);
    } else {
      setFlipped(false);
      setTimeout(() => setIdx(i => i + 1), 100);
    }
  }

  function restart() {
    setIdx(0);
    setFlipped(false);
    setCorrect(0);
    setDone(false);
  }

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>No flashcards available. Add some first!</p>
        <button onClick={onDone} style={backBtn}>Back to Games</button>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correct / cards.length) * 100);
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Trophy size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
          {pct >= 80 ? "Great work!" : pct >= 60 ? "Keep practicing!" : "Keep at it!"}
        </h2>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 24 }}>
          You got <strong style={{ color: "var(--green)" }}>{correct}</strong> / {cards.length} correct ({pct}%)
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={restart} style={{ ...actionBtn, background: "var(--grad)", color: "#fff", border: "none" }}>
            <RotateCcw size={15} /> Play Again
          </button>
          <button onClick={onDone} style={backBtn}>Back to Games</button>
        </div>
      </div>
    );
  }

  const card = cards[idx];
  const progress = ((idx) / cards.length) * 100;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
        <span>Card {idx + 1} of {cards.length}</span>
        <span style={{ color: "var(--green)", fontWeight: 600 }}>{correct} correct</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--border)", marginBottom: 24 }}>
        <div style={{ height: 6, borderRadius: 3, background: "var(--grad)", width: `${progress}%`, transition: "width 0.3s" }} />
      </div>

      {/* Card with flip */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        style={{
          perspective: 1000,
          cursor: flipped ? "default" : "pointer",
          marginBottom: 24,
          userSelect: "none",
        }}
      >
        <div style={{
          position: "relative",
          width: "100%",
          paddingBottom: "60%",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>
          {/* Front */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden" as const,
            background: "var(--surface)",
            border: "2px solid var(--purple)",
            borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, textAlign: "center" as const,
            boxShadow: "0 4px 24px rgba(124,92,252,0.12)",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
                {card.subject} · {card.topic}
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", lineHeight: 1.55 }}>{card.front}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>Tap to reveal answer</p>
            </div>
          </div>
          {/* Back */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden" as const,
            transform: "rotateY(180deg)",
            background: "rgba(124,92,252,0.05)",
            border: "2px solid var(--border)",
            borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, textAlign: "center" as const,
          }}>
            <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.6 }}>{card.back}</p>
          </div>
        </div>
      </div>

      {!flipped && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Tap the card to see the answer
        </p>
      )}

      {flipped && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => answer(false)}
            style={{ ...actionBtn, borderColor: "var(--red)", color: "var(--red)", background: "rgba(239,68,68,0.07)" }}
          >
            <X size={16} /> Review Again
          </button>
          <button
            onClick={() => answer(true)}
            style={{ ...actionBtn, borderColor: "var(--green)", color: "var(--green)", background: "rgba(16,185,129,0.07)" }}
          >
            <Check size={16} /> Got It!
          </button>
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "12px 22px", borderRadius: 12, border: "2px solid",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 8,
};

const backBtn: React.CSSProperties = {
  padding: "10px 20px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "var(--surface)",
  color: "var(--text-muted)", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
