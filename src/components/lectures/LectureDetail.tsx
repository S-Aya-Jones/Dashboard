"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X, RotateCcw } from "lucide-react";

interface QuizQ { q: string; choices: string[]; answer: number; explanation: string }
interface Card { front: string; back: string }

interface Lecture {
  id: string; course: string; title: string; status: string;
  transcript: string | null; summary: string | null; outline: string | null;
  conceptMap: string | null; quiz: string | null; flashcards: string | null;
}

const TABS = ["Notes", "Concept Map", "Quiz", "Flashcards", "Transcript"] as const;
type Tab = typeof TABS[number];

export function LectureDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [tab, setTab] = useState<Tab>("Notes");

  useEffect(() => {
    fetch(`/api/lectures/${id}`)
      .then(r => r.json())
      .then(d => setLecture(d.lecture ?? null));
  }, [id]);

  if (!lecture) {
    return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--purple)" }}>
        <ArrowLeft size={16} /> All lectures
      </button>

      <div>
        <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>{lecture.title}</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{lecture.course} · {lecture.summary}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-full text-sm font-semibold"
            style={tab === t
              ? { background: "var(--purple)", color: "white" }
              : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        {tab === "Notes" && <Markdown text={lecture.outline ?? ""} />}
        {tab === "Concept Map" && <MermaidView chart={lecture.conceptMap ?? ""} />}
        {tab === "Quiz" && <Quiz lectureId={lecture.id} quizJson={lecture.quiz ?? "[]"} />}
        {tab === "Flashcards" && <Flashcards json={lecture.flashcards ?? "[]"} />}
        {tab === "Transcript" && (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text)", fontFamily: "inherit" }}>
            {lecture.transcript ?? "(no transcript)"}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Minimal markdown renderer (headers / bold / bullets) ─────────────────────

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.*)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-*] (.*)$/gm, '<li class="md-li">$1</li>')
    .replace(/\n{2,}/g, "<br/>");
  return (
    <>
      <style>{`
        .md-h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; color: var(--text); }
        .md-h3 { font-size: 1.05rem; font-weight: 600; margin: 0.75rem 0 0.35rem; color: var(--text); }
        .md-li { margin-left: 1.25rem; list-style: disc; color: var(--text); line-height: 1.7; }
      `}</style>
      <div style={{ color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

// ── Mermaid concept map ──────────────────────────────────────────────────────

function MermaidView({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        const { svg } = await mermaid.render(`map-${Date.now()}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setErr(String(e).slice(0, 200));
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  if (!chart) return <p style={{ color: "var(--text-muted)" }}>No concept map generated.</p>;
  if (err) return (
    <div>
      <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Map couldn&apos;t render — raw version:</p>
      <pre className="text-xs whitespace-pre-wrap" style={{ color: "var(--text)" }}>{chart}</pre>
    </div>
  );
  return <div ref={ref} style={{ overflowX: "auto" }} />;
}

// ── Quiz with error-log integration ─────────────────────────────────────────

function Quiz({ lectureId, quizJson }: { lectureId: string; quizJson: string }) {
  const questions: QuizQ[] = (() => { try { return JSON.parse(quizJson); } catch { return []; } })();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [logged, setLogged] = useState(false);

  if (!questions.length) return <p style={{ color: "var(--text-muted)" }}>No quiz generated.</p>;

  const allAnswered = Object.keys(answers).length === questions.length;
  const misses = questions.filter((q, i) => answers[i] !== q.answer);

  async function grade() {
    setGraded(true);
    const missPayload = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => answers[i] !== q.answer)
      .map(({ q, i }) => ({
        question: q.q,
        correct: q.choices[q.answer],
        chosen: q.choices[answers[i]] ?? "(none)",
      }));
    if (missPayload.length) {
      await fetch(`/api/lectures/${lectureId}/quiz-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ misses: missPayload }),
      }).then(() => setLogged(true)).catch(() => {});
    }
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={i}>
          <p className="font-semibold mb-2" style={{ color: "var(--text)" }}>{i + 1}. {q.q}</p>
          <div className="space-y-2">
            {q.choices.map((c, ci) => {
              const chosen = answers[i] === ci;
              const correct = graded && ci === q.answer;
              const wrong = graded && chosen && ci !== q.answer;
              return (
                <button key={ci} disabled={graded}
                  onClick={() => setAnswers(a => ({ ...a, [i]: ci }))}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm flex items-center gap-2"
                  style={{
                    background: correct ? "rgba(60,180,110,0.12)" : wrong ? "rgba(220,60,60,0.10)" : chosen ? "rgba(124,92,252,0.12)" : "var(--bg)",
                    border: `1.5px solid ${correct ? "rgba(60,180,110,0.5)" : wrong ? "rgba(220,60,60,0.4)" : chosen ? "var(--purple)" : "var(--border)"}`,
                    color: "var(--text)",
                  }}>
                  {graded && correct && <Check size={16} style={{ color: "#2eaf6e" }} />}
                  {graded && wrong && <X size={16} style={{ color: "#c0392b" }} />}
                  {c}
                </button>
              );
            })}
          </div>
          {graded && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{q.explanation}</p>}
        </div>
      ))}

      {!graded ? (
        <button onClick={grade} disabled={!allAnswered}
          className="px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--purple)" }}>
          Grade it ({Object.keys(answers).length}/{questions.length} answered)
        </button>
      ) : (
        <div className="p-4 rounded-xl" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            {questions.length - misses.length}/{questions.length} correct
          </p>
          {misses.length > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {logged ? `${misses.length} missed question${misses.length > 1 ? "s" : ""} saved to your error log — they'll be waiting at exam review.` : "Saving misses to the error log…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Flashcards ───────────────────────────────────────────────────────────────

function Flashcards({ json }: { json: string }) {
  const cards: Card[] = (() => { try { return JSON.parse(json); } catch { return []; } })();
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return <p style={{ color: "var(--text-muted)" }}>No flashcards generated.</p>;
  const card = cards[idx % cards.length];

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={() => setFlipped(f => !f)}
        className="w-full max-w-xl min-h-[180px] rounded-2xl p-8 flex items-center justify-center text-center"
        style={{ background: "var(--bg)", border: "2px solid var(--purple)", color: "var(--text)" }}>
        <span className="text-lg leading-relaxed">{flipped ? card.back : card.front}</span>
      </button>
      <div className="flex items-center gap-4">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{(idx % cards.length) + 1} / {cards.length}</span>
        <button onClick={() => { setFlipped(false); setIdx(i => i + 1); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
          style={{ background: "var(--purple)" }}>
          <RotateCcw size={16} /> Next card
        </button>
      </div>
    </div>
  );
}
