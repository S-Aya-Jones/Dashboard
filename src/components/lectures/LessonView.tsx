"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Check, X, Presentation, Volume2, GraduationCap } from "lucide-react";
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
  teach: string;
  board?: string | null;
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
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Couldn't build the lesson."); return; }

      // Re-read rather than trusting a local merge — the server is authoritative
      // about what has been written so far.
      const fresh = await fetch(`/api/lectures/${lectureId}`, { cache: "no-store" }).then(r => r.json());
      try { setSegments(JSON.parse(fresh.lecture?.lesson ?? "[]")); } catch { /* keep what we have */ }
      if (d.done) setDone(true);
    } catch {
      setErr("Couldn't reach the server.");
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
            onClick={() => say(seg.teach.slice(0, 1200))}
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

        <div className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
          {seg.teach}
        </div>

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
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{seg.check.q}</p>

            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Show me
              </button>
            ) : (
              <>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{seg.check.a}</p>
                {seg.check.why && (
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{seg.check.why}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => go(i + 1)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                    style={{ background: "#3F6F5E", color: "#fff" }}
                  >
                    <Check size={14} /> I had that
                  </button>
                  <button
                    onClick={() => { logMiss(); go(i + 1); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                    style={{ background: "var(--surface2)", color: "var(--red)", border: "1px solid var(--border)" }}
                  >
                    <X size={14} /> I didn&apos;t
                  </button>
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-light)" }}>
                  &quot;I didn&apos;t&quot; puts it in your error log, so it comes back.
                </p>
              </>
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
