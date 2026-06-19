"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MCATQuestion,
  MCATQuizAttempt,
  DiagnosticSession,
  DiagnosticSectionResult,
  DashboardData,
} from "@/types/dashboard";
import { id } from "@/lib/utils";
import { format } from "date-fns";
import { Play, Clock, ChevronRight, Check, X, AlertTriangle, BarChart2 } from "lucide-react";

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  { name: "Chem/Phys",   subjects: ["General Chemistry", "Organic Chemistry", "Physics", "Biochemistry"], questions: 59, minutes: 95 },
  { name: "CARS",        subjects: ["Critical Analysis & Reasoning Skills"],                               questions: 53, minutes: 90 },
  { name: "Bio/Biochem", subjects: ["Biology", "Biochemistry"],                                           questions: 59, minutes: 95 },
  { name: "Psych/Soc",  subjects: ["Behavioral Sciences"],                                               questions: 59, minutes: 95 },
];

const TOTAL_QUESTIONS = SECTIONS.reduce((a, s) => a + s.questions, 0); // 230
const SHORTENED_MINUTES = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scaleScore(raw: number, total: number): number {
  const pct = total === 0 ? 0 : raw / total;
  return Math.round(118 + pct * 14);
}

function percentile(score: number): string {
  if (score >= 528) return "100th";
  if (score >= 520) return "97th";
  if (score >= 515) return "92nd";
  if (score >= 510) return "80th";
  if (score >= 505) return "70th";
  if (score >= 500) return "60th";
  if (score >= 495) return "45th";
  if (score >= 490) return "32nd";
  return "below 25th";
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function subjectColor(name: string): string {
  const MAP: Record<string, string> = {
    "Behavioral Sciences": "#7C5CFC",
    "Biochemistry":        "#E879F9",
    "Biology":             "#10B981",
    "Critical Analysis & Reasoning Skills": "#FB923C",
    "General Chemistry":   "#F59E0B",
    "Organic Chemistry":   "#EF4444",
    "Physics":             "#6366F1",
  };
  return MAP[name] ?? "#7C5CFC";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "home" | "briefing" | "section" | "break" | "results";

interface SectionState {
  questions: MCATQuestion[];
  answers: Record<string, { letter: string | null; startedAt: number }>;
  startedAt: string;
  completedAt?: string;
  secondsUsed: number;
}

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DiagnosticView({ data, update }: Props) {
  const [phase, setPhase] = useState<Phase>("home");
  const [shortened, setShortened]       = useState(false);
  const [sectionIdx, setSectionIdx]     = useState(0);
  const [currentQ, setCurrentQ]         = useState(0);
  const [sectionStates, setSectionStates] = useState<SectionState[]>([]);
  const [timeLeft, setTimeLeft]         = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [saved, setSaved]               = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef  = useRef<number>(0);

  const pool = data.mcatQuestions ?? [];

  // ─── Timer logic ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "section") {
      startRef.current = Date.now() - ((shortened ? SHORTENED_MINUTES : SECTIONS[sectionIdx].minutes) * 60 - timeLeft) * 1000;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        const limit = (shortened ? SHORTENED_MINUTES : SECTIONS[sectionIdx].minutes) * 60;
        const left = Math.max(0, limit - elapsed);
        setTimeLeft(left);
        if (left === 0) {
          clearInterval(timerRef.current!);
          finishSection();
        }
      }, 500);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sectionIdx]);

  useEffect(() => {
    if (phase === "break" && breakTimeLeft > 0) {
      const t = setInterval(() => setBreakTimeLeft((v) => Math.max(0, v - 1)), 1000);
      return () => clearInterval(t);
    }
  }, [phase, breakTimeLeft]);

  // ─── Pick questions for a section ──────────────────────────────────────────

  function pickQuestions(sIdx: number): MCATQuestion[] {
    const sec = SECTIONS[sIdx];
    const count = shortened ? Math.min(10, sec.questions) : sec.questions;
    const candidates = pool.filter((q) => sec.subjects.includes(q.subject));
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, count);
    // Pad with placeholder if not enough
    if (shuffled.length < count) {
      const needed = count - shuffled.length;
      for (let i = 0; i < needed; i++) {
        shuffled.push({
          id: `placeholder-${sIdx}-${i}`,
          subject: sec.subjects[0],
          topic: "Practice",
          difficulty: "medium",
          stem: `[Placeholder] Question ${i + 1} — Add more ${sec.subjects.join("/")} questions to your bank for a complete diagnostic.`,
          choices: [
            { letter: "A", text: "Option A" },
            { letter: "B", text: "Option B" },
            { letter: "C", text: "Option C" },
            { letter: "D", text: "Option D" },
          ],
          correctLetter: "A",
          explanation: "Add real questions to your bank to replace this placeholder.",
          createdAt: new Date().toISOString(),
        });
      }
    }
    return shuffled;
  }

  // ─── Start test ─────────────────────────────────────────────────────────────

  function startTest(short: boolean) {
    setShortened(short);
    setSectionIdx(0);
    setSectionStates([]);
    setSaved(false);
    setConfirmFinish(false);
    setPhase("briefing");
  }

  // ─── Begin current section ─────────────────────────────────────────────────

  function beginSection() {
    const qs = pickQuestions(sectionIdx);
    const init: Record<string, { letter: string | null; startedAt: number }> = {};
    qs.forEach((q) => { init[q.id] = { letter: null, startedAt: Date.now() }; });
    const limit = (shortened ? SHORTENED_MINUTES : SECTIONS[sectionIdx].minutes) * 60;
    setTimeLeft(limit);
    startRef.current = Date.now();
    setSectionStates((prev) => {
      const next = [...prev];
      next[sectionIdx] = { questions: qs, answers: init, startedAt: new Date().toISOString(), secondsUsed: 0 };
      return next;
    });
    setCurrentQ(0);
    setConfirmFinish(false);
    setPhase("section");
  }

  // ─── Select answer ─────────────────────────────────────────────────────────

  function selectAnswer(qId: string, letter: string) {
    setSectionStates((prev) => {
      const next = [...prev];
      const state = { ...next[sectionIdx] };
      state.answers = { ...state.answers, [qId]: { letter, startedAt: state.answers[qId]?.startedAt ?? Date.now() } };
      next[sectionIdx] = state;
      return next;
    });
  }

  // ─── Finish section ─────────────────────────────────────────────────────────

  const finishSection = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const limit = (shortened ? SHORTENED_MINUTES : SECTIONS[sectionIdx].minutes) * 60;
    const secondsUsed = limit - timeLeft;
    setSectionStates((prev) => {
      const next = [...prev];
      next[sectionIdx] = { ...next[sectionIdx], completedAt: new Date().toISOString(), secondsUsed };
      return next;
    });

    if (sectionIdx < SECTIONS.length - 1) {
      setBreakTimeLeft(10 * 60); // 10-min break
      setPhase("break");
    } else {
      setPhase("results");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx, shortened, timeLeft]);

  // ─── Continue from break ───────────────────────────────────────────────────

  function continueFromBreak() {
    setSectionIdx((i) => i + 1);
    setPhase("briefing");
  }

  // ─── Build & save diagnostic session ──────────────────────────────────────

  function saveResults() {
    if (saved) return;
    setSaved(true);
    const sections: DiagnosticSectionResult[] = sectionStates.map((state, i) => {
      const sec = SECTIONS[i];
      const attempts: MCATQuizAttempt[] = state.questions.map((q) => {
        const a = state.answers[q.id];
        return {
          questionId: q.id,
          selectedLetter: a?.letter ?? null,
          correct: a?.letter === q.correctLetter,
          flagged: false,
          timeSpentSeconds: 0,
        };
      });
      const rawCorrect = attempts.filter((a) => a.correct).length;
      return {
        name: sec.name,
        questionIds: state.questions.map((q) => q.id),
        attempts,
        timeLimitMinutes: shortened ? SHORTENED_MINUTES : sec.minutes,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        scaledScore: scaleScore(rawCorrect, state.questions.length),
      };
    });

    const totalScore = sections.reduce((sum, s) => sum + (s.scaledScore ?? 118), 0);
    const session: DiagnosticSession = {
      id: id(),
      startedAt: sectionStates[0]?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      sections,
      totalScore,
    };

    update((d) => ({
      ...d,
      diagnosticSessions: [...(d.diagnosticSessions ?? []), session],
    }));
  }

  // ─── Results calculations ──────────────────────────────────────────────────

  const resultSections = sectionStates.map((state, i) => {
    const sec = SECTIONS[i];
    const raw = state.questions.filter((q) => state.answers[q.id]?.letter === q.correctLetter).length;
    const total = state.questions.length;
    const scaled = scaleScore(raw, total);
    return { sec, state, raw, total, scaled };
  });

  const totalScore = resultSections.reduce((sum, r) => sum + r.scaled, 0);

  // Subject weakness
  const subjectStats: Record<string, { correct: number; total: number }> = {};
  for (const { state } of resultSections) {
    for (const q of state.questions) {
      if (!subjectStats[q.subject]) subjectStats[q.subject] = { correct: 0, total: 0 };
      subjectStats[q.subject].total++;
      if (state.answers[q.id]?.letter === q.correctLetter) subjectStats[q.subject].correct++;
    }
  }
  const weakestSubject = Object.entries(subjectStats)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];

  const pastSessions = data.diagnosticSessions ?? [];

  // ─── HOME ──────────────────────────────────────────────────────────────────

  if (phase === "home") {
    const hasEnough = pool.length >= TOTAL_QUESTIONS;
    const hasEnoughShort = pool.length >= 40;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--grad)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <BarChart2 size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Full-Length Diagnostic</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              Simulates the real MCAT — 4 sections, timed, with breaks
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            This diagnostic simulates the real MCAT with 4 timed sections and optional breaks between them.
            Full test is ~6.5 hours (230 questions). Use <strong>Shortened Mode</strong> (10 min/section)
            for quick practice without committing a full day.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {SECTIONS.map((s) => (
              <div
                key={s.name}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "var(--bg)",
                  border: "1.5px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text)" }}>{s.name}</div>
                <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{s.questions}Q · {s.minutes}min</div>
              </div>
            ))}
          </div>
        </div>

        {/* Questions warning */}
        {!hasEnough && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              background: "rgba(245,158,11,0.08)",
              border: "1.5px solid rgba(245,158,11,0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertTriangle size={18} color="#F59E0B" style={{ minWidth: 18, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#92400E" }}>
                Not enough questions ({pool.length}/{TOTAL_QUESTIONS})
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#92400E", opacity: 0.8 }}>
                Full test needs 230 questions. Missing sections will use placeholder questions.
                Import more via the Q Bank tab.
              </p>
            </div>
          </div>
        )}

        {/* Start buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => startTest(false)}
            style={{
              flex: 1,
              minWidth: 180,
              padding: "14px 24px",
              borderRadius: 14,
              border: "none",
              background: "var(--grad)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 20px rgba(124,92,252,0.3)",
            }}
          >
            <Play size={18} fill="#fff" />
            Start Full Test
          </button>
          <button
            onClick={() => startTest(true)}
            style={{
              flex: 1,
              minWidth: 180,
              padding: "14px 24px",
              borderRadius: 14,
              border: "2px solid #7C5CFC",
              background: "rgba(124,92,252,0.07)",
              color: "#7C5CFC",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Clock size={18} />
            Start Shortened {!hasEnoughShort ? "(needs 40+ Q)" : "(10 min/section)"}
          </button>
        </div>

        {/* Past diagnostics */}
        {pastSessions.length > 0 && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Past Diagnostics</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...pastSessions].reverse().slice(0, 5).map((sess) => (
                <div
                  key={sess.id}
                  className="card"
                  style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}
                >
                  <div
                    style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: "var(--grad)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      color: "#fff",
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{sess.totalScore ?? "?"}</span>
                    <span style={{ fontSize: 9, opacity: 0.8 }}>Score</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {sess.totalScore ? `${sess.totalScore} · ${percentile(sess.totalScore)} percentile` : "Incomplete"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {format(new Date(sess.startedAt), "MMMM d, yyyy")} ·{" "}
                      {sess.sections.map((s) => `${s.name}: ${s.scaledScore ?? "?"}`).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── BRIEFING / BREAK ─────────────────────────────────────────────────────

  if (phase === "briefing" || phase === "break") {
    const sec = SECTIONS[sectionIdx];
    const isBreak = phase === "break";
    const prevSec = isBreak ? SECTIONS[sectionIdx - 1] : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600, margin: "0 auto" }}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {SECTIONS.map((s, i) => (
            <div
              key={s.name}
              style={{
                width: 32, height: 6, borderRadius: 3,
                background: i < sectionIdx ? "#10B981" : i === sectionIdx ? "#7C5CFC" : "var(--border)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {isBreak && prevSec && (
          <div
            style={{
              padding: "16px 20px", borderRadius: 16,
              background: "rgba(16,185,129,0.08)",
              border: "1.5px solid rgba(16,185,129,0.25)",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <Check size={20} color="#10B981" />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#065F46" }}>
                {prevSec.name} Complete!
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#065F46", opacity: 0.8 }}>
                Great work — take a breather before the next section.
              </p>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          {isBreak ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Break Time</div>
              <div
                style={{
                  fontSize: 48, fontWeight: 800, lineHeight: 1,
                  background: "var(--grad)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: 12,
                }}
              >
                {formatTime(breakTimeLeft)}
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 24px" }}>
                You have 10 minutes of optional break time. Take a break or continue when ready.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Section {sectionIdx + 1} of {SECTIONS.length}
              </p>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>
                {sec.name}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#7C5CFC" }}>
                    {shortened ? Math.min(10, sec.questions) : sec.questions}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Questions</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#7C5CFC" }}>
                    {shortened ? SHORTENED_MINUTES : sec.minutes}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Minutes</div>
                </div>
              </div>
              <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {sec.subjects.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "4px 12px", borderRadius: 20,
                      background: `${subjectColor(s)}18`,
                      color: subjectColor(s),
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          <button
            onClick={isBreak ? continueFromBreak : beginSection}
            style={{
              padding: "14px 36px",
              borderRadius: 14,
              border: "none",
              background: "var(--grad)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,92,252,0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {isBreak ? "Begin Next Section" : "Begin Section"}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ─── SECTION (quiz) ───────────────────────────────────────────────────────

  if (phase === "section" && sectionStates[sectionIdx]) {
    const sec = SECTIONS[sectionIdx];
    const state = sectionStates[sectionIdx];
    const qs = state.questions;
    const q = qs[currentQ];
    const answer = state.answers[q?.id];
    const limitSecs = (shortened ? SHORTENED_MINUTES : sec.minutes) * 60;
    const isLow = timeLeft < 5 * 60;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Top bar */}
        <div
          className="card"
          style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{sec.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
              Q {currentQ + 1}/{qs.length}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 18, fontWeight: 800,
              color: isLow ? "#EF4444" : "#7C5CFC",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Clock size={16} color={isLow ? "#EF4444" : "#7C5CFC"} />
            {formatTime(timeLeft)}
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", height: 4, borderRadius: 2, background: "var(--bg)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${((limitSecs - timeLeft) / limitSecs) * 100}%`,
                background: isLow ? "#EF4444" : "var(--grad)",
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>

        {/* Question card */}
        {q && (
          <div className="card" style={{ padding: 24 }}>
            {q.id.startsWith("placeholder") && (
              <div
                style={{
                  padding: "8px 12px", borderRadius: 8, marginBottom: 16,
                  background: "rgba(245,158,11,0.08)",
                  border: "1.5px solid rgba(245,158,11,0.25)",
                  fontSize: 12, color: "#92400E",
                  display: "flex", gap: 8, alignItems: "center",
                }}
              >
                <AlertTriangle size={14} color="#F59E0B" />
                Placeholder — add more questions to your bank via the Q Bank tab
              </div>
            )}
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "var(--text)", marginBottom: 24, fontWeight: 400 }}>
              {q.stem}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.choices.map((choice) => {
                const selected = answer?.letter === choice.letter;
                return (
                  <button
                    key={choice.letter}
                    onClick={() => selectAnswer(q.id, choice.letter)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: `2px solid ${selected ? "#7C5CFC" : "var(--border)"}`,
                      background: selected ? "rgba(124,92,252,0.07)" : "white",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: 28, height: 28, minWidth: 28,
                        borderRadius: 8,
                        background: selected ? "#7C5CFC" : "var(--bg)",
                        color: selected ? "#fff" : "var(--text-muted)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13,
                      }}
                    >
                      {choice.letter}
                    </span>
                    <span style={{ fontSize: 14, lineHeight: 1.6, color: selected ? "#7C5CFC" : "var(--text)", paddingTop: 2 }}>
                      {choice.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setCurrentQ((i) => Math.max(0, i - 1))}
            disabled={currentQ === 0}
            style={{
              padding: "8px 16px", borderRadius: 10,
              border: "2px solid var(--border)", background: "white",
              color: currentQ === 0 ? "var(--text-muted)" : "var(--text)",
              fontWeight: 700, fontSize: 13,
              cursor: currentQ === 0 ? "not-allowed" : "pointer",
              opacity: currentQ === 0 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>

          {/* Dot navigator */}
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {qs.map((qq, i) => {
              const answered = !!state.answers[qq.id]?.letter;
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrentQ(i)}
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    border: i === currentQ ? "2px solid #7C5CFC" : "2px solid transparent",
                    background: i === currentQ ? "rgba(124,92,252,0.15)" : answered ? "#7C5CFC" : "#E2D9FF",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700,
                    color: i === currentQ ? "#7C5CFC" : answered ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {currentQ < qs.length - 1 ? (
            <button
              onClick={() => setCurrentQ((i) => i + 1)}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: "none", background: "var(--grad)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(124,92,252,0.25)",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => setConfirmFinish(true)}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: "none", background: "#10B981",
                color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(16,185,129,0.25)",
              }}
            >
              Finish Section
            </button>
          )}
        </div>

        {/* Confirm finish modal */}
        {confirmFinish && (
          <div
            style={{
              position: "fixed", inset: 0,
              background: "rgba(30,19,64,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 100,
            }}
          >
            <div
              className="card"
              style={{ padding: 28, maxWidth: 380, width: "90%", textAlign: "center" }}
            >
              <AlertTriangle size={28} color="#F59E0B" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
                Finish {sec.name}?
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                {qs.filter((qq) => !state.answers[qq.id]?.letter).length} unanswered question(s).
                You cannot return to this section after submitting.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setConfirmFinish(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 12,
                    border: "2px solid var(--border)", background: "white",
                    color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}
                >
                  Go Back
                </button>
                <button
                  onClick={() => { setConfirmFinish(false); finishSection(); }}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 12,
                    border: "none", background: "#10B981",
                    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  Submit Section
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────

  if (phase === "results") {
    const scoreColor = totalScore >= 510 ? "#10B981" : totalScore >= 500 ? "#F59E0B" : "#EF4444";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero score */}
        <div
          className="card"
          style={{ padding: 32, textAlign: "center" }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Total MCAT Score
          </p>
          <div
            style={{
              fontSize: 72, fontWeight: 900, lineHeight: 1,
              color: scoreColor,
              marginBottom: 8,
            }}
          >
            {totalScore}
          </div>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-muted)" }}>
            {percentile(totalScore)} percentile
          </p>

          {/* Percentile scale */}
          <div style={{ marginTop: 20, position: "relative", height: 24 }}>
            <div style={{ height: 8, borderRadius: 4, background: "linear-gradient(90deg, #EF4444 0%, #F59E0B 40%, #10B981 100%)", position: "relative" }}>
              {/* Marker */}
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(100, Math.max(0, ((totalScore - 472) / 56) * 100))}%`,
                  top: -4,
                  width: 16, height: 16, borderRadius: "50%",
                  background: scoreColor,
                  border: "3px solid white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  transform: "translateX(-50%)",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              <span>472</span><span>490</span><span>500</span><span>510</span><span>520</span><span>528</span>
            </div>
          </div>
        </div>

        {/* Section breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 16px" }}>
            Section Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {resultSections.map(({ sec, state, raw, total, scaled }) => {
              const pct = total > 0 ? Math.round((raw / total) * 100) : 0;
              const sColor = scaled >= 127 ? "#10B981" : scaled >= 124 ? "#F59E0B" : "#EF4444";
              return (
                <div key={sec.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{sec.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{raw}/{total} correct</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: sColor, minWidth: 32, textAlign: "right" }}>
                      {scaled}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`, height: "100%",
                          background: sColor, borderRadius: 4,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>
                      {pct}%
                    </span>
                    {state.secondsUsed > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 48, textAlign: "right" }}>
                        {formatDuration(state.secondsUsed)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Percentile reference */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Score Reference
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { score: 528, pct: "100th" },
              { score: 520, pct: "97th" },
              { score: 515, pct: "92nd" },
              { score: 510, pct: "80th" },
              { score: 505, pct: "70th" },
              { score: 500, pct: "60th" },
              { score: 495, pct: "45th" },
              { score: 490, pct: "32nd" },
            ].map(({ score, pct: p }) => {
              const isYours = totalScore >= score && (score === 528 || totalScore < score + 5);
              return (
                <div
                  key={score}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    background: isYours ? "rgba(124,92,252,0.12)" : "var(--bg)",
                    border: isYours ? "1.5px solid #7C5CFC" : "1.5px solid transparent",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: isYours ? "#7C5CFC" : "var(--text)" }}>{score}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>{p}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weakness analysis */}
        {weakestSubject && (
          <div
            style={{
              padding: "14px 18px", borderRadius: 14,
              background: "rgba(239,68,68,0.06)",
              border: "1.5px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}
          >
            <X size={18} color="#EF4444" style={{ minWidth: 18, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
                Weakest Area: {weakestSubject[0]}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#991B1B", opacity: 0.8 }}>
                {weakestSubject[1].correct}/{weakestSubject[1].total} correct (
                {Math.round((weakestSubject[1].correct / weakestSubject[1].total) * 100)}%)
                — prioritize this subject in your next study session.
              </p>
            </div>
          </div>
        )}

        {/* Save & Return */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { saveResults(); setPhase("home"); setSectionStates([]); setSectionIdx(0); }}
            style={{
              flex: 1, padding: "14px 24px", borderRadius: 14,
              border: "none", background: "var(--grad)",
              color: "#fff", fontWeight: 700, fontSize: 15,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: "0 4px 20px rgba(124,92,252,0.3)",
            }}
          >
            <BarChart2 size={18} />
            Save &amp; Return
          </button>
        </div>
      </div>
    );
  }

  return null;
}
