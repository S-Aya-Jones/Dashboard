"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Flag,
  Clock,
  RotateCcw,
  BookOpen,
  CheckCircle,
  XCircle,
  Trash2,
  BarChart2,
  Loader2,
  Plus,
} from "lucide-react";
import { DashboardData, MCATQuestion, MCATQuizSession, MCATQuizAttempt } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { format } from "date-fns";

// ─── Subject data ────────────────────────────────────────────────────────────

const SUBJECTS = [
  {
    name: "Behavioral Sciences",
    color: "#7C5CFC",
    abbr: "Psych/Soc",
    topics: [
      "Sensation, Perception, & Consciousness",
      "Learning, Memory, & Cognition",
      "Emotion, Attitudes, & Personality",
      "Identity & Social Interactions",
      "Demographics & Social Structure",
    ],
  },
  {
    name: "Biochemistry",
    color: "#E879F9",
    abbr: "Biochem",
    topics: [
      "Amino Acids & Proteins",
      "Enzymatic Function",
      "Nucleotides, Carbohydrates & Lipids",
      "Metabolic Reactions",
    ],
  },
  {
    name: "Biology",
    color: "#10B981",
    abbr: "Bio",
    topics: [
      "DNA & Gene Expression",
      "Genetics & Evolution",
      "Prokaryotes & Viruses",
      "Reproduction & Cell Growth",
      "Hormones & Endocrinology",
      "Circulation & Respiration",
      "Digestion & Excretion",
      "Musculoskeletal System",
      "Skin & Immune System",
      "Nervous System",
    ],
  },
  {
    name: "Critical Analysis & Reasoning Skills",
    color: "#FB923C",
    abbr: "CARS",
    topics: ["Humanities", "Social Sciences"],
  },
  {
    name: "General Chemistry",
    color: "#F59E0B",
    abbr: "Gen Chem",
    topics: [
      "Atoms & Molecules",
      "Bonding & Reactions",
      "Thermochemistry, Kinetics & Gas Laws",
      "Solutions & Electrochemistry",
    ],
  },
  {
    name: "Organic Chemistry",
    color: "#EF4444",
    abbr: "Org Chem",
    topics: [
      "Compounds & Reactions",
      "Functional Groups & Biological Molecules",
      "Laboratory Techniques & Biotechnology",
    ],
  },
  {
    name: "Physics",
    color: "#6366F1",
    abbr: "Physics",
    topics: [
      "Mechanics & Energy",
      "Fluids & Gases",
      "Electrostatics & Circuits",
      "Light & Sound",
      "Thermodynamics",
    ],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "setup" | "generating" | "quiz" | "results";
type Difficulty = "easy" | "medium" | "hard" | "mixed";
type Mode = "tutor" | "timed";

interface AnswerState {
  letter: string | null;
  flagged: boolean;
  startedAt: number;
}

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function topicKey(subject: string, topic: string) {
  return `${subject}::${topic}`;
}

function difficultyColor(d: string) {
  if (d === "easy") return "#10B981";
  if (d === "medium") return "#F59E0B";
  return "#EF4444";
}

function subjectColor(subject: string) {
  return SUBJECTS.find((s) => s.name === subject)?.color ?? "#7C5CFC";
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function gradeLabel(pct: number) {
  if (pct >= 90) return { label: "Excellent", color: "#10B981" };
  if (pct >= 75) return { label: "Good", color: "#7C5CFC" };
  if (pct >= 60) return { label: "Fair", color: "#F59E0B" };
  return { label: "Needs Work", color: "#EF4444" };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QBankView({ data, update }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("tutor");
  const [timeLimitPerQ, setTimeLimitPerQ] = useState<number>(1); // minutes per question
  const [qCount, setQCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [questions, setQuestions] = useState<MCATQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState<number>(0);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showMissed, setShowMissed] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Timer logic ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "quiz" && mode === "timed") {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, mode]);

  const totalTimeLimit = qCount * timeLimitPerQ * 60;

  useEffect(() => {
    if (mode === "timed" && phase === "quiz" && elapsed >= totalTimeLimit) {
      handleFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, totalTimeLimit, mode, phase]);

  // ─── Save session when entering results ──────────────────────────────────

  const saveSession = useCallback(
    (qs: MCATQuestion[], ans: Record<string, AnswerState>) => {
      if (sessionSaved) return;
      setSessionSaved(true);

      const attempts: MCATQuizAttempt[] = qs.map((q) => {
        const a = ans[q.id];
        return {
          questionId: q.id,
          selectedLetter: a?.letter ?? null,
          correct: a?.letter === q.correctLetter,
          flagged: a?.flagged ?? false,
          timeSpentSeconds: a ? Math.round((Date.now() - a.startedAt) / 1000) : 0,
        };
      });

      const session: MCATQuizSession = {
        id: id(),
        startedAt: sessionStartRef.current,
        completedAt: new Date().toISOString(),
        mode,
        timeLimitMinutes: mode === "timed" ? timeLimitPerQ : undefined,
        questionIds: qs.map((q) => q.id),
        attempts,
        subjects: Array.from(new Set(qs.map((q) => q.subject))),
        topics: Array.from(new Set(qs.map((q) => q.topic))),
      };

      update((d) => {
        const existingIds = new Set((d.mcatQuestions ?? []).map((q) => q.id));
        const newQuestions = qs.filter((q) => !existingIds.has(q.id));
        return {
          ...d,
          mcatQuestions: [...(d.mcatQuestions ?? []), ...newQuestions],
          mcatQuizSessions: [...(d.mcatQuizSessions ?? []), session],
        };
      });
    },
    [sessionSaved, mode, timeLimitPerQ, update]
  );

  function handleFinish() {
    if (timerRef.current) clearInterval(timerRef.current);
    saveSession(questions, answers);
    setPhase("results");
  }

  // ─── Generate questions ───────────────────────────────────────────────────

  async function handleGenerate() {
    const selections: { subject: string; topic: string }[] = [];
    for (const key of Array.from(selectedTopics)) {
      const [subject, topic] = key.split("::");
      selections.push({ subject, topic });
    }

    setPhase("generating");
    setSessionSaved(false);
    setElapsed(0);

    try {
      const res = await fetch("/api/mcat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections, count: qCount, difficulty }),
      });
      const data = await res.json();
      if (data.questions?.length) {
        const initAnswers: Record<string, AnswerState> = {};
        for (const q of data.questions) {
          initAnswers[q.id] = { letter: null, flagged: false, startedAt: Date.now() };
        }
        setQuestions(data.questions);
        setAnswers(initAnswers);
        setRevealed(new Set());
        setCurrentIdx(0);
        sessionStartRef.current = new Date().toISOString();
        setPhase("quiz");
      } else {
        setPhase("setup");
        alert("Failed to generate questions. Please try again.");
      }
    } catch {
      setPhase("setup");
      alert("Generation failed. Please check your connection.");
    }
  }

  // ─── Subject/topic selection ──────────────────────────────────────────────

  function toggleTopic(subject: string, topic: string) {
    const key = topicKey(subject, topic);
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSubject(subjectName: string, topics: string[]) {
    const keys = topics.map((t) => topicKey(subjectName, t));
    const allSelected = keys.every((k) => selectedTopics.has(k));
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  function toggleExpand(name: string) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // ─── File import ─────────────────────────────────────────────────────────

  const importFiles = async (files: FileList) => {
    setImporting(true);
    setUploadError(null);
    let totalImported = 0;
    let totalSkipped = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadError(`Processing ${file.name} (${i + 1}/${files.length})…`);
        const fd = new FormData();
        fd.append("file", file);
        let res: Response;
        try {
          res = await fetch("/api/mcat/extract", { method: "POST", body: fd });
        } catch (netErr) {
          setUploadError(`Network error — ${netErr instanceof Error ? netErr.message : String(netErr)}`);
          continue;
        }
        let j: { questions?: MCATQuestion[]; count?: number; error?: string; detail?: string };
        try {
          j = await res.json();
        } catch {
          setUploadError(`Server error (HTTP ${res.status}) — see browser console for details`);
          continue;
        }
        if (j.error) { setUploadError(`${j.error}${j.detail ? ` — ${j.detail}` : ""}`); continue; }
        if (!j.questions) { setUploadError("Server returned no questions — try a different file"); continue; }
        const existing = new Set((data.mcatQuestions ?? []).map(q => q.stem.slice(0, 50)));
        const fresh = j.questions.filter(q => !existing.has(q.stem.slice(0, 50)));
        update(d => ({ ...d, mcatQuestions: [...(d.mcatQuestions ?? []), ...fresh] }));
        totalImported += fresh.length;
        totalSkipped  += ((j.count ?? j.questions.length) - fresh.length);
      }
      setUploadError(`✓ Imported ${totalImported} question${totalImported !== 1 ? "s" : ""}${totalSkipped > 0 ? ` (${totalSkipped} duplicates skipped)` : ""}`);
    } catch (e) {
      setUploadError(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  };

  // ─── Use saved questions ──────────────────────────────────────────────────

  const useSaved = () => {
    const selected = Array.from(selectedTopics);
    const pool = (data.mcatQuestions ?? []).filter(q =>
      selected.some(key => {
        const [subj, topic] = key.split("::");
        return q.subject === subj && (topic === "__all__" || q.topic === topic);
      })
    );
    if (pool.length === 0) return;
    // Shuffle and take up to qCount
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, qCount);
    setQuestions(shuffled);
    // initialize answers
    const init: Record<string, { letter: string | null; flagged: boolean; startedAt: number }> = {};
    shuffled.forEach(q => { init[q.id] = { letter: null, flagged: false, startedAt: Date.now() }; });
    setAnswers(init);
    setCurrentIdx(0);
    setRevealed(new Set());
    setElapsed(0);
    setPhase("quiz");
  };

  // ─── Quiz interactions ────────────────────────────────────────────────────

  function selectChoice(questionId: string, letter: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], letter },
    }));
    if (mode === "tutor") {
      setRevealed((prev) => {
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
    }
  }

  function toggleFlag(questionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], flagged: !prev[questionId]?.flagged },
    }));
  }

  // ─── Results calculations ─────────────────────────────────────────────────

  const correctCount = questions.filter(
    (q) => answers[q.id]?.letter === q.correctLetter
  ).length;

  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const subjectBreakdown = SUBJECTS.map((s) => {
    const qs = questions.filter((q) => q.subject === s.name);
    if (!qs.length) return null;
    const correct = qs.filter((q) => answers[q.id]?.letter === q.correctLetter).length;
    return { name: s.name, abbr: s.abbr, color: s.color, total: qs.length, correct };
  }).filter(Boolean) as { name: string; abbr: string; color: string; total: number; correct: number }[];

  const missedQuestions = questions.filter(
    (q) => answers[q.id]?.letter != null && answers[q.id]?.letter !== q.correctLetter
  );

  const flaggedQuestions = questions.filter((q) => answers[q.id]?.flagged);

  // ─── Dot state for navigator ──────────────────────────────────────────────

  function dotState(q: MCATQuestion) {
    const a = answers[q.id];
    if (!a?.letter) return "unanswered";
    if (a.flagged) return "flagged";
    if (mode === "tutor" && revealed.has(q.id)) {
      return a.letter === q.correctLetter ? "correct" : "wrong";
    }
    return "answered";
  }

  function dotColor(state: string) {
    if (state === "correct") return "#10B981";
    if (state === "wrong") return "#EF4444";
    if (state === "flagged") return "#F59E0B";
    if (state === "answered") return "#7C5CFC";
    return "#E2D9FF";
  }

  // ─── Delete helpers ──────────────────────────────────────────────────────

  function deleteSession(sessionId: string) {
    update(d => ({ ...d, mcatQuizSessions: (d.mcatQuizSessions ?? []).filter(s => s.id !== sessionId) }));
  }

  function clearAllSessions() {
    update(d => ({ ...d, mcatQuizSessions: [] }));
  }

  function clearQBank() {
    update(d => ({ ...d, mcatQuestions: [] }));
  }

  // ─── Sessions summary ─────────────────────────────────────────────────────

  const pastSessions = data.mcatQuizSessions ?? [];
  const recentSessions = [...pastSessions].reverse().slice(0, 5);

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── SETUP PHASE ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--grad)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BookOpen size={18} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              Q Bank
            </h2>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0, paddingLeft: 46 }}>
            Generate AI-powered MCAT questions
          </p>
        </div>

        {/* Past sessions summary */}
        {pastSessions.length > 0 && (
          <div
            className="card"
            style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}
          >
            <BarChart2 size={18} color="#7C5CFC" />
            <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>
              {pastSessions.length} session{pastSessions.length !== 1 ? "s" : ""} completed
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {recentSessions.map((sess) => {
                const correct = sess.attempts.filter((a) => a.correct).length;
                const total = sess.attempts.length;
                const p = total > 0 ? Math.round((correct / total) * 100) : 0;
                const grade = gradeLabel(p);
                return (
                  <div
                    key={sess.id}
                    style={{
                      background: "var(--bg)",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 12,
                      color: grade.color,
                      fontWeight: 700,
                    }}
                  >
                    {p}%
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subject selector grid */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
            Select Topics
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {SUBJECTS.map((subj) => {
              const allSelected = subj.topics.every((t) =>
                selectedTopics.has(topicKey(subj.name, t))
              );
              const someSelected = subj.topics.some((t) =>
                selectedTopics.has(topicKey(subj.name, t))
              );
              const expanded = expandedSubjects.has(subj.name);

              return (
                <div
                  key={subj.name}
                  className="card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {/* Subject header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderBottom: expanded ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <button
                      onClick={() => toggleSubject(subj.name, subj.topics)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
                    >
                      {allSelected ? (
                        <CheckSquare size={18} color={subj.color} />
                      ) : someSelected ? (
                        <CheckSquare size={18} color={subj.color} style={{ opacity: 0.5 }} />
                      ) : (
                        <Square size={18} color="#C4B8F0" />
                      )}
                    </button>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 700,
                        color: subj.color,
                        lineHeight: 1.3,
                      }}
                    >
                      {subj.abbr}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {subj.topics.filter((t) => selectedTopics.has(topicKey(subj.name, t))).length}/
                      {subj.topics.length}
                    </span>
                    <button
                      onClick={() => toggleExpand(subj.name)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
                    >
                      {expanded ? (
                        <ChevronUp size={16} color="var(--text-muted)" />
                      ) : (
                        <ChevronDown size={16} color="var(--text-muted)" />
                      )}
                    </button>
                  </div>

                  {/* Topics list */}
                  {expanded && (
                    <div style={{ padding: "8px 14px 12px" }}>
                      {subj.topics.map((topic) => {
                        const key = topicKey(subj.name, topic);
                        const checked = selectedTopics.has(key);
                        return (
                          <label
                            key={topic}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "5px 0",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTopic(subj.name, topic)}
                              style={{ display: "none" }}
                            />
                            {checked ? (
                              <CheckSquare size={15} color={subj.color} />
                            ) : (
                              <Square size={15} color="#C4B8F0" />
                            )}
                            <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>
                              {topic}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* File import section */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(124,92,252,0.04)", border: "1.5px dashed rgba(124,92,252,0.25)", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Import from file</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Upload .docx or .txt files — Claude extracts and structures all questions automatically</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                background: "var(--purple, #7C5CFC)",
                color: "#fff",
                border: "none",
                cursor: importing ? "not-allowed" : "pointer",
                opacity: importing ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {importing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
              {importing ? "Extracting…" : "Upload File"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.txt"
            style={{ display: "none" }}
            multiple
            onChange={e => { if (e.target.files?.length) importFiles(e.target.files); e.target.value = ""; }}
          />
          {uploadError && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: uploadError.startsWith("✓") ? "var(--green, #10B981)" : "var(--red, #EF4444)" }}>
              {uploadError}
            </p>
          )}
          {(data.mcatQuestions?.length ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                {data.mcatQuestions!.length} questions in your bank · {data.mcatQuizSessions?.length ?? 0} sessions completed
              </p>
              <button
                onClick={() => { if (confirm("Delete all questions from your Q Bank?")) clearQBank(); }}
                style={{ fontSize: 11, color: "var(--red, #EF4444)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}
              >
                <Trash2 size={11} /> Clear bank
              </button>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Mode */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Mode</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["tutor", "timed"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 10,
                    border: "2px solid",
                    borderColor: mode === m ? "#7C5CFC" : "var(--border)",
                    background: mode === m ? "rgba(124,92,252,0.08)" : "white",
                    color: mode === m ? "#7C5CFC" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {m === "tutor" ? <BookOpen size={14} /> : <Clock size={14} />}
                  {m === "tutor" ? "Tutor" : "Timed"}
                </button>
              ))}
            </div>
            {mode === "timed" && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Time per question:</span>
                {[1, 1.5].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimitPerQ(t)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 8,
                      border: "2px solid",
                      borderColor: timeLimitPerQ === t ? "#7C5CFC" : "var(--border)",
                      background: timeLimitPerQ === t ? "rgba(124,92,252,0.08)" : "white",
                      color: timeLimitPerQ === t ? "#7C5CFC" : "var(--text-muted)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Question count */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Questions</p>
            <div style={{ display: "flex", gap: 8 }}>
              {[5, 10, 20, 40].map((n) => (
                <button
                  key={n}
                  onClick={() => setQCount(n)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 10,
                    border: "2px solid",
                    borderColor: qCount === n ? "#7C5CFC" : "var(--border)",
                    background: qCount === n ? "rgba(124,92,252,0.08)" : "white",
                    color: qCount === n ? "#7C5CFC" : "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Difficulty</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["easy", "medium", "hard", "mixed"] as Difficulty[]).map((d) => {
                const colors: Record<Difficulty, string> = {
                  easy: "#10B981",
                  medium: "#F59E0B",
                  hard: "#EF4444",
                  mixed: "#7C5CFC",
                };
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 10,
                      border: "2px solid",
                      borderColor: active ? colors[d] : "var(--border)",
                      background: active ? `${colors[d]}18` : "white",
                      color: active ? colors[d] : "var(--text-muted)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {selectedTopics.size} topic{selectedTopics.size !== 1 ? "s" : ""} selected
            </span>
            {(() => {
              const selected = Array.from(selectedTopics);
              const savedPool = (data.mcatQuestions ?? []).filter(q =>
                selected.some(key => {
                  const [subj, topic] = key.split("::");
                  return q.subject === subj && (topic === "__all__" || q.topic === topic);
                })
              );
              const hasSaved = selectedTopics.size > 0 && savedPool.length > 0;
              return hasSaved ? (
                <button
                  onClick={useSaved}
                  style={{
                    marginLeft: "auto",
                    padding: "10px 20px",
                    borderRadius: 12,
                    background: "white",
                    color: "#7C5CFC",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "2px solid #7C5CFC",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <BookOpen size={16} />
                  Use Saved ({savedPool.length})
                </button>
              ) : null;
            })()}
            <button
              onClick={handleGenerate}
              disabled={selectedTopics.size === 0}
              style={{
                marginLeft: (() => {
                  const selected = Array.from(selectedTopics);
                  const savedPool = (data.mcatQuestions ?? []).filter(q =>
                    selected.some(key => {
                      const [subj, topic] = key.split("::");
                      return q.subject === subj && (topic === "__all__" || q.topic === topic);
                    })
                  );
                  return selectedTopics.size > 0 && savedPool.length > 0 ? 0 : "auto";
                })(),
                padding: "10px 24px",
                borderRadius: 12,
                background: selectedTopics.size === 0 ? "#C4B8F0" : "var(--grad)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: selectedTopics.size === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: selectedTopics.size === 0 ? "none" : "0 4px 16px rgba(124,92,252,0.3)",
              }}
            >
              <Plus size={16} />
              Generate &amp; Start
            </button>
          </div>
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                Recent Sessions
              </h3>
              <button
                onClick={() => { if (confirm("Delete all quiz sessions?")) clearAllSessions(); }}
                style={{ fontSize: 12, color: "var(--red, #EF4444)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentSessions.map((sess) => {
                const correct = sess.attempts.filter((a) => a.correct).length;
                const total = sess.attempts.length;
                const p = total > 0 ? Math.round((correct / total) * 100) : 0;
                const grade = gradeLabel(p);
                return (
                  <div
                    key={sess.id}
                    className="card"
                    style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: `${grade.color}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 14, color: grade.color, flexShrink: 0,
                      }}
                    >
                      {p}%
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                        {correct}/{total} correct · {sess.mode === "tutor" ? "Tutor" : "Timed"}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                        {sess.subjects.slice(0, 3).join(", ")}
                        {sess.subjects.length > 3 ? ` +${sess.subjects.length - 3} more` : ""}
                        {" · "}
                        {format(new Date(sess.startedAt), "MMM d")}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: grade.color }}>
                      {grade.label}
                    </span>
                    <button
                      onClick={() => deleteSession(sess.id)}
                      title="Delete this session"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── GENERATING PHASE ──────────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 320,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "var(--grad)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 32px rgba(124,92,252,0.25)",
          }}
        >
          <Loader2 size={30} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Generating your questions…
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          Using AI to write {qCount} MCAT-quality questions
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── QUIZ PHASE ────────────────────────────────────────────────────────────
  if (phase === "quiz" && questions.length > 0) {
    const q = questions[currentIdx];
    const a = answers[q.id];
    const isRevealed = revealed.has(q.id);
    const timeLeft = totalTimeLimit - elapsed;
    const timedOut = mode === "timed" && timeLeft <= 0;
    // answeredCount available if needed for future display
    const tutorCorrectCount = questions.filter(
      (qq) => revealed.has(qq.id) && answers[qq.id]?.letter === qq.correctLetter
    ).length;
    const tutorRevealedCount = questions.filter((qq) => revealed.has(qq.id)).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Top bar */}
        <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Question {currentIdx + 1} of {questions.length}
          </span>

          {mode === "tutor" && tutorRevealedCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                color: "#10B981",
              }}
            >
              <CheckCircle size={14} />
              {tutorCorrectCount}/{tutorRevealedCount} correct
            </div>
          )}

          {mode === "timed" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: timeLeft < 60 ? "#EF4444" : "#7C5CFC",
                marginLeft: "auto",
              }}
            >
              <Clock size={15} />
              {formatTime(Math.max(0, timeLeft))}
            </div>
          )}

          <div
            style={{
              marginLeft: mode === "timed" ? 0 : "auto",
              padding: "4px 10px",
              borderRadius: 20,
              background: `${subjectColor(q.subject)}18`,
              color: subjectColor(q.subject),
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {SUBJECTS.find((s) => s.name === q.subject)?.abbr ?? q.subject}
          </div>

          <button
            onClick={handleFinish}
            style={{
              padding: "6px 14px",
              borderRadius: 10,
              background: "white",
              border: "2px solid var(--border)",
              color: "var(--text-muted)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BarChart2 size={13} />
            Finish Early
          </button>
        </div>

        {/* Question card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{q.topic}</span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 20,
                background: `${difficultyColor(q.difficulty)}18`,
                color: difficultyColor(q.difficulty),
                fontSize: 11,
                fontWeight: 700,
                textTransform: "capitalize",
              }}
            >
              {q.difficulty}
            </span>
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text)", marginBottom: 24, fontWeight: 400 }}>
            {q.stem}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.choices.map((choice) => {
              const selected = a?.letter === choice.letter;
              const isCorrect = choice.letter === q.correctLetter;

              let bg = "white";
              let border = "var(--border)";
              let textColor = "var(--text)";
              let letterBg = "var(--bg)";
              let letterColor = "var(--text-muted)";

              if (isRevealed || timedOut) {
                if (isCorrect) {
                  bg = "#ECFDF5";
                  border = "#10B981";
                  textColor = "#065F46";
                  letterBg = "#10B981";
                  letterColor = "white";
                } else if (selected) {
                  bg = "#FEF2F2";
                  border = "#EF4444";
                  textColor = "#991B1B";
                  letterBg = "#EF4444";
                  letterColor = "white";
                } else {
                  bg = "var(--bg)";
                  textColor = "var(--text-muted)";
                  letterBg = "#E2D9FF";
                  letterColor = "var(--text-muted)";
                }
              } else if (selected) {
                bg = "rgba(124,92,252,0.07)";
                border = "#7C5CFC";
                textColor = "#7C5CFC";
                letterBg = "#7C5CFC";
                letterColor = "white";
              }

              return (
                <button
                  key={choice.letter}
                  onClick={() => !isRevealed && !timedOut && selectChoice(q.id, choice.letter)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: `2px solid ${border}`,
                    background: bg,
                    cursor: isRevealed || timedOut ? "default" : "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    width: "100%",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      borderRadius: 8,
                      background: letterBg,
                      color: letterColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {choice.letter}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: textColor, paddingTop: 2 }}>
                    {choice.text}
                  </span>
                  {isRevealed && isCorrect && (
                    <CheckCircle size={18} color="#10B981" style={{ marginLeft: "auto", minWidth: 18 }} />
                  )}
                  {isRevealed && selected && !isCorrect && (
                    <XCircle size={18} color="#EF4444" style={{ marginLeft: "auto", minWidth: 18 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation (tutor mode, after reveal) */}
          {mode === "tutor" && isRevealed && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                background: "rgba(124,92,252,0.05)",
                border: "1.5px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <BookOpen size={16} color="#7C5CFC" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#7C5CFC" }}>Explanation</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
                {q.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Navigation bar */}
        <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "2px solid var(--border)",
              background: "white",
              color: currentIdx === 0 ? "var(--text-muted)" : "var(--text)",
              fontWeight: 700,
              fontSize: 13,
              cursor: currentIdx === 0 ? "not-allowed" : "pointer",
              opacity: currentIdx === 0 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>

          <button
            onClick={() => toggleFlag(q.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "2px solid",
              borderColor: a?.flagged ? "#F59E0B" : "var(--border)",
              background: a?.flagged ? "#FEF3C718" : "white",
              color: a?.flagged ? "#F59E0B" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            <Flag size={14} fill={a?.flagged ? "#F59E0B" : "none"} />
            {a?.flagged ? "Flagged" : "Flag"}
          </button>

          {/* Question navigator dots */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {questions.map((qq, i) => {
              const state = dotState(qq);
              const color = dotColor(state);
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrentIdx(i)}
                  title={`Q${i + 1}${answers[qq.id]?.flagged ? " (flagged)" : ""}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: i === currentIdx ? `2px solid ${color}` : "2px solid transparent",
                    background: i === currentIdx ? `${color}28` : color,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: i === currentIdx ? color : "#fff",
                    transition: "all 0.12s",
                    position: "relative",
                  }}
                >
                  {i + 1}
                  {answers[qq.id]?.flagged && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#F59E0B",
                        border: "1.5px solid white",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              if (currentIdx < questions.length - 1) {
                setCurrentIdx((i) => i + 1);
              } else {
                handleFinish();
              }
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--grad)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(124,92,252,0.25)",
            }}
          >
            {currentIdx < questions.length - 1 ? "Next →" : "Finish"}
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ─────────────────────────────────────────────────────────
  if (phase === "results") {
    const grade = gradeLabel(pct);
    const circumference = 2 * Math.PI * 42;
    const strokeDash = (pct / 100) * circumference;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Score circle */}
        <div className="card" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 100, height: 100 }}>
            <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={50} cy={50} r={42} fill="none" stroke="var(--bg)" strokeWidth={10} />
              <circle
                cx={50}
                cy={50}
                r={42}
                fill="none"
                stroke={grade.color}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${circumference}`}
                style={{ transition: "stroke-dasharray 1s ease" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: grade.color, lineHeight: 1 }}>
                {pct}%
              </span>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: grade.color }}>
              {grade.label}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 15, color: "var(--text-muted)" }}>
              {correctCount} / {questions.length} correct
            </p>
          </div>
        </div>

        {/* Subject breakdown */}
        {subjectBreakdown.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
              Breakdown by Subject
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {subjectBreakdown.map((s) => {
                const p = Math.round((s.correct / s.total) * 100);
                return (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: s.color,
                        minWidth: 10,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                      {s.abbr}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.correct}/{s.total}
                    </span>
                    <div
                      style={{
                        width: 80,
                        height: 6,
                        borderRadius: 3,
                        background: "var(--bg)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${p}%`,
                          height: "100%",
                          background: s.color,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.color, minWidth: 36, textAlign: "right" }}>
                      {p}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Focus Topics — per-session topic accuracy */}
        {(() => {
          const topicMap: Record<string, { correct: number; total: number; subject: string }> = {};
          for (const q of questions) {
            const key = q.topic;
            if (!topicMap[key]) {
              topicMap[key] = { correct: 0, total: 0, subject: q.subject };
            }
            topicMap[key].total += 1;
            if (answers[q.id]?.letter === q.correctLetter) {
              topicMap[key].correct += 1;
            }
          }
          const topicBreakdown = Object.entries(topicMap)
            .map(([topic, stats]) => ({
              topic,
              subject: stats.subject,
              correct: stats.correct,
              total: stats.total,
              pct: Math.round((stats.correct / stats.total) * 100),
              abbr: SUBJECTS.find(s => s.name === stats.subject)?.abbr ?? stats.subject,
              color: SUBJECTS.find(s => s.name === stats.subject)?.color ?? "#7C5CFC",
            }))
            .sort((a, b) => a.pct - b.pct);

          if (topicBreakdown.length === 0) return null;

          return (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                Focus Topics
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topicBreakdown.map((t) => {
                  const barColor = t.pct < 50 ? "#EF4444" : t.pct < 70 ? "#F59E0B" : "#10B981";
                  const showWarning = t.pct < 60 && t.total >= 2;
                  return (
                    <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px",
                        borderRadius: 6, background: `${t.color}18`, color: t.color,
                        minWidth: 52, textAlign: "center",
                      }}>
                        {t.abbr}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text)", fontWeight: 500, lineHeight: 1.3 }}>
                        {t.topic}
                      </span>
                      {showWarning && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: "#F59E0B", background: "rgba(245,158,11,0.1)",
                          padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap",
                        }}>
                          ⚠ Review this
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 32, textAlign: "right" }}>
                        {t.correct}/{t.total}
                      </span>
                      <div style={{ width: 72, height: 6, borderRadius: 3, background: "var(--bg)", overflow: "hidden" }}>
                        <div style={{ width: `${t.pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 34, textAlign: "right" }}>
                        {t.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* All-Time Weak Topics */}
        {(() => {
          const allSessions = data.mcatQuizSessions ?? [];
          const allQuestions = data.mcatQuestions ?? [];
          if (allSessions.length === 0 || allQuestions.length === 0) return null;

          const topicMap: Record<string, { correct: number; total: number; subject: string }> = {};
          for (const session of allSessions) {
            for (const attempt of session.attempts) {
              const q = allQuestions.find(qq => qq.id === attempt.questionId);
              if (!q) continue;
              const key = q.topic;
              if (!topicMap[key]) {
                topicMap[key] = { correct: 0, total: 0, subject: q.subject };
              }
              topicMap[key].total += 1;
              if (attempt.correct) topicMap[key].correct += 1;
            }
          }

          const weakTopics = Object.entries(topicMap)
            .filter(([, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.6)
            .map(([topic, stats]) => ({
              topic,
              subject: stats.subject,
              correct: stats.correct,
              total: stats.total,
              pct: Math.round((stats.correct / stats.total) * 100),
              abbr: SUBJECTS.find(s => s.name === stats.subject)?.abbr ?? stats.subject,
              color: SUBJECTS.find(s => s.name === stats.subject)?.color ?? "#7C5CFC",
            }))
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 6);

          if (weakTopics.length === 0) return null;

          return (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                All-Time Weak Topics
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {weakTopics.map((t) => {
                  const barColor = t.pct < 50 ? "#EF4444" : "#F59E0B";
                  return (
                    <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px",
                        borderRadius: 6, background: `${t.color}18`, color: t.color,
                        minWidth: 52, textAlign: "center",
                      }}>
                        {t.abbr}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text)", fontWeight: 500, lineHeight: 1.3 }}>
                        {t.topic}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--purple)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        → Learn Mode
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42, textAlign: "right" }}>
                        {t.correct}/{t.total}
                      </span>
                      <div style={{ width: 72, height: 6, borderRadius: 3, background: "var(--bg)", overflow: "hidden" }}>
                        <div style={{ width: `${t.pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 34, textAlign: "right" }}>
                        {t.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Missed questions */}
        {missedQuestions.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setShowMissed((v) => !v)}
              style={{
                width: "100%",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: showMissed ? "1px solid var(--border)" : "none",
              }}
            >
              <XCircle size={18} color="#EF4444" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1, textAlign: "left" }}>
                Missed Questions ({missedQuestions.length})
              </span>
              {showMissed ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </button>
            {showMissed && (
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {missedQuestions.map((q) => (
                  <div key={q.id} style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, marginBottom: 8 }}>
                      {q.stem}
                    </p>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#ECFDF5",
                        border: "1.5px solid #10B981",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#065F46",
                      }}
                    >
                      <strong>Correct:</strong> {q.correctLetter} – {q.choices.find((c) => c.letter === q.correctLetter)?.text}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                      {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flagged questions */}
        {flaggedQuestions.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setShowFlagged((v) => !v)}
              style={{
                width: "100%",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: showFlagged ? "1px solid var(--border)" : "none",
              }}
            >
              <Flag size={18} color="#F59E0B" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1, textAlign: "left" }}>
                Flagged for Review ({flaggedQuestions.length})
              </span>
              {showFlagged ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </button>
            {showFlagged && (
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {flaggedQuestions.map((q) => (
                  <div key={q.id} style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, marginBottom: 8 }}>
                      {q.stem}
                    </p>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#ECFDF5",
                        border: "1.5px solid #10B981",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#065F46",
                      }}
                    >
                      <strong>Correct:</strong> {q.correctLetter} – {q.choices.find((c) => c.letter === q.correctLetter)?.text}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                      {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => {
              setPhase("setup");
              setQuestions([]);
              setAnswers({});
              setRevealed(new Set());
              setCurrentIdx(0);
              setElapsed(0);
              setShowMissed(false);
              setShowFlagged(false);
            }}
            style={{
              flex: 1,
              padding: "12px 20px",
              borderRadius: 12,
              border: "2px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <RotateCcw size={15} />
            New Session
          </button>
          <button
            onClick={() => {
              setCurrentIdx(0);
              setPhase("quiz");
            }}
            style={{
              flex: 1,
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: "var(--grad)",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(124,92,252,0.3)",
            }}
          >
            <BookOpen size={15} />
            Review All
          </button>
        </div>
      </div>
    );
  }

  return null;
}
