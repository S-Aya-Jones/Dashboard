"use client";

import { CHARACTERS, CharacterId } from "./characters";

interface Props {
  selected: CharacterId;
  onSelect: (id: CharacterId) => void;
}

const CHAR_EMOJI: Record<CharacterId, string> = {
  professor: "👩‍🏫",
  monster:   "👾",
  robot:     "🤖",
  owl:       "🦉",
};

export function CharacterSelect({ selected, onSelect }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
        Choose Your Tutor
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {CHARACTERS.map(char => {
          const isSelected = selected === char.id;
          return (
            <button
              key={char.id}
              onClick={() => onSelect(char.id)}
              style={{
                padding: "14px 10px",
                borderRadius: 14,
                border: `2px solid ${isSelected ? char.primary : "var(--border)"}`,
                background: isSelected ? `${char.primary}12` : "var(--surface)",
                cursor: "pointer",
                textAlign: "center" as const,
                transition: "all 0.15s",
                boxShadow: isSelected ? `0 2px 12px ${char.primary}30` : "none",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{CHAR_EMOJI[char.id]}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? char.primary : "var(--text)", marginBottom: 2 }}>
                {char.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>
                {char.tagline}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
