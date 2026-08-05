"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, X, RotateCcw, Target, AlertTriangle, Flame,
  ZoomIn, ZoomOut, Sparkles, Trophy, Zap, Brain, ThumbsUp, ThumbsDown, Repeat,
} from "lucide-react";

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
    fetch(`/api/lectures/${id}`).then(r => r.json()).then(d => setLecture(d.lecture ?? null));
  }, [id]);

  if (!lecture) {
    return (
      <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Sparkles size={18} />
        </motion.div>
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold group"
        style={{ color: "var(--purple)" }}>
        <motion.span whileHover={{ x: -3 }}><ArrowLeft size={16} /></motion.span> All lectures
      </button>

      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7C5CFC 0%,#a855f7 55%,#ec4899 100%)", color: "white" }}>
        <motion.div
          aria-hidden
          className="absolute -right-16 -top-16 rounded-full"
          style={{ width: 220, height: 220, background: "rgba(255,255,255,.13)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        />
        <div className="relative">
          <div className="text-xs font-bold tracking-wider opacity-85 uppercase">{lecture.course}</div>
          <h2 className="font-serif text-2xl md:text-3xl mt-1 leading-tight">{lecture.title}</h2>
          {lecture.summary && <p className="text-sm mt-2 opacity-90 max-w-3xl leading-relaxed">{lecture.summary}</p>}
        </div>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="relative px-4 py-2 rounded-full text-sm font-semibold"
            style={{ color: tab === t ? "white" : "var(--text-muted)",
                     border: tab === t ? "1.5px solid transparent" : "1.5px solid var(--border)",
                     background: tab === t ? "transparent" : "var(--surface)" }}>
            {tab === t && (
              <motion.span layoutId="tabpill" className="absolute inset-0 rounded-full"
                style={{ background: "var(--purple)" }} transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl p-6 md:p-8"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          {tab === "Notes" && <NotesView text={lecture.outline ?? ""} />}
          {tab === "Exam Focus" && <ExamFocusView json={lecture.examFocus} />}
          {tab === "Concept Map" && <MermaidView chart={lecture.conceptMap ?? ""} />}
          {tab === "Quiz" && <Quiz lectureId={lecture.id} quizJson={lecture.quiz ?? "[]"} />}
          {tab === "Flashcards" && <Flashcards json={lecture.flashcards ?? "[]"} />}
          {tab === "Transcript" && (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text)", fontFamily: "inherit" }}>
              {lecture.transcript ?? "(no transcript)"}
            </pre>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Notes: reading progress, live section nav, search ────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>')
    .replace(/\[EMPHASIZED\]/g, '<span class="md-flag">⚡ emphasized</span>');
}

function renderMarkdown(src: string): { html: string; sections: string[] } {
  const lines = src.split("\n");
  const out: string[] = [];
  const sections: string[] = [];
  let i = 0, inList = false, sec = 0;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      closeList();
      const header = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim())); i++;
      }
      out.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
        header.map(h => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h3) { closeList(); out.push(`<h3 class="md-h3">${inline(h3[1])}</h3>`); }
    else if (h2 || h1) {
      closeList();
      const text = (h2 ?? h1)![1];
      sections.push(text.replace(/\*\*/g, ""));
      out.push(`<h2 class="md-h2" id="sec-${sec++}">${inline(text)}</h2>`);
    }
    else if (quote) { closeList(); out.push(`<blockquote class="md-quote">${inline(quote[1])}</blockquote>`); }
    else if (bullet) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      const ind = bullet[1].length >= 2 ? ' style="margin-left:1.25rem"' : "";
      out.push(`<li${ind}>${inline(bullet[2])}</li>`);
    }
    else if (numbered) {
      if (!inList) { out.push('<ul class="md-ul md-ol">'); inList = true; }
      out.push(`<li>${inline(numbered[1])}</li>`);
    }
    else if (line.trim() === "") closeList();
    else { closeList(); out.push(`<p class="md-p">${inline(line)}</p>`); }
    i++;
  }
  closeList();
  return { html: out.join(""), sections };
}

function NotesView({ text }: { text: string }) {
  const { html, sections } = useMemo(() => renderMarkdown(text), [text]);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [html]);

  const displayHtml = useMemo(() => {
    if (!query.trim()) return html;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return html.replace(new RegExp(`(${safe})(?![^<]*>)`, "gi"), '<mark class="md-mark">$1</mark>');
  }, [html, query]);

  if (!text) return <p style={{ color: "var(--text-muted)" }}>No notes generated.</p>;

  return (
    <>
      <style>{`
        .md-h2 { font-size:1.35rem; font-weight:700; margin:1.75rem 0 .6rem; padding-bottom:.4rem;
                 border-bottom:2px solid var(--border); color:var(--text); scroll-margin-top:1rem; }
        .md-h2:first-child { margin-top:0; }
        .md-h3 { font-size:1.08rem; font-weight:650; margin:1.15rem 0 .4rem; color:var(--purple); }
        .md-p  { color:var(--text); line-height:1.78; margin:.5rem 0; }
        .md-ul { margin:.4rem 0 .8rem 1.15rem; }
        .md-ul li { list-style:disc; color:var(--text); line-height:1.78; margin:.3rem 0; }
        .md-ol li { list-style:decimal; }
        .md-quote { border-left:3px solid var(--purple); background:rgba(124,92,252,.07);
                    padding:.7rem .9rem; margin:.8rem 0; border-radius:0 8px 8px 0;
                    color:var(--text); line-height:1.7; }
        .md-code { background:var(--bg); padding:.12rem .4rem; border-radius:4px; font-size:.9em; }
        .md-flag { display:inline-block; margin-left:.45rem; padding:.1rem .5rem; border-radius:999px;
                   background:#ffe3d0; color:#9a4a05; font-size:.68rem; font-weight:700;
                   text-transform:uppercase; letter-spacing:.03em; vertical-align:middle; }
        .md-mark { background:#fde68a; color:#1a1a2e; border-radius:3px; padding:0 .15rem; }
        .md-table-wrap { overflow-x:auto; margin:.9rem 0; }
        .md-table { border-collapse:collapse; width:100%; font-size:.9rem; }
        .md-table th { background:rgba(124,92,252,.10); color:var(--text); font-weight:700;
                       text-align:left; padding:.6rem .7rem; border:1px solid var(--border); }
        .md-table td { padding:.55rem .7rem; border:1px solid var(--border); color:var(--text); line-height:1.6; }
      `}</style>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search these notes…"
          className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {Math.round(progress)}% read
        </span>
      </div>

      <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: "var(--bg)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#7C5CFC,#ec4899)" }}
          animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
      </div>

      {sections.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {sections.map((s, i) => (
            <button key={i}
              onClick={() => bodyRef.current?.querySelector(`#sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              {s.length > 34 ? s.slice(0, 34) + "…" : s}
            </button>
          ))}
        </div>
      )}

      <div ref={bodyRef} style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: ".5rem" }}
        dangerouslySetInnerHTML={{ __html: displayHtml }} />
    </>
  );
}

// ── Exam Focus: staggered reveal, self-rating, active-recall reveals ─────────

function ExamFocusView({ json }: { json: string | null }) {
  const data: ExamFocus = (() => { try { return json ? JSON.parse(json) : {}; } catch { return {}; } })();
  const { objectives = [], highYield = [], predictedQuestions = [], traps = [] } = data;
  const [confident, setConfident] = useState<Record<number, boolean>>({});

  if (!objectives.length && !highYield.length && !predictedQuestions.length) {
    return <p style={{ color: "var(--text-muted)" }}>No exam analysis yet — press Resume on this lecture to generate it.</p>;
  }

  const readyCount = Object.values(confident).filter(Boolean).length;
  const pct = objectives.length ? Math.round((readyCount / objectives.length) * 100) : 0;

  return (
    <div className="space-y-9">
      {objectives.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Target size={18} style={{ color: "var(--purple)" }} />
              <h3 className="font-bold text-lg" style={{ color: "var(--text)" }}>What you must be able to do</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-28 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                <motion.div className="h-full" style={{ background: "linear-gradient(90deg,#7C5CFC,#2bb3a3)" }}
                  animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{readyCount}/{objectives.length} ready</span>
            </div>
          </div>
          <div className="space-y-2">
            {objectives.map((o, i) => (
              <motion.button key={i} type="button"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ x: 3 }} onClick={() => setConfident(c => ({ ...c, [i]: !c[i] }))}
                className="w-full flex gap-3 text-sm leading-relaxed text-left rounded-xl px-3 py-2.5"
                style={{
                  background: confident[i] ? "rgba(43,179,163,.10)" : "var(--bg)",
                  border: `1.5px solid ${confident[i] ? "rgba(43,179,163,.5)" : "var(--border)"}`,
                  color: "var(--text)",
                }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                  style={{ background: confident[i] ? "#2bb3a3" : "var(--purple)" }}>
                  {confident[i] ? "✓" : i + 1}
                </span>
                <span>{o}</span>
              </motion.button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Tap one when you can actually do it.</p>
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
              <motion.div key={i} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }} whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(124,92,252,.16)" }}
                className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
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
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {predictedQuestions.length > 0 && (
        <section>
          <h3 className="font-bold text-lg mb-1" style={{ color: "var(--text)" }}>Questions you should be ready for</h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Answer it in your head first — then reveal the key.</p>
          <div className="space-y-3">
            {predictedQuestions.map((q, i) => <PredictedQ key={i} q={q} index={i} />)}
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
              <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="text-sm leading-relaxed rounded-lg px-3 py-2"
                style={{ background: "rgba(220,60,60,0.06)", border: "1px solid rgba(220,60,60,0.2)", color: "var(--text)" }}>
                {t}
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PredictedQ({ q, index }: { q: NonNullable<ExamFocus["predictedQuestions"]>[number]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
      <p className="font-medium text-sm leading-relaxed" style={{ color: "var(--text)" }}>
        {q.question}
        {q.type && <span className="ml-2 text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>{q.type}</span>}
      </p>
      <button onClick={() => setOpen(o => !o)}
        className="mt-2 text-xs font-bold inline-flex items-center gap-1.5" style={{ color: "var(--purple)" }}>
        <Brain size={13} /> {open ? "Hide" : "Reveal what full credit needs"}
      </button>
      <AnimatePresence initial={false}>
        {open && q.howToAnswer && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="text-xs mt-2 leading-relaxed overflow-hidden" style={{ color: "var(--text-muted)" }}>
            {q.howToAnswer}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Concept map: pan, zoom, node spotlight ──────────────────────────────────

function MermaidView({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false, theme: "base", securityLevel: "loose",
          flowchart: { curve: "basis", nodeSpacing: 45, rankSpacing: 62, padding: 12, useMaxWidth: false },
          themeVariables: {
            fontFamily: "inherit", fontSize: "14px",
            primaryColor: "#efeafd", primaryTextColor: "#1a1a2e", primaryBorderColor: "#7C5CFC",
            lineColor: "#9b8fd6", secondaryColor: "#e8ecff", tertiaryColor: "#f7f5ff",
            clusterBkg: "#faf9ff", clusterBorder: "#d9d2f5",
          },
        });
        const { svg } = await mermaid.render(`map-${Math.random().toString(36).slice(2)}`, chart);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        // Spotlight a node and its edges on hover
        ref.current.querySelectorAll<SVGGElement>("g.node").forEach(node => {
          node.style.cursor = "pointer";
          node.style.transition = "transform .15s, filter .15s";
          node.addEventListener("mouseenter", () => {
            node.style.transform = "scale(1.06)";
            node.style.filter = "drop-shadow(0 4px 12px rgba(124,92,252,.45))";
          });
          node.addEventListener("mouseleave", () => {
            node.style.transform = ""; node.style.filter = "";
          });
        });
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

  const btn = { background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="p-2 rounded-lg" style={btn}><ZoomOut size={15} /></button>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="p-2 rounded-lg" style={btn}><ZoomIn size={15} /></button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-3 py-2 rounded-lg text-xs font-semibold" style={btn}>Reset</button>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>drag to pan · hover a node to focus</span>
      </div>
      <div
        onMouseDown={e => { drag.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y }; }}
        onMouseMove={e => {
          if (!drag.current) return;
          setPan({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
        }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        style={{ overflow: "hidden", height: "72vh", background: "var(--bg)", borderRadius: 12,
                 border: "1px solid var(--border)", cursor: drag.current ? "grabbing" : "grab" }}>
        <motion.div ref={ref}
          animate={{ scale: zoom, x: pan.x, y: pan.y }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ transformOrigin: "top left", padding: "1.25rem" }} />
      </div>
    </div>
  );
}

// ── Quiz: streaks, timer, animated feedback, score reveal ───────────────────

function Quiz({ lectureId, quizJson }: { lectureId: string; quizJson: string }) {
  const questions: QuizQ[] = (() => { try { return JSON.parse(quizJson); } catch { return []; } })();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [done, setDone] = useState(false);
  const [logged, setLogged] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  if (!questions.length) return <p style={{ color: "var(--text-muted)" }}>No quiz generated.</p>;

  const q = questions[i];
  const correct = picked !== null && picked === q.answer;

  function choose(ci: number) {
    if (picked !== null) return;
    setPicked(ci);
    setAnswers(a => ({ ...a, [i]: ci }));
    if (ci === q.answer) {
      setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
    } else setStreak(0);
  }

  async function next() {
    if (i + 1 < questions.length) { setI(i + 1); setPicked(null); return; }
    setDone(true);
    const misses = questions
      .map((qq, idx) => ({ qq, idx }))
      .filter(({ qq, idx }) => answers[idx] !== qq.answer)
      .map(({ qq, idx }) => ({
        question: qq.q, correct: qq.choices[qq.answer], chosen: qq.choices[answers[idx]] ?? "(none)",
      }));
    if (misses.length) {
      await fetch(`/api/lectures/${lectureId}/quiz-result`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ misses }),
      }).then(() => setLogged(true)).catch(() => {});
    } else setLogged(true);
  }

  const score = questions.filter((qq, idx) => answers[idx] === qq.answer).length;
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }} className="inline-block mb-3">
          <Trophy size={54} style={{ color: pct >= 80 ? "#e8b52c" : pct >= 60 ? "var(--purple)" : "var(--text-muted)" }} />
        </motion.div>
        <h3 className="font-serif text-3xl" style={{ color: "var(--text)" }}>{score} / {questions.length}</h3>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {pct}% · best streak {best} · {mins}m {secs}s
        </p>
        <p className="text-sm mt-4 max-w-md mx-auto leading-relaxed" style={{ color: "var(--text)" }}>
          {pct >= 90 ? "You know this cold. Move on to the next lecture."
            : pct >= 70 ? "Solid. Review the misses in your error log and re-take before the exam."
            : "This one needs another pass — go back to the notes, then retake."}
        </p>
        {logged && score < questions.length && (
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            {questions.length - score} missed question{questions.length - score > 1 ? "s" : ""} saved to your error log.
          </p>
        )}
        <button onClick={() => { setI(0); setPicked(null); setAnswers({}); setStreak(0); setDone(false); setElapsed(0); }}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: "var(--purple)" }}>
          <Repeat size={16} /> Retake
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          Question {i + 1} of {questions.length}
        </span>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {streak >= 2 && (
              <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#ffe3d0", color: "#9a4a05" }}>
                <Zap size={12} /> {streak} streak
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="h-1.5 rounded-full mb-6 overflow-hidden" style={{ background: "var(--bg)" }}>
        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#7C5CFC,#ec4899)" }}
          animate={{ width: `${((i + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
          <p className="font-semibold mb-4 leading-relaxed text-[15px]" style={{ color: "var(--text)" }}>{q.q}</p>
          <div className="space-y-2.5">
            {q.choices.map((c, ci) => {
              const isAnswer = picked !== null && ci === q.answer;
              const isWrongPick = picked === ci && ci !== q.answer;
              return (
                <motion.button key={ci} onClick={() => choose(ci)} disabled={picked !== null}
                  whileHover={picked === null ? { x: 4 } : undefined}
                  animate={isWrongPick ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 leading-relaxed"
                  style={{
                    background: isAnswer ? "rgba(43,179,163,.13)" : isWrongPick ? "rgba(220,60,60,.10)" : "var(--bg)",
                    border: `1.5px solid ${isAnswer ? "rgba(43,179,163,.6)" : isWrongPick ? "rgba(220,60,60,.45)" : "var(--border)"}`,
                    color: "var(--text)",
                  }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                    style={{ background: isAnswer ? "#2bb3a3" : isWrongPick ? "#c0392b" : "var(--surface)",
                             color: isAnswer || isWrongPick ? "white" : "var(--text-muted)",
                             border: isAnswer || isWrongPick ? "none" : "1px solid var(--border)" }}>
                    {isAnswer ? <Check size={12} /> : isWrongPick ? <X size={12} /> : String.fromCharCode(65 + ci)}
                  </span>
                  <span>{c}</span>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {picked !== null && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden">
                <div className="mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{ background: correct ? "rgba(43,179,163,.08)" : "rgba(220,60,60,.06)",
                           border: `1px solid ${correct ? "rgba(43,179,163,.3)" : "rgba(220,60,60,.25)"}`,
                           color: "var(--text)" }}>
                  <span className="font-bold" style={{ color: correct ? "#1e8a7e" : "#c0392b" }}>
                    {correct ? "Correct. " : "Not quite. "}
                  </span>
                  {q.explanation}
                </div>
                <button onClick={next}
                  className="mt-4 w-full py-3 rounded-xl font-semibold text-white"
                  style={{ background: "var(--purple)" }}>
                  {i + 1 < questions.length ? "Next question →" : "See results"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Flashcards: 3D flip, confidence sorting, session summary ────────────────

function Flashcards({ json }: { json: string }) {
  const cards: Card[] = (() => { try { return JSON.parse(json); } catch { return []; } })();
  const [queue, setQueue] = useState<number[]>(() => cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<number[]>([]);
  const [rounds, setRounds] = useState(0);

  if (!cards.length) return <p style={{ color: "var(--text-muted)" }}>No flashcards generated.</p>;

  if (queue.length === 0) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
        <Trophy size={48} style={{ color: "#e8b52c" }} className="mx-auto mb-3" />
        <h3 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Deck cleared</h3>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          All {cards.length} cards marked known{rounds > 0 ? ` · ${rounds} repeat${rounds > 1 ? "s" : ""} along the way` : ""}.
        </p>
        <button onClick={() => { setQueue(cards.map((_, i) => i)); setKnown([]); setRounds(0); setFlipped(false); }}
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: "var(--purple)" }}>
          <Repeat size={16} /> Run the deck again
        </button>
      </motion.div>
    );
  }

  const cardIdx = queue[0];
  const card = cards[cardIdx];
  const progress = Math.round((known.length / cards.length) * 100);

  function rate(gotIt: boolean) {
    setFlipped(false);
    if (gotIt) {
      setKnown(k => [...k, cardIdx]);
      setQueue(q => q.slice(1));
    } else {
      setRounds(r => r + 1);
      setQueue(q => [...q.slice(1), cardIdx]); // back of the deck
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
          <span>{known.length} known · {queue.length} left</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#7C5CFC,#2bb3a3)" }}
            animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>

      {/* One face rendered at a time — no backface-visibility, so the two
          sides can never overlap and the card grows with long answers */}
      <div style={{ perspective: 1400 }} className="w-full max-w-xl">
        <motion.div
          onClick={() => setFlipped(f => !f)}
          animate={{ rotateY: flipped ? 360 : 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 22 }}
          className="rounded-2xl cursor-pointer"
          style={{
            minHeight: 230,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: ".75rem", padding: "2rem", textAlign: "center",
            background: flipped
              ? "linear-gradient(135deg,rgba(124,92,252,.13),rgba(236,72,153,.10))"
              : "var(--bg)",
            border: "2px solid var(--purple)",
          }}>
          <AnimatePresence mode="wait">
            <motion.div key={flipped ? "back" : "front"}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: flipped ? "var(--purple)" : "var(--text-muted)" }}>
                {flipped ? "Answer" : "Question"}
              </span>
              <span className="text-lg leading-relaxed" style={{ color: "var(--text)" }}>
                {flipped ? card.back : card.front}
              </span>
              {!flipped && <span className="text-xs" style={{ color: "var(--text-muted)" }}>tap to flip</span>}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="flex gap-3">
            <button onClick={() => rate(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: "rgba(220,60,60,.09)", border: "1.5px solid rgba(220,60,60,.35)", color: "#c0392b" }}>
              <ThumbsDown size={15} /> Again
            </button>
            <button onClick={() => rate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: "#2bb3a3" }}>
              <ThumbsUp size={15} /> Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
