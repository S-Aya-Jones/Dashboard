"use client";

import { useState, useEffect, useRef } from "react";
import { Volume2, Play, X } from "lucide-react";
import { ProgramExercise } from "./program";
import { getFormCuesForExercise } from "@/lib/formCues";

interface Props {
  exercise: ProgramExercise;
  setIndex: number;
  totalSets: number;
  isPlaying: boolean;
  videoUrl?: string;
}

export function AvatarCoach({ exercise, setIndex, totalSets, isPlaying, videoUrl }: Props) {
  const [currentCueIndex, setCurrentCueIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const cues = getFormCuesForExercise(exercise.id, exercise.category);

  useEffect(() => {
    if (!isPlaying || cues.length === 0) return;
    const interval = setInterval(() => {
      setCurrentCueIndex((prev) => (prev + 1) % cues.length);
    }, 8000);
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
      const u = new SpeechSynthesisUtterance(currentCue);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl overflow-hidden border-2" style={{ borderColor: "#7C5CFC", background: "linear-gradient(135deg, #2a1a3a 0%, #1a0f2e 100%)" }}>

        {/* Avatar / video area */}
        <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "linear-gradient(180deg, #1a0a2e 0%, #0d0618 100%)" }}>

          {videoUrl ? (
            /* HeyGen video available — show thumbnail with play */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer group"
              onClick={() => setShowVideo(true)}>
              {/* Aya avatar placeholder */}
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center text-5xl shadow-lg">
                👩🏾
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-white">Aya is ready to coach you</p>
                <p className="text-[10px] text-purple-300">{exercise.name}</p>
              </div>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
                style={{ background: "#7C5CFC", color: "#fff" }}>
                <Play size={14} fill="#fff" /> Watch Aya Coach This
              </button>
            </div>
          ) : (
            /* No video yet — show avatar with animated pulse */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "#7C5CFC" }} />
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center text-5xl shadow-lg relative">
                  👩🏾
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-white">Aya · AI Form Coach</p>
                <p className="text-[10px] text-purple-400">Form cues active below</p>
              </div>
            </div>
          )}

          {/* Set badge */}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(124,92,252,0.3)", color: "#9B7FFF" }}>
            Set {setIndex + 1} / {totalSets}
          </div>

          {/* Live indicator */}
          {isPlaying && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{ background: "rgba(218,102,123,0.2)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400">LIVE</span>
            </div>
          )}
        </div>

        {/* Form cue */}
        <div className="p-4 space-y-3" style={{ background: "linear-gradient(180deg, #1a0a2e 0%, #0d0618 100%)" }}>
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(124,92,252,0.12)", border: "1px solid rgba(124,92,252,0.2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Aya says</p>
            <p className="text-sm leading-relaxed text-white">{currentCue}</p>
          </div>

          {/* Cue dots */}
          <div className="flex gap-1.5 justify-center">
            {cues.map((_, i) => (
              <button key={i} onClick={() => setCurrentCueIndex(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === currentCueIndex ? "#7C5CFC" : "rgba(124,92,252,0.2)",
                  transform: i === currentCueIndex ? "scale(1.3)" : "scale(1)",
                }} />
            ))}
          </div>

          {/* Audio button */}
          <button onClick={speakCue} disabled={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: "rgba(124,92,252,0.2)", color: "#9B7FFF", border: "1px solid rgba(124,92,252,0.3)", opacity: isLoading ? 0.7 : 1 }}>
            <Volume2 size={15} />
            {isLoading ? "Loading..." : "Hear Cue"}
          </button>
        </div>

        {/* Exercise name footer */}
        <div className="px-4 py-3 border-t" style={{ background: "#0d0618", borderColor: "rgba(124,92,252,0.15)" }}>
          <p className="text-xs font-bold text-purple-300">{exercise.name}</p>
          <p className="text-[10px] text-purple-500 mt-0.5 leading-snug">{exercise.formCue}</p>
        </div>
      </div>

      {/* Fullscreen video modal */}
      {showVideo && videoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={() => setShowVideo(false)}>
          <div className="w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <p className="text-white font-bold text-sm">Aya · {exercise.name}</p>
                <p className="text-purple-400 text-xs mt-0.5">Form coaching video</p>
              </div>
              <button onClick={() => setShowVideo(false)} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <X size={16} color="white" />
              </button>
            </div>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              className="w-full rounded-2xl"
              style={{ maxHeight: "70vh" }}
              onEnded={() => setShowVideo(false)}
            />
            <p className="text-center text-xs text-purple-400 mt-3">Tap outside to close</p>
          </div>
        </div>
      )}
    </>
  );
}
