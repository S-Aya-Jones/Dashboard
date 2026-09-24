"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { MCATQuestion } from "@/types/dashboard";

interface Props {
  questions: MCATQuestion[];
  onDone: () => void;
}

const TIME_PER_Q = 20;

export function SpeedRound({ questions, onDone }: Props) {
  const pool = questions.slice(0, 10);
  const [idx, setIdx]       = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [done, setDone]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(TIME_PER_Q);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          next(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!done && pool.length > 0) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  function next(answeredLetter: string | null) {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = pool[idx];
    if (answeredLetter === q?.correctLetter) setCorrect(c => c + 1);
    if (idx + 1 >= pool.length) {
      setDone(true);
    } else {
      setTimeout(() => { setChosen(null); setIdx(i => i + 1); }, 800);
    }
  }

  function pick(letter: string) {
    if (chosen) return;
    setChosen(letter);
    next(letter);
  }

  function restart() {
    setIdx(0);
    setChosen(null);
    setCorrect(0);
    setDone(false);
  }

  if (pool.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--text-muted)" }}>No questions in your Q Bank yet. Generate some first!</p>
        <button onClick={onDone} style={backBtn}>Back</button>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correct / pool.length) * 100);
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Trophy size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
          {pct >= 80 ? "Lightning fast!" : pct >= 60 ? "Solid round!" : "Keep practicing!"}
        </h2>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 24 }}>
          <strong style={{ color: "var(--green)", fontSize: 28 }}>{correct}</strong>/{pool.length} · {pct}%
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={restart} style={{ ...actionBtn, background: "var(--grad)", color: "#fff", border: "none" }}>
            <RotateCcw size={14} /> Play Again
          </button>
          <button onClick={onDone} style={backBtn}>Back to Games</button>
        </div>
      </div>
    );
  }

  const q = pool[idx];
  const timerPct = (timeLeft / TIME_PER_Q) * 100;
  const timerColor = timerPct > 50 ? "var(--green)" : timerPct > 25 ? "var(--amber)" : "var(--red)";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
        <span style={{ color: "var(--text-muted)" }}>Q {idx + 1} / {pool.length}</span>
        <span style={{ fontWeight: 700, color: timerColor, fontFamily: "monospace" }}>{timeLeft}s</span>
      </div>
      {/* Timer bar */}
      <div style={{ height: 5, borderRadius: 3, background: "var(--border)", marginBottom: 20 }}>
        <div style={{ height: 5, borderRadius: 3, background: timerColor, width: `${timerPct}%`, transition: "width 1s linear, background 0.3s" }} />
      </div>

      {/* Question */}
      <div className="card" style={{ padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" as const }}>
          {q.subject} · {q.difficulty}
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.6, margin: 0 }}>{q.stem}</p>
      </div>

      {/* Choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.choices.map(choice => {
          const isChosen  = chosen === choice.letter;
          const isCorrect = choice.letter === q.correctLetter;
          const showResult = chosen !== null;
          let bg = "var(--surface)", border = "var(--border)", color = "var(--text)";
          if (showResult && isCorrect) { bg = "rgba(16,185,129,0.1)"; border = "var(--green)"; color = "var(--green)"; }
          else if (showResult && isChosen) { bg = "rgba(239,68,68,0.08)"; border = "var(--red)"; color = "var(--red)"; }
          return (
            <button
              key={choice.letter}
              onClick={() => pick(choice.letter)}
              disabled={chosen !== null}
              style={{
                padding: "12px 16px", borderRadius: 10,
                border: `2px solid ${border}`, background: bg, color,
                fontSize: 14, fontWeight: isChosen || isCorrect ? 700 : 500,
                cursor: chosen ? "default" : "pointer",
                textAlign: "left" as const, transition: "all 0.15s",
              }}
            >
              <span style={{ fontWeight: 800, marginRight: 10 }}>{choice.letter}.</span>
              {choice.text}
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
