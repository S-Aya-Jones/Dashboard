"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, X } from "lucide-react";

interface VoiceButtonProps {
  onResult?: (reply: string, parsed: Record<string, unknown>) => void;
}

type Status = "idle" | "listening" | "processing" | "done" | "error";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new () => SpeechRecognitionInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export function VoiceButton({ onResult }: VoiceButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input isn't supported on this browser. Try Safari on iPhone.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setReply("");
      setShowPanel(true);
    };

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setStatus("processing");

      try {
        const res = await fetch("/api/sms/interpret", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.NEXT_PUBLIC_SHORTCUTS_SECRET ? { "x-shortcuts-secret": process.env.NEXT_PUBLIC_SHORTCUTS_SECRET } : {}),
          },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        setReply(data.reply ?? "Got it!");
        setStatus("done");
        onResult?.(data.reply, data.parsed);
      } catch {
        setReply("Something went wrong. Try again.");
        setStatus("error");
      }
    };

    recognition.onerror = () => {
      setStatus("error");
      setReply("Couldn't hear you. Tap the mic and try again.");
    };

    recognition.onend = () => {
      if (status === "listening") setStatus("idle");
    };

    recognition.start();
  }, [onResult, status]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setStatus("idle");
  };

  const dismiss = () => {
    setShowPanel(false);
    setStatus("idle");
    setTranscript("");
    setReply("");
  };

  const handleMicTap = () => {
    if (status === "listening") {
      stopListening();
    } else {
      startListening();
    }
  };

  const isListening = status === "listening";
  const isProcessing = status === "processing";

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={handleMicTap}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 md:bottom-8"
        style={{
          background: isListening
            ? "linear-gradient(135deg, #EF4444, #E879F9)"
            : "linear-gradient(135deg, #7C5CFC, #E879F9)",
          boxShadow: isListening
            ? "0 0 0 8px rgba(239,68,68,0.2), 0 8px 32px rgba(232,121,249,0.4)"
            : "0 8px 32px rgba(124,92,252,0.4)",
          transform: isListening ? "scale(1.1)" : "scale(1)",
        }}
      >
        {isProcessing ? (
          <Loader2 size={22} color="#fff" className="animate-spin" />
        ) : isListening ? (
          <MicOff size={22} color="#fff" />
        ) : (
          <Mic size={22} color="#fff" />
        )}

        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full animate-ping" style={{
            background: "rgba(239,68,68,0.3)",
          }} />
        )}
      </button>

      {/* Result panel */}
      {showPanel && (
        <div className="fixed bottom-44 right-4 z-50 w-72 rounded-3xl p-4 shadow-2xl md:bottom-28"
          style={{
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            boxShadow: "0 20px 60px rgba(124,92,252,0.2)",
          }}>
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {status === "listening" ? "🎙 Listening..." : status === "processing" ? "⚡ Processing..." : status === "done" ? "✓ Logged" : "Voice Update"}
            </span>
            <button onClick={dismiss} style={{ color: "var(--text-muted)" }}>
              <X size={14} />
            </button>
          </div>

          {transcript && (
            <div className="mb-3 p-3 rounded-2xl text-sm" style={{ background: "var(--bg)", color: "var(--text)" }}>
              &ldquo;{transcript}&rdquo;
            </div>
          )}

          {status === "listening" && (
            <div className="flex gap-1 justify-center py-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1 rounded-full animate-bounce" style={{
                  height: `${12 + Math.random() * 16}px`,
                  background: "var(--purple)",
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.6s",
                }} />
              ))}
            </div>
          )}

          {reply && (
            <div className="p-3 rounded-2xl text-sm font-medium" style={{
              background: "linear-gradient(135deg, rgba(124,92,252,0.1), rgba(232,121,249,0.08))",
              color: "var(--purple)",
              border: "1px solid rgba(124,92,252,0.2)",
            }}>
              {reply}
            </div>
          )}

          {status === "done" && (
            <button onClick={handleMicTap} className="mt-3 w-full py-2 rounded-2xl text-sm font-semibold transition-all"
              style={{ background: "var(--grad)", color: "#fff" }}>
              Speak Again
            </button>
          )}
        </div>
      )}
    </>
  );
}
