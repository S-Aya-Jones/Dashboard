"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Check, Presentation, Volume2, GraduationCap, Lightbulb, Mic, Send } from "lucide-react";
import { say } from "@/lib/coachVoice";

// Being taught the lecture she missed.
//
// One idea per screen, the slide it came from beside it, and a question at the
// end of each so she finds out whether it landed while there is still time to
// do something about it. Notes assume you were taught once already; this is the
// teaching she didn't get, because the lecture streams while she is at work.

interface Check { q: string; a: string; why?: string }
interface Segment {
  title: string;
  slide?: string | null;
  analogy?: string | null;
  teach: string;
  board?: string | null;
  /** The same idea in the words the exam will use. */
  examLanguage?: string | null;
  check?: Check;
}

interface Props {
  lectureId: string;
  course: string;
  initial: string | null;
}

export function LessonView({ lectureId, course, initial }: Props) {
  const [segments, setSegments] = useState<Segment[]>(() => {
    try { return JSON.parse(initial ?? "[]"); } catch { return []; }
  });
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // The exchange for the current segment. Cleared whenever she moves on.
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(false);
  const [verdict, setVerdict] = useState<"got" | "partly" | "missed" | null>(null);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSlide, setShowSlide] = useState(false);

  const seg = segments[i];

  const build = useCallback(async (part: number) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/lesson?part=${part}`, { method: "POST" });

      // A timed-out function returns Vercel's HTML error page, not JSON, so
      // res.json() threw and every failure came out as "Couldn't reach the
      // server" — which was never true and gave her nothing to do about it.
      const raw = await res.text();
      let d: { error?: string; done?: boolean; added?: number } = {};
      try { d = JSON.parse(raw); } catch { /* not JSON — fall through to status */ }

      if (!res.ok) {
        setErr(
          d.error ??
          (res.status === 504 || res.status === 408
            ? "That part took too long to write. Tap again — it picks up from where it stopped."
            : `The server returned ${res.status}. Tap again; if it keeps happening the lecture may need re-processing.`),
        );
        return;
      }

      // Re-read rather than trusting a local merge — the server is authoritative
      // about what has been written so far.
      const fresh = await fetch(`/api/lectures/${lectureId}`, { cache: "no-store" }).then(r => r.json());
      try { setSegments(JSON.parse(fresh.lecture?.lesson ?? "[]")); } catch { /* keep what we have */ }
      if (d.done) setDone(true);
    } catch {
      setErr("Your connection dropped. Tap again — nothing already written is lost.");
    } finally {
      setBusy(false);
    }
  }, [lectureId]);

  // Keep building ahead of her rather than making her wait at the end.
  useEffect(() => {
    if (!busy && !done && segments.length > 0 && i >= segments.length - 2) {
      build(Math.floor(segments.length / 4));
    }
  }, [i, segments.length, busy, done, build]);

  function logMiss() {
    if (!seg?.check) return;
    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course, lectureId,
        question: seg.check.q,
        correct: seg.check.a,
      }),
    }).catch(() => {});
  }

  function go(next: number) {
    setI(Math.max(0, Math.min(segments.length - 1, next)));
    setRevealed(false);
    setShowSlide(false);
    setTurns([]);
    setAnswer("");
    setVerdict(null);
  }

  function listen() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: { results: SpeechRecognitionResultList }) =>
      setAnswer(a => (a ? a + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  // Her answer, in her own words, judged against the segment she just read.
  async function submit() {
    const mine = answer.trim();
    if (!mine || thinking) return;
    const next = [...turns, { role: "user" as const, content: mine }];
    setTurns(next);
    setAnswer("");
    setThinking(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/lesson/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: seg, history: turns, answer: mine }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Couldn't get a response."); return; }

      const body = d.followUp ? `${d.reply}\n\n${d.followUp}` : d.reply;
      setTurns([...next, { role: "assistant", content: body }]);
      setVerdict(d.verdict);
      // Anything short of having it goes in the error log, so it comes back.
      if (d.verdict !== "got") logMiss();
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setThinking(false);
    }
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <GraduationCap size={26} style={{ color: "var(--purple)", margin: "0 auto 0.75rem" }} />
        <p className="font-serif text-xl mb-1" style={{ color: "var(--text)" }}>Be taught this lecture</p>
        <p className="text-sm mb-5 leading-relaxed max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          One idea at a time, built up from what you already know, with the slide beside it and a
          question after each so you find out what landed. Not the transcript — the teaching.
        </p>
        <button
          onClick={() => build(0)}
          disabled={busy}
          className="text-sm font-semibold px-5 py-3 rounded-xl inline-flex items-center gap-2 disabled:opacity-40"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <GraduationCap size={15} />}
          {busy ? "Writing the lesson…" : "Teach me this lecture"}
        </button>
        {err && <p className="text-xs mt-3" style={{ color: "var(--red)" }}>{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${((i + 1) / segments.length) * 100}%`,
              background: "linear-gradient(90deg,#B4552F,#D08A4A)",
              transition: "width 300ms ease",
            }}
          />
        </div>
        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
          {i + 1} / {segments.length}{!done && busy ? " +" : ""}
        </span>
      </div>

      <div className="rounded-2xl p-5 md:p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="font-serif text-xl md:text-2xl leading-tight" style={{ color: "var(--text)" }}>
            {seg.title}
          </h2>
          <button
            onClick={() => say(`${seg.analogy ? seg.analogy + " " : ""}${seg.teach}`.slice(0, 1400))}
            aria-label="Read this aloud"
            className="p-2 rounded-lg flex-shrink-0"
            style={{ color: "var(--text-light)" }}
          >
            <Volume2 size={15} />
          </button>
        </div>

        {/* The slide it came from, alongside rather than instead. */}
        {seg.slide && (
          <div className="mb-3">
            <button
              onClick={() => setShowSlide(v => !v)}
              className="text-xs inline-flex items-center gap-1.5 underline"
              style={{ color: "var(--purple)" }}
            >
              <Presentation size={12} /> {showSlide ? "Hide the slide" : "Show the slide this came from"}
            </button>
            {showSlide && (
              <pre
                className="text-xs mt-2 p-3 rounded-xl whitespace-pre-wrap font-sans leading-relaxed"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                {seg.slide}
              </pre>
            )}
          </div>
        )}

        {seg.analogy && (
          <div
            className="rounded-xl p-4 mb-4 flex items-start gap-3"
            style={{ background: "rgba(224,164,74,0.10)", border: "1px solid rgba(224,164,74,0.35)" }}
          >
            <Lightbulb size={16} style={{ color: "#C9A227", flexShrink: 0, marginTop: 2 }} />
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text)" }}>
              {seg.analogy}
            </p>
          </div>
        )}

        <div className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
          {seg.teach}
        </div>

        {seg.examLanguage && (
          <div className="rounded-2xl px-4 py-3 mb-4"
            style={{ background: "rgba(180,85,47,0.07)", border: "1.5px solid rgba(180,85,47,0.25)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#B4552F" }}>
              How it&apos;ll be worded on the test
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{seg.examLanguage}</p>
          </div>
        )}

        {seg.board && (
          <pre
            className="text-sm mt-4 p-4 rounded-xl whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            {seg.board}
          </pre>
        )}

        {seg.check && (
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>{seg.check.q}</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-light)" }}>
              In your own words. It answers what you actually say.
            </p>

            {/* The exchange so far */}
            {turns.length > 0 && (
              <div className="space-y-2 mb-3">
                {turns.map((t, n) => (
                  <div
                    key={n}
                    className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                    style={t.role === "user"
                      ? { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", marginLeft: "12%" }
                      : { background: "rgba(180,85,47,0.06)", border: "1px solid rgba(180,85,47,0.25)", color: "var(--text)" }}
                  >
                    {t.content}
                  </div>
                ))}
                {thinking && (
                  <div className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={12} className="animate-spin" /> reading what you wrote
                  </div>
                )}
              </div>
            )}

            {verdict === "got" ? (
              <button
                onClick={() => go(i + 1)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                style={{ background: "#3F6F5E", color: "#fff" }}
              >
                <Check size={14} /> You have it — next
              </button>
            ) : (
              <div className="flex items-end gap-2 rounded-xl p-2"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  rows={2}
                  placeholder={turns.length ? "Have another go…" : "Explain it back…"}
                  className="flex-1 bg-transparent border-0 outline-none text-sm resize-none py-1.5 px-1"
                  style={{ color: "var(--text)" }}
                />
                <button
                  onClick={listen}
                  aria-label="Say it"
                  className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0"
                  style={{ background: listening ? "var(--purple)" : "var(--surface2)", color: listening ? "#fff" : "var(--text-muted)" }}
                >
                  <Mic size={15} />
                </button>
                <button
                  onClick={submit}
                  disabled={thinking || !answer.trim()}
                  aria-label="Send"
                  className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 disabled:opacity-40"
                  style={{ background: "var(--text)", color: "var(--surface)" }}
                >
                  {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            )}

            {/* An escape hatch, not the default. Using it logs the miss. */}
            {verdict !== "got" && (
              <div className="mt-2">
                {!revealed ? (
                  <button
                    onClick={() => { setRevealed(true); logMiss(); }}
                    className="text-xs underline"
                    style={{ color: "var(--text-light)" }}
                  >
                    I&apos;m stuck — show me
                  </button>
                ) : (
                  <div className="rounded-xl p-3 mt-1" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{seg.check.a}</p>
                    {seg.check.why && (
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{seg.check.why}</p>
                    )}
                    <button onClick={() => go(i + 1)} className="text-xs underline mt-2" style={{ color: "var(--purple)" }}>
                      Move on — it&apos;s in your error log
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="text-sm px-3 py-2 rounded-xl inline-flex items-center gap-1 disabled:opacity-30"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          <ChevronLeft size={14} /> Back
        </button>

        {busy && (
          <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--text-light)" }}>
            <Loader2 size={12} className="animate-spin" /> writing more
          </span>
        )}

        {i < segments.length - 1 ? (
          <button
            onClick={() => go(i + 1)}
            className="text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            Next <ChevronRight size={14} />
          </button>
        ) : done ? (
          <span className="text-xs" style={{ color: "#3F6F5E" }}>That&apos;s the lecture.</span>
        ) : (
          <button
            onClick={() => build(Math.floor(segments.length / 4))}
            disabled={busy}
            className="text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            Keep going
          </button>
        )}
      </div>

      {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
    </div>
  );
}
