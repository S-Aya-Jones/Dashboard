"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, Pause, Play, Square } from "lucide-react";
import { CharacterId, getCharacter } from "./characters";

type AvatarStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface Props {
  text: string;
  characterId?: CharacterId;
  size?: number;
  tone?: string;
}

// ── SVG Avatar faces ──────────────────────────────────────────────────────────

interface FaceProps {
  outerMouthRef: React.RefObject<SVGEllipseElement>;
  innerMouthRef: React.RefObject<SVGEllipseElement>;
  size: number;
}

function ProfessorFace({ outerMouthRef, innerMouthRef, size }: FaceProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="profGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C5CFC" />
          <stop offset="100%" stopColor="#E879F9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#profGrad)" />
      <circle cx="34" cy="40" r="7" fill="white" />
      <circle cx="35" cy="41" r="3.5" fill="#1E1340" />
      <circle cx="37" cy="39" r="1.5" fill="white" />
      <circle cx="66" cy="40" r="7" fill="white" />
      <circle cx="67" cy="41" r="3.5" fill="#1E1340" />
      <circle cx="69" cy="39" r="1.5" fill="white" />
      <rect x="24" y="32" width="20" height="16" rx="5" fill="none" stroke="white" strokeWidth="1.8" opacity="0.65" />
      <rect x="56" y="32" width="20" height="16" rx="5" fill="none" stroke="white" strokeWidth="1.8" opacity="0.65" />
      <line x1="44" y1="40" x2="56" y2="40" stroke="white" strokeWidth="1.8" opacity="0.65" />
      <line x1="14" y1="39" x2="24" y2="39" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="76" y1="39" x2="86" y2="39" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <ellipse ref={outerMouthRef} cx="50" cy="67" rx="11" ry="2" fill="white" />
      <ellipse ref={innerMouthRef} cx="50" cy="67" rx="9" ry="0" fill="rgba(30,19,64,0.65)" style={{ opacity: 0 }} />
    </svg>
  );
}

function MonsterFace({ outerMouthRef, innerMouthRef, size }: FaceProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="monsterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      {/* Horns */}
      <polygon points="28,18 22,2 34,12" fill="#059669" />
      <polygon points="72,18 66,12 78,2" fill="#059669" />
      {/* Face blob */}
      <ellipse cx="50" cy="55" rx="44" ry="42" fill="url(#monsterGrad)" />
      {/* Spots */}
      <circle cx="20" cy="50" r="5" fill="#059669" opacity="0.35" />
      <circle cx="80" cy="45" r="4" fill="#059669" opacity="0.35" />
      <circle cx="75" cy="65" r="3" fill="#059669" opacity="0.25" />
      {/* Eyes white */}
      <circle cx="35" cy="42" r="10" fill="white" />
      <circle cx="65" cy="42" r="10" fill="white" />
      {/* Pupils */}
      <circle cx="37" cy="44" r="5" fill="#1E1340" />
      <circle cx="67" cy="44" r="5" fill="#1E1340" />
      {/* Highlights */}
      <circle cx="39" cy="41" r="2" fill="white" />
      <circle cx="69" cy="41" r="2" fill="white" />
      {/* Mouth outer */}
      <ellipse ref={outerMouthRef} cx="50" cy="70" rx="13" ry="2" fill="white" />
      {/* Mouth inner */}
      <ellipse ref={innerMouthRef} cx="50" cy="70" rx="11" ry="0" fill="#065f46" style={{ opacity: 0 }} />
      {/* Teeth hints when closed */}
      <rect x="43" y="68" width="4" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="50" y="68" width="4" height="3" rx="1" fill="white" opacity="0.6" />
    </svg>
  );
}

function RobotFace({ outerMouthRef, innerMouthRef, size }: FaceProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="robotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      {/* Antenna */}
      <line x1="50" y1="8" x2="50" y2="18" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="6" r="4" fill="#60A5FA" />
      <circle cx="50" cy="6" r="2" fill="white" opacity="0.8" />
      {/* Head */}
      <rect x="8" y="18" width="84" height="74" rx="14" fill="url(#robotGrad)" />
      {/* Panel lines */}
      <line x1="8" y1="38" x2="92" y2="38" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="50" y1="18" x2="50" y2="92" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Eye screens */}
      <rect x="20" y="26" width="24" height="16" rx="4" fill="#1D4ED8" />
      <rect x="56" y="26" width="24" height="16" rx="4" fill="#1D4ED8" />
      {/* Eye glow */}
      <rect x="22" y="28" width="20" height="12" rx="3" fill="#93C5FD" opacity="0.9" />
      <rect x="58" y="28" width="20" height="12" rx="3" fill="#93C5FD" opacity="0.9" />
      {/* Scanlines */}
      <line x1="22" y1="31" x2="42" y2="31" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="22" y1="34" x2="42" y2="34" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="58" y1="31" x2="78" y2="31" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="58" y1="34" x2="78" y2="34" stroke="white" strokeWidth="1" opacity="0.5" />
      {/* Nose dot */}
      <circle cx="50" cy="52" r="3" fill="rgba(255,255,255,0.4)" />
      {/* Mouth panel */}
      <rect x="28" y="60" width="44" height="18" rx="5" fill="#1D4ED8" opacity="0.8" />
      {/* Mouth LED segments (outer animated) */}
      <ellipse ref={outerMouthRef} cx="50" cy="69" rx="14" ry="2" fill="#93C5FD" />
      <ellipse ref={innerMouthRef} cx="50" cy="69" rx="12" ry="0" fill="#1E3A8A" style={{ opacity: 0 }} />
    </svg>
  );
}

function OwlFace({ outerMouthRef, innerMouthRef, size }: FaceProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="owlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="owlFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Ear tufts */}
      <ellipse cx="28" cy="16" rx="8" ry="12" fill="url(#owlGrad)" transform="rotate(-15 28 16)" />
      <ellipse cx="72" cy="16" rx="8" ry="12" fill="url(#owlGrad)" transform="rotate(15 72 16)" />
      {/* Body/head */}
      <ellipse cx="50" cy="55" rx="44" ry="43" fill="url(#owlGrad)" />
      {/* Face disc */}
      <ellipse cx="50" cy="52" rx="36" ry="34" fill="url(#owlFaceGrad)" />
      {/* Feather detail */}
      <ellipse cx="50" cy="52" rx="30" ry="28" fill="none" stroke="rgba(180,100,0,0.2)" strokeWidth="2" />
      {/* Eye rings */}
      <circle cx="34" cy="42" r="12" fill="#92400E" />
      <circle cx="66" cy="42" r="12" fill="#92400E" />
      <circle cx="34" cy="42" r="10" fill="white" />
      <circle cx="66" cy="42" r="10" fill="white" />
      {/* Pupils */}
      <circle cx="35" cy="43" r="5.5" fill="#1C1917" />
      <circle cx="67" cy="43" r="5.5" fill="#1C1917" />
      {/* Eye shine */}
      <circle cx="37" cy="41" r="2" fill="white" />
      <circle cx="69" cy="41" r="2" fill="white" />
      {/* Beak */}
      <polygon points="50,56 44,64 56,64" fill="#D97706" />
      <polygon points="50,57 44,64 56,64" fill="#B45309" opacity="0.5" />
      {/* Mouth (below beak) */}
      <ellipse ref={outerMouthRef} cx="50" cy="70" rx="10" ry="2" fill="#92400E" opacity="0.7" />
      <ellipse ref={innerMouthRef} cx="50" cy="70" rx="8" ry="0" fill="#451A03" style={{ opacity: 0 }} />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TutorAvatar({ text, characterId = "professor", size = 120, tone }: Props) {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const character = getCharacter(characterId);

  const statusRef    = useRef<AvatarStatus>("idle");
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const audioDataRef = useRef<AudioBuffer | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const offsetRef    = useRef<number>(0);

  const outerMouthRef = useRef<SVGEllipseElement>(null) as React.RefObject<SVGEllipseElement>;
  const innerMouthRef = useRef<SVGEllipseElement>(null) as React.RefObject<SVGEllipseElement>;

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
        body: JSON.stringify({ text, tone }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
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
    setStatusBoth("paused");
    try { sourceRef.current.stop(); } catch { /* already stopped */ }
    stopAnimation();
  }

  function handleResume() {
    if (!audioCtxRef.current || !audioDataRef.current) return;
    playBuffer(audioDataRef.current, offsetRef.current);
  }

  function handleStop() {
    setStatusBoth("idle");
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current.disconnect();
    }
    stopAnimation();
    offsetRef.current = 0;
  }

  useEffect(() => {
    return () => {
      stopAnimation();
      handleStop();
      audioCtxRef.current?.close().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const isActive = status === "playing" || status === "paused";
  const faceProps = { outerMouthRef, innerMouthRef, size };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.7; }
          50%  { transform: scale(1.08); opacity: 0.3; }
          100% { transform: scale(1);    opacity: 0.7; }
        }
        @keyframes avatar-idle {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
      `}</style>
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        overflow: "hidden",
        position: "relative",
        boxShadow: isActive
          ? `0 0 0 3px ${character.primary}, 0 4px 20px ${character.primary}70`
          : `0 2px 12px ${character.primary}30`,
        flexShrink: 0,
        outline: status === "playing" ? `3px solid ${character.primary}` : "none",
        animation: status === "playing"
          ? "pulse-ring 1.4s ease-in-out infinite"
          : status === "idle"
          ? "avatar-idle 3s ease-in-out infinite"
          : "none",
      }}>
        {characterId === "professor" && <ProfessorFace {...faceProps} />}
        {characterId === "monster"   && <MonsterFace   {...faceProps} />}
        {characterId === "robot"     && <RobotFace     {...faceProps} />}
        {characterId === "owl"       && <OwlFace       {...faceProps} />}
      </div>

      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {status === "idle" && (
          <button onClick={handleListen} style={btnStyle(character.primary, character.primary + "18")}>
            <Volume2 size={12} />
            <span>Listen</span>
          </button>
        )}
        {status === "loading" && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading…</span>
        )}
        {status === "playing" && (
          <>
            <button onClick={handlePause} style={iconBtn("#F59E0B")} title="Pause">
              <Pause size={13} />
            </button>
            <button onClick={handleStop} style={iconBtn("#EF4444")} title="Stop">
              <Square size={13} />
            </button>
          </>
        )}
        {status === "paused" && (
          <>
            <button onClick={handleResume} style={iconBtn("#10B981")} title="Resume">
              <Play size={13} />
            </button>
            <button onClick={handleStop} style={iconBtn("#EF4444")} title="Stop">
              <Square size={13} />
            </button>
          </>
        )}
        {status === "error" && (
          <button onClick={handleListen} style={btnStyle("#EF4444", "rgba(239,68,68,0.08)")}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string, bg: string) {
  return {
    padding: "4px 10px", borderRadius: 20,
    border: `1.5px solid ${color}`, background: bg, color,
    fontWeight: 600 as const, fontSize: 11,
    cursor: "pointer" as const,
    display: "flex" as const, alignItems: "center" as const, gap: 4,
  };
}

function iconBtn(color: string) {
  return {
    padding: "5px 8px", borderRadius: 8,
    border: "1.5px solid var(--border)", background: "var(--surface)", color,
    cursor: "pointer" as const,
    display: "flex" as const, alignItems: "center" as const,
  };
}
