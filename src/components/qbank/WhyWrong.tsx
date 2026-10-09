"use client";

import { useState } from "react";
import { Loader2, Send, Mic, Check, Circle } from "lucide-react";

// Ruling the other options out, one at a time.
//
// Picking the right answer and knowing why the others fail are different
// skills, and the second is most of what a multiple-choice exam measures. A
// distractor exists to catch someone who half-knows the material, so naming
// what it was built to catch is the clearest evidence the half is now whole.
//
// Deliberately opt-in. It is slow, and doing it on every question would make
// a set of twenty unfinishable.

interface Props {
  prompt: string;
  choices: string[];
  correctAnswer: string;
  correctIndex: number | null;
  explanation?: string;
  onLogMiss?: (option: string) => void;
}

type Verdict = "right" | "close" | "wrong";

const VERDICT_STYLE: Record<Verdict, { color: string; label: string }> = {
  right: { color: "#3F6F5E", label: "That's the reason" },
  close: { color: "#C9A227", label: "Close" },
  wrong: { color: "var(--red)", label: "Not the reason" },
};

export function WhyWrong({ prompt, choices, correctAnswer, correctIndex, explanation, onLogMiss }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, { verdict: Verdict; reply: string }>>({});
  const [listening, setListening] = useState(false);

  const wrongOnes = choices
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => (correctIndex !== null ? i !== correctIndex : c !== correctAnswer));

  function listen() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList }) =>
      setText(t => (t ? t + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  async function submit(i: number) {
    const reasoning = text.trim();
    if (!reasoning || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/qbank/rationale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, choices, correctAnswer, explanation, target: choices[i], reasoning }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Couldn't check that."); return; }
      setResults(r => ({ ...r, [i]: { verdict: d.verdict, reply: d.reply } }));
      setText("");
      setActive(null);
      // Not knowing why a distractor fails is a gap worth drilling later.
      if (d.verdict !== "right") onLogMiss?.(choices[i]);
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!wrongOnes.length) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-semibold underline"
        style={{ color: "var(--purple)" }}
      >
        Why are the others wrong?
      </button>
    );
  }

  const answered = Object.keys(results).length;

  return (
    <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        Rule the others out
      </p>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-light)" }}>
        Say what each one was written to catch. {answered}/{wrongOnes.length} done.
      </p>

      <div className="space-y-2">
        {wrongOnes.map(({ c, i }) => {
          const r = results[i];
          const isActive = active === i;
          return (
            <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => { setActive(isActive ? null : i); setText(""); }}
                className="w-full text-left flex items-start gap-2"
              >
                {r
                  ? <Check size={13} style={{ color: VERDICT_STYLE[r.verdict].color, flexShrink: 0, marginTop: 3 }} />
                  : <Circle size={13} style={{ color: "var(--text-light)", flexShrink: 0, marginTop: 3 }} />}
                <span className="text-sm flex-1" style={{ color: "var(--text)" }}>{c}</span>
              </button>

              {r && (
                <div className="mt-2 pl-5">
                  <p className="text-xs font-semibold" style={{ color: VERDICT_STYLE[r.verdict].color }}>
                    {VERDICT_STYLE[r.verdict].label}
                  </p>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text)" }}>{r.reply}</p>
                </div>
              )}

              {isActive && !r && (
                <div className="mt-2 flex items-end gap-2 rounded-lg p-1.5"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(i); } }}
                    rows={2}
                    placeholder="Why does this one fail?"
                    className="flex-1 bg-transparent border-0 outline-none text-sm resize-none py-1 px-1"
                    style={{ color: "var(--text)" }}
                  />
                  <button onClick={listen} aria-label="Say it"
                    className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
                    style={{ background: listening ? "var(--purple)" : "var(--surface2)", color: listening ? "#fff" : "var(--text-muted)" }}>
                    <Mic size={13} />
                  </button>
                  <button onClick={() => submit(i)} disabled={busy || !text.trim()} aria-label="Check"
                    className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 disabled:opacity-40"
                    style={{ background: "var(--text)", color: "var(--surface)" }}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="text-xs mt-2" style={{ color: "var(--red)" }}>{err}</p>}
    </div>
  );
}
