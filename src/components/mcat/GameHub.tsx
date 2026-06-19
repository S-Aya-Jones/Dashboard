"use client";

import { useState } from "react";
import { Layers, Zap, Grid } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { FlashcardFlip } from "./games/FlashcardFlip";
import { MatchingGame }  from "./games/MatchingGame";
import { SpeedRound }    from "./games/SpeedRound";

interface Props {
  data: DashboardData;
}

type GameId = "flip" | "match" | "speed" | null;

const GAMES = [
  {
    id: "flip" as const,
    name: "Flashcard Flip",
    desc: "Flip cards and mark what you know. Tracks your score.",
    icon: <Layers size={28} />,
    color: "#7C5CFC",
  },
  {
    id: "match" as const,
    name: "Matching Pairs",
    desc: "Match terms to their definitions against the clock.",
    icon: <Grid size={28} />,
    color: "#10B981",
  },
  {
    id: "speed" as const,
    name: "Speed Round",
    desc: "10 MCAT questions, 20 seconds each. How fast are you?",
    icon: <Zap size={28} />,
    color: "#F59E0B",
  },
];

export function GameHub({ data }: Props) {
  const [activeGame, setActiveGame] = useState<GameId>(null);
  const flashcards = data.flashcards ?? [];
  const questions  = data.mcatQuestions ?? [];

  if (activeGame === "flip") {
    const deck = flashcards.slice().sort(() => Math.random() - 0.5).slice(0, 20);
    return (
      <div>
        <button onClick={() => setActiveGame(null)} style={backBtn}>← Back to Games</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: "16px 0 20px" }}>Flashcard Flip</h2>
        <FlashcardFlip cards={deck} onDone={() => setActiveGame(null)} />
      </div>
    );
  }
  if (activeGame === "match") {
    const deck = flashcards.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    return (
      <div>
        <button onClick={() => setActiveGame(null)} style={backBtn}>← Back to Games</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: "16px 0 20px" }}>Matching Pairs</h2>
        <MatchingGame cards={deck} onDone={() => setActiveGame(null)} />
      </div>
    );
  }
  if (activeGame === "speed") {
    const pool = questions.slice().sort(() => Math.random() - 0.5).slice(0, 10);
    return (
      <div>
        <button onClick={() => setActiveGame(null)} style={backBtn}>← Back to Games</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: "16px 0 20px" }}>Speed Round</h2>
        <SpeedRound questions={pool} onDone={() => setActiveGame(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Study Games</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {flashcards.length} flashcards · {questions.length} questions in your bank
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {GAMES.map(game => (
          <button
            key={game.id}
            onClick={() => setActiveGame(game.id)}
            style={{
              padding: "20px 24px",
              borderRadius: 16,
              border: "2px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              textAlign: "left" as const,
              display: "flex", alignItems: "center", gap: 18,
              transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `${game.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: game.color,
            }}>
              {game.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>{game.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{game.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--surface)",
  color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
