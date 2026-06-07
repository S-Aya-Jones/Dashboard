"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, Pause, Play, Square } from "lucide-react";

type AvatarStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface Props {
  text: string;
}

export function TutorAvatar({ text }: Props) {
  const [status, setStatus] = useState<AvatarStatus>("idle");

  // Use a ref so callbacks always see the latest value without stale closures
  const statusRef    = useRef<AvatarStatus>("idle");
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const audioDataRef = useRef<AudioBuffer | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const offsetRef    = useRef<number>(0);

  // SVG DOM refs — we mutate these directly to avoid 60fps React re-renders
  const outerMouthRef = useRef<SVGEllipseElement>(null);
  const innerMouthRef = useRef<SVGEllipseElement>(null);

  function setStatusBoth(s: AvatarStatus) {
    statusRef.current = s;
    setStatus(s);
  }

  function stopAnimation() {
    cancelAnimationFrame(animFrameRef.current);
    outerMouthRef.current?.setAttribute("ry", "2");
    if (innerMouthRef.current) {
      innerMouthRef.current.setAttribute("ry", "0");
      innerMouthRef.current.style.opacity = "0";
    }
  }

  function startAnimation() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);
      analyser.getByteTimeDomainData(data);
      const amp = data.reduce((s, v) => s + Math.abs(v - 128), 0) / data.length;
      const ry = Math.max(2, Math.min(13, amp * 0.6));
      outerMouthRef.current?.setAttribute("ry", String(ry.toFixed(1)));
      if (innerMouthRef.current) {
        const inner = Math.max(0, ry - 4.5);
        innerMouthRef.current.setAttribute("ry", String(inner.toFixed(1)));
        innerMouthRef.current.style.opacity = ry > 5 ? "1" : "0";
      }
    };
    loop();
  }

  function playBuffer(buffer: AudioBuffer, offset: number) {
    const ctx = audioCtxRef.current!;

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current.disconnect();
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.start(0, offset);

    source.onended = () => {
      // Only reset if we weren't paused (pause also calls source.stop → onended)
      if (statusRef.current === "playing") {
        stopAnimation();
        offsetRef.current = 0;
        setStatusBoth("idle");
      }
    };

    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    setStatusBoth("playing");
    startAnimation();
  }

  async function handleListen() {
    setStatusBoth("loading");
    try {
      const res = await fetch("/api/mcat/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();

      // AudioContext must be created (or resumed) on user gesture
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      audioDataRef.current = decoded;
      offsetRef.current = 0;
      playBuffer(decoded, 0);
    } catch (e) {
      console.error("TutorAvatar TTS error:", e);
      setStatusBoth("error");
    }
  }

  function handlePause() {
    const ctx = audioCtxRef.current;
    if (!ctx || !sourceRef.current) return;
    offsetRef.current = ctx.currentTime - startTimeRef.current;
    setStatusBoth("paused");             // set BEFORE stop so onended sees "paused"
    try { sourceRef.current.stop(); } catch { /* already stopped */ }
    stopAnimation();
  }

  function handleResume() {
    if (!audioCtxRef.current || !audioDataRef.current) return;
    playBuffer(audioDataRef.current, offsetRef.current);
  }

  function handleStop() {
    setStatusBoth("idle");               // set BEFORE stop so onended sees "idle" ≠ "playing"
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current.disconnect();
    }
    stopAnimation();
    offsetRef.current = 0;
  }

  // Cleanup on unmount or when text changes
  useEffect(() => {
    return () => {
      stopAnimation();
      handleStop();
      audioCtxRef.current?.close().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const isActive = status === "playing" || status === "paused";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Avatar face */}
      <div style={{
        width: 72, height: 72,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: isActive
          ? "0 0 0 3px var(--purple), 0 4px 20px rgba(124,92,252,0.45)"
          : "0 2px 12px rgba(124,92,252,0.18)",
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 100 100" width="72" height="72">
          <defs>
            <linearGradient id="avatarFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#E879F9" />
            </linearGradient>
          </defs>

          {/* Face */}
          <circle cx="50" cy="50" r="50" fill="url(#avatarFaceGrad)" />

          {/* Left eye white */}
          <circle cx="34" cy="40" r="7" fill="white" />
          {/* Left pupil */}
          <circle cx="35" cy="41" r="3.5" fill="#1E1340" />
          {/* Left highlight */}
          <circle cx="37" cy="39" r="1.5" fill="white" />

          {/* Right eye white */}
          <circle cx="66" cy="40" r="7" fill="white" />
          {/* Right pupil */}
          <circle cx="67" cy="41" r="3.5" fill="#1E1340" />
          {/* Right highlight */}
          <circle cx="69" cy="39" r="1.5" fill="white" />

          {/* Glasses left lens */}
          <rect x="24" y="32" width="20" height="16" rx="5" fill="none" stroke="white" strokeWidth="1.8" opacity="0.65" />
          {/* Glasses right lens */}
          <rect x="56" y="32" width="20" height="16" rx="5" fill="none" stroke="white" strokeWidth="1.8" opacity="0.65" />
          {/* Glasses bridge */}
          <line x1="44" y1="40" x2="56" y2="40" stroke="white" strokeWidth="1.8" opacity="0.65" />
          {/* Glasses arms */}
          <line x1="14" y1="39" x2="24" y2="39" stroke="white" strokeWidth="1.5" opacity="0.5" />
          <line x1="76" y1="39" x2="86" y2="39" stroke="white" strokeWidth="1.5" opacity="0.5" />

          {/* Mouth outer — animated via ref */}
          <ellipse ref={outerMouthRef} cx="50" cy="67" rx="11" ry="2" fill="white" />
          {/* Mouth inner (open cavity) — animated via ref */}
          <ellipse ref={innerMouthRef} cx="50" cy="67" rx="9" ry="0" fill="rgba(30,19,64,0.65)" style={{ opacity: 0 }} />
        </svg>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {status === "idle" && (
          <button onClick={handleListen} style={btnStyle("var(--purple)", "rgba(124,92,252,0.1)")}>
            <Volume2 size={12} />
            <span>Listen</span>
          </button>
        )}

        {status === "loading" && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading…</span>
        )}

        {status === "playing" && (
          <>
            <button onClick={handlePause} style={iconBtn("var(--amber)")} title="Pause">
              <Pause size={13} />
            </button>
            <button onClick={handleStop} style={iconBtn("var(--red)")} title="Stop">
              <Square size={13} />
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button onClick={handleResume} style={iconBtn("var(--green)")} title="Resume">
              <Play size={13} />
            </button>
            <button onClick={handleStop} style={iconBtn("var(--red)")} title="Stop">
              <Square size={13} />
            </button>
          </>
        )}

        {status === "error" && (
          <button
            onClick={handleListen}
            style={{ ...btnStyle("var(--red)", "rgba(239,68,68,0.08)") }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string, bg: string) {
  return {
    padding: "4px 10px",
    borderRadius: 20,
    border: `1.5px solid ${color}`,
    background: bg,
    color,
    fontWeight: 600 as const,
    fontSize: 11,
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 4,
  };
}

function iconBtn(color: string) {
  return {
    padding: "5px 8px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color,
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
  };
}
