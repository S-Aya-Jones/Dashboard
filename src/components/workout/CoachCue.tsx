"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { ProgramExercise, CATEGORY_CUES, UNIVERSAL_CUES } from "./program";
import { say, prewarm, setMuted, isMuted } from "@/lib/coachVoice";

// Ladder's coaching is in your ear, not on your screen — a line at the top of
// the set and then it gets out of the way. This replaces a full card with a
// fake avatar, a LIVE badge and a rotating carousel, which was taking up more
// room than the actual exercise.

function cuesFor(ex: ProgramExercise): string[] {
  const byCategory = CATEGORY_CUES[ex.category] ?? [];
  const pool = [ex.formCue, ...(ex.motivCues ?? []), ...byCategory, ...UNIVERSAL_CUES];
  // Keep them distinct and short enough to hear between breaths.
  return Array.from(new Set(pool)).filter((c) => c && c.length < 140).slice(0, 4);
}

export function CoachCue({
  exercise,
  setIndex,
  active,
  nextExercise,
}: {
  exercise: ProgramExercise;
  setIndex: number;
  /** False while paused or resting — don't talk over a rest countdown. */
  active: boolean;
  nextExercise?: ProgramExercise;
}) {
  const cues = cuesFor(exercise);
  const [i, setI] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const spokenFor = useRef<string>("");

  useEffect(() => setQuiet(isMuted()), []);

  // One cue per set, spoken as the set comes up — not on a timer, and never
  // twice for the same set.
  useEffect(() => {
    if (!active || !cues.length) return;
    const token = `${exercise.id}:${setIndex}`;
    if (spokenFor.current === token) return;
    spokenFor.current = token;

    const pick = setIndex % cues.length;
    setI(pick);
    const t = setTimeout(() => say(cues[pick]), 450);
    return () => clearTimeout(t);
  }, [exercise.id, setIndex, active, cues]);

  // Fetch the next movement's first cue while this set is still running so it
  // plays instantly on arrival.
  useEffect(() => {
    if (!nextExercise) return;
    const next = cuesFor(nextExercise)[0];
    if (next) prewarm(next);
  }, [nextExercise]);

  if (!cues.length) return null;
  const cue = cues[i];

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-2xl"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => {
          const next = !quiet;
          setQuiet(next);
          setMuted(next);
          if (!next) say(cue);
        }}
        aria-label={quiet ? "Turn coaching audio on" : "Mute coaching audio"}
        className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0 active:scale-90 transition-transform"
        style={{ background: quiet ? "transparent" : "var(--purple)", color: quiet ? "var(--text-light)" : "var(--surface)", border: quiet ? "1px solid var(--border)" : "none" }}
      >
        {quiet ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{cue}</p>
        {cues.length > 1 && (
          <button
            onClick={() => {
              const n = (i + 1) % cues.length;
              setI(n);
              say(cues[n]);
            }}
            className="text-[11px] font-semibold mt-1"
            style={{ color: "var(--text-light)" }}
          >
            Another cue
          </button>
        )}
      </div>
    </div>
  );
}
