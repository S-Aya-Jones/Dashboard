"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Filter, Layers, AlertTriangle, Repeat, Play } from "lucide-react";
import { QuestionRunner, BankQuestion, FORMAT_LABEL } from "./QuestionRunner";

interface Meta {
  byCourse: Array<{ course: string; total: number }>;
  byFormat: Array<{ format: string; total: number }>;
  attempts: { total: number; correct: number };
  weakTopics: Array<{ course: string; topic: string; misses: number; seen: number }>;
  lectures: Array<{ id: string; title: string; course: string; questions: number }>;
}

const FORMATS = ["mcq", "sata", "order", "match", "data", "short", "trace"];

export function QBankView() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [course, setCourse] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [format, setFormat] = useState("");
  const [missedOnly, setMissedOnly] = useState(false);
  const [count, setCount] = useState(15);

  const [session, setSession] = useState<BankQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/qbank?meta=1");
      setMeta(await res.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  async function start() {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ limit: String(count) });
      if (course) p.set("course", course);
      if (lectureId) p.set("lecture", lectureId);
      if (format) p.set("format", format);
      if (missedOnly) p.set("missed", "1");
      const res = await fetch(`/api/qbank?${p}`);
      const d = await res.json();
      if (!d.questions?.length) {
        setErr("No questions match those filters yet. Generate a bank from a lecture in Lecture Studio first.");
        return;
      }
      setSession(d.questions);
      setI(0); setResults([]); setStreak(0); setBest(0);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleResult(correct: boolean, chosenLabel: string) {
    const q = session![i];
    setResults(r => [...r, correct]);
    if (correct) setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
    else setStreak(0);
    fetch("/api/qbank/attempt", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: q.id, correct, course: q.course, lectureId: q.lectureId,
        prompt: q.prompt, answer: q.answer, chosen: chosenLabel,
      }),
    }).catch(() => {});
  }

  const totalQuestions = meta?.byCourse.reduce((s, c) => s + c.total, 0) ?? 0;
  const acc = meta && meta.attempts.total > 0
    ? Math.round((meta.attempts.correct / meta.attempts.total) * 100) : null;

  // ── session finished ──
  if (session && i >= session.length) {
    const score = results.filter(Boolean).length;
    const pct = Math.round((score / results.length) * 100);
    return (
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }} className="inline-block mb-3">
          <Trophy size={54} style={{ color: pct >= 80 ? "#e8b52c" : pct >= 60 ? "var(--purple)" : "var(--text-muted)" }} />
        </motion.div>
        <h3 className="font-serif text-3xl" style={{ color: "var(--text)" }}>{score} / {results.length}</h3>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{pct}% · best streak {best}</p>
        <p className="text-sm mt-4 max-w-md mx-auto leading-relaxed" style={{ color: "var(--text)" }}>
          {pct >= 85 ? "Strong. Switch to a different format or lecture to keep it hard."
            : pct >= 65 ? "Getting there. Run a missed-only session next to close the gaps."
            : "Go back to the notes for this topic, then come back and run it again."}
        </p>
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <button onClick={() => { setSession(null); loadMeta(); }}
            className="px-6 py-3 rounded-xl font-semibold" style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}>
            Back to bank
          </button>
          <button onClick={() => { setMissedOnly(true); setSession(null); loadMeta(); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white" style={{ background: "var(--purple)" }}>
            <Repeat size={16} /> Drill my misses
          </button>
        </div>
      </motion.div>
    );
  }

  // ── in a session ──
  if (session) {
    const q = session[i];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => { setSession(null); loadMeta(); }} className="text-sm font-semibold" style={{ color: "var(--purple)" }}>
            ← End session
          </button>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {streak >= 2 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#ffe3d0", color: "#9a4a05" }}>
                  <Zap size={12} /> {streak} streak
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              {i + 1} / {session.length}
            </span>
          </div>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#B4552F,#ec4899)" }}
            animate={{ width: `${(i / session.length) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            className="rounded-2xl p-6 md:p-8" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            <QuestionRunner q={q} onResult={handleResult} showNext onNext={() => setI(n => n + 1)} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── bank home ──
  const lecturesForCourse = (meta?.lectures ?? []).filter(l => !course || l.course === course);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Layers size={18} />} label="Questions in bank" value={String(totalQuestions)} />
        <Stat icon={<Trophy size={18} />} label="Overall accuracy" value={acc === null ? "—" : `${acc}%`} />
        <Stat icon={<AlertTriangle size={18} />} label="Weak topics" value={String(meta?.weakTopics.length ?? 0)} />
      </div>

      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={17} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold" style={{ color: "var(--text)" }}>Build a session</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Course">
            <select value={course} onChange={e => { setCourse(e.target.value); setLectureId(""); }} style={sel}>
              <option value="">All courses</option>
              {meta?.byCourse.map(c => <option key={c.course} value={c.course}>{c.course} ({c.total})</option>)}
            </select>
          </Field>
          <Field label="Lecture">
            <select value={lectureId} onChange={e => setLectureId(e.target.value)} style={sel}>
              <option value="">All lectures</option>
              {lecturesForCourse.filter(l => l.questions > 0).map(l => (
                <option key={l.id} value={l.id}>{l.title} ({l.questions})</option>
              ))}
            </select>
          </Field>
          <Field label="Question format">
            <select value={format} onChange={e => setFormat(e.target.value)} style={sel}>
              <option value="">Every format</option>
              {FORMATS.map(f => {
                const n = meta?.byFormat.find(x => x.format === f)?.total ?? 0;
                return <option key={f} value={f}>{FORMAT_LABEL[f]}{n ? ` (${n})` : ""}</option>;
              })}
            </select>
          </Field>
          <Field label="How many">
            <select value={count} onChange={e => setCount(Number(e.target.value))} style={sel}>
              {[10, 15, 25, 40, 60].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={missedOnly} onChange={e => setMissedOnly(e.target.checked)} />
          Only questions I&apos;ve missed before
        </label>

        {err && <p className="text-sm mt-3" style={{ color: "#c0392b" }}>{err}</p>}

        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={start} disabled={loading}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#B4552F,#ec4899)" }}>
          <Play size={17} /> {loading ? "Loading…" : "Start session"}
        </motion.button>
      </div>

      {meta && meta.weakTopics.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={17} style={{ color: "#c0392b" }} />
            <h3 className="font-bold" style={{ color: "var(--text)" }}>Where you&apos;re losing points</h3>
          </div>
          <div className="space-y-2">
            {meta.weakTopics.map((w, wi) => {
              const rate = Math.round((w.misses / w.seen) * 100);
              return (
                <motion.div key={wi} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: wi * 0.04 }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{w.topic}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{w.course}</div>
                  </div>
                  <div className="w-24 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: "var(--surface)" }}>
                    <div className="h-full" style={{ width: `${rate}%`, background: "#c0392b" }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: "#c0392b" }}>
                    {w.misses}/{w.seen}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const sel: React.CSSProperties = {
  width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)",
  color: "var(--text)", borderRadius: 10, padding: ".55rem .7rem", fontSize: ".875rem",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: "var(--purple)" }}>{icon}</div>
      <div className="font-serif text-2xl" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
    </motion.div>
  );
}
