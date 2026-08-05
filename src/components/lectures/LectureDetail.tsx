"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X, RotateCcw, Target, AlertTriangle, Flame, Maximize2 } from "lucide-react";

interface QuizQ { q: string; choices: string[]; answer: number; explanation: string; difficulty?: string }
interface Card { front: string; back: string }
interface ExamFocus {
  objectives?: string[];
  highYield?: Array<{ topic: string; why: string; confidence?: string }>;
  predictedQuestions?: Array<{ question: string; type?: string; howToAnswer?: string }>;
  traps?: string[];
}

interface Lecture {
  id: string; course: string; title: string; status: string;
  transcript: string | null; summary: string | null; outline: string | null;
  conceptMap: string | null; quiz: string | null; flashcards: string | null;
  examFocus: string | null;
}

const TABS = ["Notes", "Exam Focus", "Concept Map", "Quiz", "Flashcards", "Transcript"] as const;
type Tab = typeof TABS[number];

export function LectureDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [tab, setTab] = useState<Tab>("Notes");

  useEffect(() => {
    fetch(`/api/lectures/${id}`)
      .then(r => r.json())
      .then(d => setLecture(d.lecture ?? null));
  }, [id]);

  if (!lecture) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--purple)" }}>
        <ArrowLeft size={16} /> All lectures
      </button>

      <div className="rounded-2xl p-6" style={{ background: "var(--grad, var(--purple))", color: "white" }}>
        <div className="text-xs font-bold tracking-wider opacity-80 uppercase">{lecture.course}</div>
        <h2 className="font-serif text-2xl md:text-3xl mt-1 leading-tight">{lecture.title}</h2>
        {lecture.summary && <p className="text-sm mt-2 opacity-90 max-w-3xl leading-relaxed">{lecture.summary}</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={tab === t
              ? { background: "var(--purple)", color: "white" }
              : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6 md:p-8" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        {tab === "Notes" && <Markdown text={lecture.outline ?? ""} />}
        {tab === "Exam Focus" && <ExamFocusView json={lecture.examFocus} />}
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

// ── Markdown: headings, tables, lists, blockquotes, emphasis callouts ────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>')
    .replace(/\[EMPHASIZED\]/g, '<span class="md-flag">emphasized in lecture</span>');
}

function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  let inList = false;

  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  while (i < lines.length) {
    const line = lines[i];

    // table block
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      closeList();
      const header = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim()));
        i++;
      }
      out.push(
        '<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
        header.map(h => `<th>${inline(h)}</th>`).join("") +
        "</tr></thead><tbody>" +
        rows.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table></div>"
      );
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h3) { closeList(); out.push(`<h3 class="md-h3">${inline(h3[1])}</h3>`); }
    else if (h2) { closeList(); out.push(`<h2 class="md-h2">${inline(h2[1])}</h2>`); }
    else if (h1) { closeList(); out.push(`<h2 class="md-h2">${inline(h1[1])}</h2>`); }
    else if (quote) { closeList(); out.push(`<blockquote class="md-quote">${inline(quote[1])}</blockquote>`); }
    else if (bullet) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      const indent = bullet[1].length >= 2 ? ' style="margin-left:1.25rem"' : "";
      out.push(`<li${indent}>${inline(bullet[2])}</li>`);
    }
    else if (numbered) {
      if (!inList) { out.push('<ul class="md-ul md-ol">'); inList = true; }
      out.push(`<li>${inline(numbered[1])}</li>`);
    }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); out.push(`<p class="md-p">${inline(line)}</p>`); }
    i++;
  }
  closeList();
  return out.join("");
}

function Markdown({ text }: { text: string }) {
  if (!text) return <p style={{ color: "var(--text-muted)" }}>No notes generated.</p>;
  return (
    <>
      <style>{`
        .md-h2 { font-size:1.35rem; font-weight:700; margin:1.75rem 0 .6rem; padding-bottom:.4rem;
                 border-bottom:2px solid var(--border); color:var(--text); }
        .md-h2:first-child { margin-top:0; }
        .md-h3 { font-size:1.08rem; font-weight:650; margin:1.15rem 0 .4rem; color:var(--purple); }
        .md-p  { color:var(--text); line-height:1.75; margin:.5rem 0; }
        .md-ul { margin:.4rem 0 .8rem 1.15rem; }
        .md-ul li { list-style:disc; color:var(--text); line-height:1.75; margin:.3rem 0; }
        .md-ol li { list-style:decimal; }
        .md-quote { border-left:3px solid var(--purple); background:rgba(124,92,252,.07);
                    padding:.7rem .9rem; margin:.8rem 0; border-radius:0 8px 8px 0;
                    color:var(--text); line-height:1.7; }
        .md-code { background:var(--bg); padding:.12rem .4rem; border-radius:4px; font-size:.9em; }
        .md-flag { display:inline-block; margin-left:.45rem; padding:.1rem .5rem; border-radius:999px;
                   background:#ffe3d0; color:#9a4a05; font-size:.68rem; font-weight:700;
                   text-transform:uppercase; letter-spacing:.03em; vertical-align:middle; }
        .md-table-wrap { overflow-x:auto; margin:.9rem 0; }
        .md-table { border-collapse:collapse; width:100%; font-size:.9rem; }
        .md-table th { background:rgba(124,92,252,.10); color:var(--text); font-weight:700;
                       text-align:left; padding:.6rem .7rem; border:1px solid var(--border); }
        .md-table td { padding:.55rem .7rem; border:1px solid var(--border); color:var(--text); line-height:1.6; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
    </>
  );
}

// ── Exam Focus ───────────────────────────────────────────────────────────────

function ExamFocusView({ json }: { json: string | null }) {
  const data: ExamFocus = (() => { try { return json ? JSON.parse(json) : {}; } catch { return {}; } })();
  const { objectives = [], highYield = [], predictedQuestions = [], traps = [] } = data;

  if (!objectives.length && !highYield.length && !predictedQuestions.length) {
    return <p style={{ color: "var(--text-muted)" }}>No exam analysis yet — press Resume on this lecture to generate it.</p>;
  }

  return (
    <div className="space-y-8">
      {objectives.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} style={{ color: "var(--purple)" }} />
            <h3 className="font-bold text-lg" style={{ color: "var(--text)" }}>What you&apos;re expected to be able to do</h3>
          </div>
          <ul className="space-y-2">
            {objectives.map((o, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                  style={{ background: "var(--purple)" }}>{i + 1}</span>
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      {highYield.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flame size={18} style={{ color: "#e8842c" }} />
            <h3 className="font-bold text-lg" style={{ color: "var(--text)" }}>High-yield — most likely tested</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {highYield.map((h, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{h.topic}</span>
                  {h.confidence && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                      style={h.confidence.toLowerCase() === "high"
                        ? { background: "#ffe3d0", color: "#9a4a05" }
                        : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {h.confidence}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{h.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {predictedQuestions.length > 0 && (
        <section>
          <h3 className="font-bold text-lg mb-3" style={{ color: "var(--text)" }}>Questions you should be ready for</h3>
          <div className="space-y-3">
            {predictedQuestions.map((q, i) => (
              <details key={i} className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
                <summary className="cursor-pointer font-medium text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                  {q.question}
                  {q.type && <span className="ml-2 text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>{q.type}</span>}
                </summary>
                {q.howToAnswer && (
                  <p className="text-xs mt-3 pt-3 leading-relaxed" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                    <strong style={{ color: "var(--purple)" }}>Full credit needs: </strong>{q.howToAnswer}
                  </p>
                )}
              </details>
            ))}
          </div>
        </section>
      )}

      {traps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: "#c0392b" }} />
            <h3 className="font-bold text-lg" style={{ color: "var(--text)" }}>Traps students fall for</h3>
          </div>
          <ul className="space-y-2">
            {traps.map((t, i) => (
              <li key={i} className="text-sm leading-relaxed rounded-lg px-3 py-2"
                style={{ background: "rgba(220,60,60,0.06)", border: "1px solid rgba(220,60,60,0.2)", color: "var(--text)" }}>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Concept map ──────────────────────────────────────────────────────────────

function MermaidView({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          flowchart: { curve: "basis", nodeSpacing: 45, rankSpacing: 60, padding: 12, useMaxWidth: false },
          themeVariables: {
            fontFamily: "inherit",
            fontSize: "14px",
            primaryColor: "#efeafd",
            primaryTextColor: "#1a1a2e",
            primaryBorderColor: "#7C5CFC",
            lineColor: "#9b8fd6",
            secondaryColor: "#e8ecff",
            tertiaryColor: "#f7f5ff",
            clusterBkg: "#faf9ff",
            clusterBorder: "#d9d2f5",
          },
        });
        const { svg } = await mermaid.render(`map-${Math.random().toString(36).slice(2)}`, chart);
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Maximize2 size={14} style={{ color: "var(--text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Zoom</span>
        <input type="range" min="0.6" max="2.2" step="0.1" value={zoom}
          onChange={e => setZoom(Number(e.target.value))} className="w-40" />
      </div>
      <div style={{ overflow: "auto", maxHeight: "72vh", background: "var(--bg)", borderRadius: 12, padding: "1rem" }}>
        <div ref={ref} style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform .15s" }} />
      </div>
    </div>
  );
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

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
    <div className="space-y-7">
      {questions.map((q, i) => (
        <div key={i}>
          <p className="font-semibold mb-2.5 leading-relaxed" style={{ color: "var(--text)" }}>{i + 1}. {q.q}</p>
          <div className="space-y-2">
            {q.choices.map((c, ci) => {
              const chosen = answers[i] === ci;
              const correct = graded && ci === q.answer;
              const wrong = graded && chosen && ci !== q.answer;
              return (
                <button key={ci} disabled={graded}
                  onClick={() => setAnswers(a => ({ ...a, [i]: ci }))}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm flex items-start gap-2 leading-relaxed"
                  style={{
                    background: correct ? "rgba(60,180,110,0.12)" : wrong ? "rgba(220,60,60,0.10)" : chosen ? "rgba(124,92,252,0.12)" : "var(--bg)",
                    border: `1.5px solid ${correct ? "rgba(60,180,110,0.5)" : wrong ? "rgba(220,60,60,0.4)" : chosen ? "var(--purple)" : "var(--border)"}`,
                    color: "var(--text)",
                  }}>
                  {graded && correct && <Check size={16} style={{ color: "#2eaf6e", flexShrink: 0, marginTop: 2 }} />}
                  {graded && wrong && <X size={16} style={{ color: "#c0392b", flexShrink: 0, marginTop: 2 }} />}
                  <span>{c}</span>
                </button>
              );
            })}
          </div>
          {graded && (
            <p className="text-xs mt-2.5 leading-relaxed rounded-lg px-3 py-2"
              style={{ color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)" }}>
              {q.explanation}
            </p>
          )}
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
        className="w-full max-w-xl min-h-[200px] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3"
        style={{
          background: flipped ? "rgba(124,92,252,0.07)" : "var(--bg)",
          border: "2px solid var(--purple)", color: "var(--text)",
        }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {flipped ? "Answer" : "Question"}
        </span>
        <span className="text-lg leading-relaxed">{flipped ? card.back : card.front}</span>
        {!flipped && <span className="text-xs" style={{ color: "var(--text-muted)" }}>tap to reveal</span>}
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
