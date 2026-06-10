"use client";

import { useState, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { ProgramExercise } from "./program";
import { getFormCuesForExercise } from "@/lib/formCues";

interface Props {
  exercise: ProgramExercise;
  setIndex: number;
  totalSets: number;
  isPlaying: boolean;
}

export function AvatarCoach({ exercise, setIndex, totalSets, isPlaying }: Props) {
  const [currentCueIndex, setCurrentCueIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const cues = getFormCuesForExercise(exercise.id, exercise.category);

  // Rotate through form cues
  useEffect(() => {
    if (!isPlaying || cues.length === 0) return;
    const interval = setInterval(() => {
      setCurrentCueIndex((prev) => (prev + 1) % cues.length);
    }, 8000); // Change cue every 8 seconds
    return () => clearInterval(interval);
  }, [isPlaying, cues.length]);

  const currentCue = cues[currentCueIndex];

  const speakCue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentCue }),
      });
      if (res.ok) {
        new Audio(URL.createObjectURL(await res.blob())).play();
      }
    } catch {
      /* fallback to browser TTS */
      const u = new SpeechSynthesisUtterance(currentCue);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl overflow-hidden border-2" style={{ borderColor: "#7C5CFC", background: "linear-gradient(135deg, #2a1a3a 0%, #1a0f2e 100%)" }}>
      {/* Avatar placeholder - where HeyGen video will go */}
      <div className="relative aspect-square bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        {/* Placeholder for AI avatar video */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-amber-600 via-red-500 to-purple-600 flex items-center justify-center text-5xl">
              🧑‍🦱
            </div>
            <p className="text-xs text-purple-300 font-semibold">AI Coach Ready</p>
            <p className="text-[10px] text-purple-400">HeyGen Avatar Loading</p>
          </div>
        </div>

        {/* Overlay badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(124,92,252,0.2)", color: "#9B7FFF" }}>
          Set {setIndex + 1} of {totalSets}
        </div>
      </div>

      {/* Form cue section */}
      <div className="p-5 space-y-4 bg-gradient-to-b from-purple-950 to-black">
        {/* Current cue */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">Form Check</p>
          <p className="text-sm leading-relaxed text-white font-medium">{currentCue}</p>
        </div>

        {/* Cue indicator dots */}
        <div className="flex gap-1.5 justify-center">
          {cues.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentCueIndex(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === currentCueIndex ? "#7C5CFC" : "rgba(124,92,252,0.2)",
                transform: i === currentCueIndex ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* Audio button */}
        <button
          onClick={speakCue}
          disabled={isLoading}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: "#7C5CFC", color: "#fff", opacity: isLoading ? 0.7 : 1 }}>
          <Volume2 size={15} />
          {isLoading ? "Hearing..." : "Hear Form Cue"}
        </button>
      </div>

      {/* Exercise name */}
      <div className="px-5 py-3 bg-black border-t" style={{ borderColor: "rgba(124,92,252,0.2)" }}>
        <p className="text-xs font-semibold text-purple-300">{exercise.name}</p>
        <p className="text-[11px] text-purple-400 mt-1">{exercise.formCue}</p>
      </div>
    </div>
  );
}
