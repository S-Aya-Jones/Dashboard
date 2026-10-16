"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Plus, Trash2, RotateCcw } from "lucide-react";

// The question plan, in the app.
//
// Five tabs matching the five sheets she was keeping by hand. The day she is
// on opens first, because on 181 days out of 182 the only question is what to
// do now.
//
// Mastery is never typed. It is three correct attempts, worked out from the
// attempt columns every time it is shown, so there is no stored flag to fall
// out of step with the attempts underneath it.

interface PlanDay { date: string; dow: string; week: number; phase: number; hours: number; focus: string; code: string; tasks: string }
interface Progress { date: string; done: boolean; questions: number | null; correct: number | null; notes: string | null }
interface Question {
  id: number; onDate: string; source: string | null; questionId: string | null;
  topic: string | null; code: string | null; myAnswer: string | null; rightAnswer: string | null;
  why: string | null; missType: string | null; attempts: Array<number | null>;
}
interface Mastery { code: string; name: string; logged: number; firstTryCorrect: number; firstTryPct: number | null; mastered: number; toRetest: number; masteredPct: number | null }
interface WeekRow { week: number; from: string; to: string; daysPlanned: number; daysDone: number; questions: number; correct: number; pct: number | null }
interface TestRow { id: number; week: number | null; onDate: string; name: string; section: string; questions: number | null; correct: number | null; notes: string | null }
interface ScheduledTest { week: number; date: string; name: string; section: string }

interface Payload {
  today: string;
  day: PlanDay | null;
  week: PlanDay[];
  phaseName: Record<string, string>;
  totalDays: number;
  progress: Progress[];
  questions: Question[];
  mastery: Mastery[];
  weakest: Mastery[];
  weekly: WeekRow[];
  tests: TestRow[];
  scheduledTests: ScheduledTest[];
}

const MISS_TYPES = ["Content gap", "Misread", "Reasoning", "Timing"];
const TABS = ["Today", "Questions", "Mastery", "Weeks", "Tests"] as const;
type Tab = typeof TABS[number];

const card = { background: "var(--surface)", border: "1.5px solid var(--border)" };
const input = {
  background: "var(--surface2)", border: "1.5px solid var(--border)",
  color: "var(--text)", borderRadius: 10, padding: "8px 10px", fontSize: 13, width: "100%",
};

function timesCorrect(q: Question) { return q.attempts.filter(a => a === 1).length; }
function mastered(q: Question) { return timesCorrect(q) >= 3; }
function needsRetest(q: Question) { return q.attempts[0] === 0 && !mastered(q); }

export function McatPlanView() {
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>("Today");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/mcat", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const post = async (body: unknown) => {
    setBusy(true);
    await fetch("/api/mcat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
    await load();
    setBusy(false);
  };

  if (!data) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading.</p>;

  const todayProgress = data.progress.find(p => p.date === data.today);
  const daysDone = data.progress.filter(p => p.done).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Question plan</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {data.day
            ? `Week ${data.day.week} of 26, phase ${data.day.phase}: ${data.phaseName[String(data.day.phase)]}. ${daysDone} of ${data.totalDays} days done.`
            : `Starts 19 October. ${daysDone} of ${data.totalDays} days done.`}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap"
            style={{
              background: tab === t ? "var(--purple)" : "var(--surface2)",
              color: tab === t ? "#fff" : "var(--text-muted)",
              border: "1.5px solid var(--border)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Today" && <TodayTab data={data} progress={todayProgress} post={post} busy={busy} />}
      {tab === "Questions" && <QuestionsTab data={data} post={post} busy={busy} />}
      {tab === "Mastery" && <MasteryTab data={data} />}
      {tab === "Weeks" && <WeeksTab data={data} />}
      {tab === "Tests" && <TestsTab data={data} post={post} busy={busy} />}
    </div>
  );
}

// ── Today ────────────────────────────────────────────────────────────────────

function TodayTab({ data, progress, post, busy }: {
  data: Payload; progress: Progress | undefined;
  post: (b: unknown) => Promise<void>; busy: boolean;
}) {
  const [questions, setQuestions] = useState(progress?.questions?.toString() ?? "");
  const [correct, setCorrect] = useState(progress?.correct?.toString() ?? "");
  const [notes, setNotes] = useState(progress?.notes ?? "");

  useEffect(() => {
    setQuestions(progress?.questions?.toString() ?? "");
    setCorrect(progress?.correct?.toString() ?? "");
    setNotes(progress?.notes ?? "");
  }, [progress?.date, progress?.questions, progress?.correct, progress?.notes]);

  if (!data.day) {
    const next = data.progress.length;
    return (
      <div className="rounded-2xl p-5" style={card}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Today is outside the plan window. It runs 19 October 2026 to 18 April 2027.
          {next ? ` ${next} days logged so far.` : ""}
        </p>
      </div>
    );
  }

  const d = data.day;
  const tasks = d.tasks.split(";").map(t => t.trim()).filter(Boolean);
  const pct = progress?.questions && progress?.correct != null
    ? Math.round((progress.correct / progress.questions) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 md:p-5" style={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="section-title">{format(parseISO(d.date), "EEEE d MMMM")}</h2>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
            {d.hours} hrs{d.code ? ` · ${d.code}` : ""}
          </span>
        </div>
        <p className="text-[15px] mt-2 leading-snug" style={{ color: "var(--text)" }}>{d.focus}</p>

        <div className="mt-4 space-y-1.5">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-[7px] rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: "var(--purple)" }} />
              <span className="text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>{t}</span>
            </div>
          ))}
        </div>

        <button
          disabled={busy}
          onClick={() => post({ action: "day", day: { date: d.date, done: !progress?.done } })}
          className="mt-4 w-full rounded-xl py-2.5 text-sm flex items-center justify-center gap-2"
          style={{
            background: progress?.done ? "#0F8A55" : "var(--surface2)",
            color: progress?.done ? "#fff" : "var(--text)",
            border: "1.5px solid var(--border)",
          }}
        >
          {progress?.done ? <><Check size={15} /> Done</> : "Mark done"}
        </button>
      </div>

      <div className="rounded-2xl p-4 md:p-5" style={card}>
        <h3 className="section-title mb-3">How it went</h3>
        <div className="flex gap-2">
          <input style={input} inputMode="numeric" placeholder="Questions" value={questions} onChange={e => setQuestions(e.target.value)} />
          <input style={input} inputMode="numeric" placeholder="Correct" value={correct} onChange={e => setCorrect(e.target.value)} />
        </div>
        <textarea style={{ ...input, marginTop: 8, minHeight: 64 }} placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="flex items-center justify-between mt-3">
          <span className="text-[13px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {pct != null ? `${pct}% correct` : "Not scored yet"}
          </span>
          <button
            disabled={busy}
            onClick={() => post({
              action: "day",
              day: {
                date: d.date,
                questions: questions === "" ? null : Number(questions),
                correct: correct === "" ? null : Number(correct),
                notes: notes || null,
              },
            })}
            className="rounded-xl px-4 py-2 text-sm"
            style={{ background: "var(--purple)", color: "#fff" }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 md:p-5" style={card}>
        <h3 className="section-title mb-3">This week</h3>
        <div className="space-y-1">
          {data.week.map(w => {
            const p = data.progress.find(x => x.date === w.date);
            const isToday = w.date === data.today;
            return (
              <div key={w.date} className="flex items-start gap-2.5 px-2 py-1 rounded-lg"
                style={{ background: isToday ? "rgba(180,85,47,0.07)" : undefined }}>
                <span className="flex items-center justify-center flex-shrink-0 rounded mt-0.5"
                  style={{
                    width: 15, height: 15,
                    background: p?.done ? "#0F8A55" : "transparent",
                    border: p?.done ? "none" : `1.5px solid var(--border2)`,
                  }}>
                  {p?.done && <Check size={10} color="#fff" strokeWidth={3.5} />}
                </span>
                <span className="text-[12px] w-9 flex-shrink-0 tabular-nums" style={{ color: "var(--text-light)" }}>{w.dow}</span>
                <span className="text-[12px] leading-snug" style={{ color: isToday ? "var(--text)" : "var(--text-muted)" }}>
                  {w.focus}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {data.weakest.length > 0 && (
        <div className="rounded-2xl p-4 md:p-5" style={card}>
          <h3 className="section-title mb-2">Weakest right now</h3>
          {data.weakest.map(m => (
            <p key={m.code} className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text)" }}>{m.code}</span> {m.name}: {m.firstTryPct}% first try over {m.logged}.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Questions ────────────────────────────────────────────────────────────────

function QuestionsTab({ data, post, busy }: { data: Payload; post: (b: unknown) => Promise<void>; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "retest" | "mastered">("all");
  const [f, setF] = useState({
    source: "UWorld", questionId: "", topic: "", code: "",
    myAnswer: "", rightAnswer: "", why: "", missType: MISS_TYPES[0], right: false,
  });

  const shown = useMemo(() => data.questions.filter(q =>
    filter === "all" ? true : filter === "retest" ? needsRetest(q) : mastered(q),
  ), [data.questions, filter]);

  const submit = async () => {
    await post({
      action: "question",
      question: {
        onDate: data.today,
        source: f.source || null, questionId: f.questionId || null,
        topic: f.topic || null, code: f.code || null,
        myAnswer: f.myAnswer || null, rightAnswer: f.rightAnswer || null,
        why: f.why || null, missType: f.right ? null : f.missType,
        // Right first time is a 1 and is logged too. Her rule: a right answer
        // you guessed is not knowledge, so the log has to hold both.
        attempts: [f.right ? 1 : 0, null, null, null, null],
      },
    });
    setF({ ...f, questionId: "", topic: "", myAnswer: "", rightAnswer: "", why: "" });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "retest", "mastered"] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-3 py-1.5 rounded-lg text-[12px] capitalize"
            style={{
              background: filter === k ? "var(--surface2)" : "transparent",
              border: "1.5px solid var(--border)", color: "var(--text-muted)",
            }}>
            {k === "retest" ? "To retest" : k}
          </button>
        ))}
        <button onClick={() => setOpen(o => !o)} className="ml-auto px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1.5"
          style={{ background: "var(--purple)", color: "#fff" }}>
          <Plus size={13} /> Log
        </button>
      </div>

      {open && (
        <div className="rounded-2xl p-4" style={card}>
          <div className="grid grid-cols-2 gap-2">
            <input style={input} placeholder="Source" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} />
            <input style={input} placeholder="Question ID" value={f.questionId} onChange={e => setF({ ...f, questionId: e.target.value })} />
            <input style={input} placeholder="Topic" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} />
            <input style={input} placeholder="Code, e.g. 1A" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} />
            <input style={input} placeholder="My answer" value={f.myAnswer} onChange={e => setF({ ...f, myAnswer: e.target.value })} />
            <input style={input} placeholder="Correct answer" value={f.rightAnswer} onChange={e => setF({ ...f, rightAnswer: e.target.value })} />
          </div>
          <textarea style={{ ...input, marginTop: 8, minHeight: 60 }}
            placeholder="Why the right answer beat mine. One sentence about the option you picked."
            value={f.why} onChange={e => setF({ ...f, why: e.target.value })} />

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" checked={f.right} onChange={e => setF({ ...f, right: e.target.checked })} />
              Right first time
            </label>
            {!f.right && (
              <select style={{ ...input, width: "auto" }} value={f.missType} onChange={e => setF({ ...f, missType: e.target.value })}>
                {MISS_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <button disabled={busy} onClick={submit} className="ml-auto rounded-xl px-4 py-2 text-sm"
              style={{ background: "var(--purple)", color: "#fff" }}>Save</button>
          </div>
        </div>
      )}

      {shown.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing here yet.</p>
      )}

      {shown.map(q => (
        <div key={q.id} className="rounded-2xl p-4" style={card}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px]" style={{ color: "var(--text)" }}>
              {q.topic || "Untitled"} {q.code && <span style={{ color: "var(--text-light)" }}>· {q.code}</span>}
            </span>
            <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: mastered(q) ? "#0F8A55" : "var(--text-light)" }}>
              {mastered(q) ? "Mastered" : `${timesCorrect(q)} of 3`}
            </span>
          </div>

          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-light)" }}>
            {[q.source, q.questionId, format(parseISO(q.onDate), "d MMM")].filter(Boolean).join(" · ")}
            {q.missType ? ` · ${q.missType}` : ""}
          </p>

          {q.why && <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>{q.why}</p>}

          <div className="flex items-center gap-1.5 mt-3">
            {q.attempts.map((a, i) => (
              <span key={i} className="rounded text-[10px] flex items-center justify-center"
                style={{
                  width: 20, height: 20,
                  background: a === 1 ? "#0F8A55" : a === 0 ? "#C0392B" : "var(--surface2)",
                  color: a == null ? "var(--text-light)" : "#fff",
                  border: a == null ? "1.5px solid var(--border)" : "none",
                }}>
                {a == null ? "" : a}
              </span>
            ))}

            {!mastered(q) && (
              <>
                <button disabled={busy} onClick={() => post({ action: "attempt", id: q.id, correct: true })}
                  className="ml-auto rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-1"
                  style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)" }}>
                  <RotateCcw size={11} /> Retest right
                </button>
                <button disabled={busy} onClick={() => post({ action: "attempt", id: q.id, correct: false })}
                  className="rounded-lg px-2.5 py-1 text-[11px]"
                  style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
                  Wrong
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => post({ action: "deleteQuestion", id: q.id })}
              className={mastered(q) ? "ml-auto p-1" : "p-1"} style={{ color: "var(--text-light)" }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mastery ──────────────────────────────────────────────────────────────────

function MasteryTab({ data }: { data: Payload }) {
  const rows = data.mastery.filter(m => m.logged > 0);
  if (!rows.length) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>
      Nothing logged yet. Categories fill in as you log questions against their codes.
    </p>;
  }
  return (
    <div className="rounded-2xl p-4 md:p-5" style={card}>
      {rows.map(m => (
        <div key={m.code} className="py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px]" style={{ color: "var(--text)" }}>
              <span className="tabular-nums">{m.code}</span> {m.name}
            </span>
            <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
              {m.firstTryPct}% first try
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: "var(--surface2)" }}>
            <div style={{ width: `${m.masteredPct ?? 0}%`, height: "100%", background: "#0F8A55" }} />
          </div>
          <p className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>
            {m.logged} logged · {m.mastered} mastered · {m.toRetest} to retest
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Weeks ────────────────────────────────────────────────────────────────────

function WeeksTab({ data }: { data: Payload }) {
  const started = data.weekly.filter(w => w.daysDone > 0 || w.questions > 0);
  const rows = started.length ? started : data.weekly.slice(0, 4);
  return (
    <div className="rounded-2xl p-4 md:p-5" style={card}>
      {rows.map(w => (
        <div key={w.week} className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-[12px] w-12 flex-shrink-0 tabular-nums" style={{ color: "var(--text-light)" }}>Wk {w.week}</span>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--text)" }}>{w.daysDone}/{w.daysPlanned} days</span>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>{w.questions} Qs</span>
          <span className="text-[12px] tabular-nums ml-auto" style={{ color: w.pct != null && w.pct >= 70 ? "#0F8A55" : "var(--text-muted)" }}>
            {w.pct != null ? `${w.pct}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

function TestsTab({ data, post, busy }: { data: Payload; post: (b: unknown) => Promise<void>; busy: boolean }) {
  const saved = new Map(data.tests.map(t => [`${t.onDate}|${t.section}`, t]));

  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Percent correct per section. Full lengths are saved for the summer, so these are the sample test and the Phase 3 Saturdays.
      </p>
      {data.scheduledTests.map(s => {
        const key = `${s.date}|${s.section}`;
        const row = saved.get(key);
        return <TestRowEditor key={key} s={s} row={row} post={post} busy={busy} />;
      })}
    </div>
  );
}

function TestRowEditor({ s, row, post, busy }: {
  s: ScheduledTest; row: TestRow | undefined;
  post: (b: unknown) => Promise<void>; busy: boolean;
}) {
  const [q, setQ] = useState(row?.questions?.toString() ?? "");
  const [c, setC] = useState(row?.correct?.toString() ?? "");
  useEffect(() => { setQ(row?.questions?.toString() ?? ""); setC(row?.correct?.toString() ?? ""); }, [row?.questions, row?.correct]);

  const pct = q && c ? Math.round((Number(c) / Number(q)) * 100) : null;

  return (
    <div className="rounded-2xl p-3.5" style={card}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px]" style={{ color: "var(--text)" }}>{s.section} <span style={{ color: "var(--text-light)" }}>· {s.name}</span></span>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
          Wk {s.week} · {format(parseISO(s.date), "d MMM")}
        </span>
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <input style={{ ...input, width: 90 }} inputMode="numeric" placeholder="Qs" value={q} onChange={e => setQ(e.target.value)} />
        <input style={{ ...input, width: 90 }} inputMode="numeric" placeholder="Right" value={c} onChange={e => setC(e.target.value)} />
        <span className="text-[13px] tabular-nums" style={{ color: "var(--text-muted)" }}>{pct != null ? `${pct}%` : ""}</span>
        <button
          disabled={busy}
          onClick={() => post({
            action: "test",
            test: {
              id: row?.id, week: s.week, onDate: s.date, name: s.name, section: s.section,
              questions: q === "" ? null : Number(q), correct: c === "" ? null : Number(c), notes: null,
            },
          })}
          className="ml-auto rounded-xl px-3.5 py-1.5 text-[13px]"
          style={{ background: "var(--purple)", color: "#fff" }}>
          Save
        </button>
      </div>
    </div>
  );
}
