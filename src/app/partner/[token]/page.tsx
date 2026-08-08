"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, Sparkles, RefreshCw } from "lucide-react";

// What Deandra and Erickson see. Nothing else in the app is reachable from
// here — this page talks to one endpoint that can only return study material.

interface Question {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface Lecture {
  id: string; title: string; quiz: string; flashcards: string; examFocus: string | null;
}

interface Payload {
  partner: { name: string; role: "quizmaster" | "accountability"; mediaId: string | null; seeScores: boolean };
  courses: { course: string; lectures: number }[];
  lectures?: Lecture[];
  weakSpots?: { question: string; correct: string | null; chosen: string | null }[];
  recentWork?: { course: string; title: string; at: string }[];
  error?: string;
}

export default function PartnerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData]       = useState<Payload | null>(null);
  const [course, setCourse]   = useState("");
  const [lectureId, setLectureId] = useState("");
  const [queue, setQueue]     = useState<Question[]>([]);
  const [i, setI]             = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [asked, setAsked]     = useState<string[]>([]);
  const [tally, setTally]     = useState({ right: 0, wrong: 0 });

  const load = useCallback(async (c: string) => {
    const url = `/api/partner/${token}` + (c ? `?course=${encodeURIComponent(c)}` : "");
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) { setErr(body.error ?? "This link isn't working."); return; }
    setData(body);
    setErr(null);
  }, [token]);

  useEffect(() => { load(""); }, [load]);
  useEffect(() => { if (course) load(course); }, [course, load]);

  const lectures = data?.lectures ?? [];
  const current = queue[i];

  async function generate() {
    if (!lectureId) { setErr("Pick a lecture first."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/partner/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, alreadyAsked: asked }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't get more questions");
      setQueue((q) => [...q, ...body.questions]);
      setAsked((a) => [...a, ...body.questions.map((q: Question) => q.question)]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't get more questions");
    } finally {
      setBusy(false);
    }
  }

  async function mark(gotIt: boolean) {
    if (!current) return;
    setTally((t) => ({ right: t.right + (gotIt ? 1 : 0), wrong: t.wrong + (gotIt ? 0 : 1) }));

    if (!gotIt) {
      // Feeds her error log, which is what her tutor drills from later.
      fetch(`/api/partner/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course, lectureId,
          question: current.question,
          correct: current.options[current.answer],
        }),
      }).catch(() => {});
    }

    setRevealed(false);
    const next = i + 1;
    setI(next);
    // Keep the session going without her partner having to ask.
    if (next >= queue.length - 1 && !busy) generate();
  }

  if (err && !data) {
    return (
      <main className="min-h-screen grid place-items-center p-6" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{err}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="animate-spin" style={{ color: "var(--purple)" }} />
      </main>
    );
  }

  const p = data.partner;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        <header className="flex items-center gap-4">
          {p.mediaId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${p.mediaId}`}
              alt={p.name}
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: 60, height: 60, border: "2px solid var(--purple)" }}
            />
          ) : (
            <div
              className="rounded-full grid place-items-center flex-shrink-0 font-serif text-2xl"
              style={{ width: 60, height: 60, background: "var(--surface2)", color: "var(--purple)", border: "2px solid var(--purple)" }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Hey {p.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {p.role === "quizmaster"
                ? "You're quizzing Aya today. She can't see the answers — you can."
                : "Here's how Aya's studying been going."}
            </p>
          </div>
        </header>

        {p.role === "accountability" ? (
          <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Recent work
            </p>
            {(data.recentWork ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing logged yet.</p>
            ) : (
              <div className="space-y-2">
                {(data.recentWork ?? []).map((r, n) => (
                  <div key={n} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm" style={{ color: "var(--text)" }}>{r.title}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-light)" }}>
                      {r.course} · {new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
              <div className="grid sm:grid-cols-2 gap-2">
                <select value={course} onChange={(e) => { setCourse(e.target.value); setLectureId(""); setQueue([]); setI(0); setAsked([]); }}>
                  <option value="">Pick a subject…</option>
                  {data.courses.map((c) => (
                    <option key={c.course} value={c.course}>{c.course} ({c.lectures})</option>
                  ))}
                </select>
                <select value={lectureId} onChange={(e) => { setLectureId(e.target.value); setQueue([]); setI(0); setAsked([]); }} disabled={!lectures.length}>
                  <option value="">Pick a lecture…</option>
                  {lectures.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              {(tally.right > 0 || tally.wrong > 0) && (
                <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {tally.right} right · {tally.wrong} to come back to
                </p>
              )}
            </div>

            {current ? (
              <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>
                  Question {i + 1} — read this out
                </p>
                <p className="text-lg leading-relaxed" style={{ color: "var(--text)" }}>{current.question}</p>

                <div className="space-y-2">
                  {current.options.map((o, n) => {
                    const isAnswer = n === current.answer;
                    return (
                      <div
                        key={n}
                        className="px-3 py-2.5 rounded-xl text-sm"
                        style={{
                          background: revealed && isAnswer ? "rgba(63,111,94,0.14)" : "var(--surface2)",
                          border: `1px solid ${revealed && isAnswer ? "#3F6F5E" : "var(--border)"}`,
                          color: "var(--text)",
                        }}
                      >
                        <span style={{ color: "var(--text-light)" }}>{String.fromCharCode(65 + n)}. </span>
                        {o}
                        {revealed && isAnswer && <span className="ml-2 text-xs font-bold" style={{ color: "#3F6F5E" }}>correct</span>}
                      </div>
                    );
                  })}
                </div>

                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className="w-full py-3 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    Show me the answer
                  </button>
                ) : (
                  <>
                    {current.explanation && (
                      <p className="text-sm leading-relaxed rounded-xl px-4 py-3" style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
                        {current.explanation}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => mark(true)}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: "#3F6F5E", color: "#fff" }}
                      >
                        <Check size={15} /> She got it
                      </button>
                      <button
                        onClick={() => mark(false)}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: "var(--surface2)", color: "var(--red)", border: "1px solid var(--border)" }}
                      >
                        <X size={15} /> Not quite
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                  {lectureId ? "Ready when you are." : "Pick a subject and a lecture to start."}
                </p>
                <button
                  onClick={generate}
                  disabled={busy || !lectureId}
                  className="text-sm font-semibold px-5 py-3 rounded-xl disabled:opacity-40 inline-flex items-center gap-2"
                  style={{ background: "var(--text)", color: "var(--surface)" }}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {busy ? "Writing questions…" : "Start the session"}
                </button>
              </div>
            )}

            {queue.length > 0 && (
              <button
                onClick={generate}
                disabled={busy}
                className="text-xs font-semibold px-4 py-2 rounded-full inline-flex items-center gap-1.5 disabled:opacity-40"
                style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                <RefreshCw size={11} /> More questions
              </button>
            )}

            {p.seeScores && (data.weakSpots ?? []).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Push her on these
                </p>
                <ul className="space-y-1.5">
                  {(data.weakSpots ?? []).slice(0, 8).map((w, n) => (
                    <li key={n} className="text-sm leading-snug" style={{ color: "var(--text-muted)" }}>{w.question}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
      </div>
    </main>
  );
}
