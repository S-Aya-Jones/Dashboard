"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { MCATQuestion } from "@/types/dashboard";

interface Props {
  question: MCATQuestion;
}

export function AskAIPanel({ question }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");

  async function ask(mode: "slow" | "custom") {
    if (mode === "custom" && !customQuestion.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/mcat/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stem: question.stem,
          choices: question.choices,
          correctLetter: question.correctLetter,
          explanation: question.explanation,
          mode,
          customQuestion: mode === "custom" ? customQuestion : undefined,
        }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setAnswer(json.answer);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 mt-3 text-xs font-semibold"
        style={{ color: "#7C5CFC" }}
      >
        <Sparkles size={13} />
        Still confused? Ask AI
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(124,92,252,0.06)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} color="#7C5CFC" />
        <span className="text-xs font-bold" style={{ color: "#7C5CFC" }}>Ask AI</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => ask("slow")}
          disabled={loading}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: "#7C5CFC", color: "#fff", opacity: loading ? 0.6 : 1 }}
        >
          Explain like I&apos;m slow
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask("custom")}
          placeholder="Or ask your own question…"
          className="flex-1 text-xs"
          style={{ padding: "0.4rem 0.6rem" }}
        />
        <button
          onClick={() => ask("custom")}
          disabled={loading || !customQuestion.trim()}
          className="text-xs font-semibold px-3 rounded-lg"
          style={{ background: "var(--border)", color: "var(--text)", opacity: loading || !customQuestion.trim() ? 0.5 : 1 }}
        >
          Ask
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={13} className="animate-spin" />
          Thinking…
        </div>
      )}

      {error && <p className="text-xs mt-3" style={{ color: "#EF4444" }}>{error}</p>}

      {answer && (
        <p className="text-sm mt-3 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
          {answer}
        </p>
      )}
    </div>
  );
}
