"use client";

import { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { demoFor } from "@/lib/exerciseDemos";

// Mid-set is the worst possible moment to be sent to a YouTube search page.
// Every move carries a start and end frame; alternating them on a loop is a
// real demonstration, and it comes off our own origin so there is nothing to
// wait for and nowhere to navigate.

const FRAME_MS = 900;

export function ExerciseDemo({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const demo = demoFor(name);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [broken, setBroken] = useState(false);

  const frames = demo?.images ?? [];

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  // Foam rolling and rest days have no demo, and that's fine.
  if (!demo || !frames.length || broken) return null;

  return (
    <div className={className}>
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ background: "var(--surface2)", aspectRatio: "4 / 3" }}
      >
        {frames.map((path, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={path}
            src={`/api/exercise-image?p=${encodeURIComponent(path)}`}
            alt={i === 0 ? `${demo.name}, starting position` : `${demo.name}, end of the movement`}
            onError={() => setBroken(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: i === frame ? 1 : 0 }}
          />
        ))}

        {frames.length > 1 && (
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause the demo" : "Play the demo"}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full grid place-items-center"
            style={{ background: "rgba(20,16,13,0.62)", color: "#fff", backdropFilter: "blur(6px)" }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
        )}

        <span
          className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full tabular-nums"
          style={{ background: "rgba(20,16,13,0.62)", color: "#fff", backdropFilter: "blur(6px)" }}
        >
          {frame === 0 ? "Start" : "Finish"}
        </span>
      </div>

      {/* Never let an approximation pass as the real movement. */}
      {demo.match === "close" && (
        <p className="text-[11px] mt-2 leading-snug" style={{ color: "var(--text-light)" }}>
          Closest demo available — this shows <span style={{ color: "var(--text-muted)" }}>{demo.name}</span>.
          Your version differs; follow the cues.
        </p>
      )}

      {demo.cues.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {demo.cues.map((cue, i) => (
            <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--text-muted)" }}>
              <span className="font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
                {i + 1}
              </span>
              <span>{cue}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Whether a move has a demo, for callers deciding what else to show. */
export function hasDemo(name: string): boolean {
  const d = demoFor(name);
  return Boolean(d?.images.length);
}
