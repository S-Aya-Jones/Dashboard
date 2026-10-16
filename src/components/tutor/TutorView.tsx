"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Volume2, GraduationCap, Target, Brain, ClipboardList } from "lucide-react";
import { say } from "@/lib/coachVoice";

// A tutor that knows her lectures and her mistakes.
//
// The point isn't that it can explain biochemistry — anything can. It's that
// it explains it from her professor's framing, and it already knows which
// questions she has got wrong.

const COURSES = ["Physiology", "Biochemistry", "Microbiology", "Cell & Molecular Bio", "MCAT", "Other"];

const MODES = [
  { id: "explain",      label: "Teach me",       icon: GraduationCap,  hint: "Explain a concept properly" },
  { id: "quiz",         label: "Quiz me",        icon: ClipboardList,  hint: "One exam-level question at a time" },
  { id: "drill-misses", label: "My weak spots",  icon: Target,         hint: "Work through what you've got wrong" },
  { id: "exam-prep",    label: "Exam prep",      icon: Brain,          hint: "What to study first" },
] as const;

type Mode = typeof MODES[number]["id"];
interface Turn { role: "user" | "assistant"; content: string }

interface Material {
  hasMaterial: boolean;
  lectures: { id: string; title: string }[];
  missCount: number;
}

export function TutorView({
  compact = false,
  course: courseProp,
  lectureId: lectureIdProp,
}: { compact?: boolean; course?: string; lectureId?: string } = {}) {
  // Seeded from whatever study view is open, so the dock starts on the right
  // material rather than on the first course in the list.
  const [course, setCourse]   = useState(
    courseProp && COURSES.includes(courseProp) ? courseProp : COURSES[0]);
  const [lectureId, setLectureId] = useState("");
  const [mode, setMode]       = useState<Mode>("explain");
  const [material, setMaterial] = useState<Material | null>(null);
  const [turns, setTurns]     = useState<Turn[]>([]);
  const [input, setInput]     = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The lecture the page is showing. Held in a ref because changing course
  // clears the selection, and the reselect has to happen after the new
  // course's lectures have actually loaded.
  const wantLecture = useRef<string | undefined>(lectureIdProp);
  useEffect(() => {
    wantLecture.current = lectureIdProp;
    if (lectureIdProp) setLectureId(lectureIdProp);
  }, [lectureIdProp]);

  useEffect(() => {
    if (courseProp && COURSES.includes(courseProp)) setCourse(courseProp);
  }, [courseProp]);

  useEffect(() => {
    setMaterial(null);
    setLectureId("");
    fetch(`/api/tutor?course=${encodeURIComponent(course)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setMaterial(d);
        const want = wantLecture.current;
        if (want && (d.lectures ?? []).some((l: { id: string }) => l.id === want)) {
          setLectureId(want);
        }
      })
      .catch(() => {});
  }, [course]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, lectureId: lectureId || undefined, mode, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The tutor couldn't answer");
      setTurns([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The tutor couldn't answer");
      // Keep her question on screen rather than losing what she typed.
      setTurns(next);
    } finally {
      setBusy(false);
    }
  }

  const modeMeta = MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-4">
      {/* What it's working from */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        <div className={compact ? "grid gap-2" : "grid sm:grid-cols-2 gap-2"}>
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={lectureId}
            onChange={(e) => setLectureId(e.target.value)}
            disabled={!material?.lectures.length}
          >
            <option value="">All lectures in this course</option>
            {material?.lectures.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>

        <p className="text-xs" style={{ color: material?.hasMaterial ? "var(--green)" : "var(--text-light)" }}>
          {material === null
            ? "Checking what it has to work from…"
            : material.hasMaterial
            ? `Working from ${material.lectures.length} lecture${material.lectures.length === 1 ? "" : "s"}` +
              (material.missCount ? ` and ${material.missCount} question${material.missCount === 1 ? "" : "s"} you've missed` : "")
            : "No processed lectures in this course yet — it can still teach, but not from your professor's material."}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {MODES.map(({ id, label, icon: Icon }) => {
            const on = mode === id;
            return (
              <button
                key={id}
                onClick={() => setMode(id)}
                className="text-xs font-semibold px-3 py-2 rounded-full flex items-center gap-1.5 transition-all"
                style={{
                  background: on ? "var(--text)" : "transparent",
                  color:      on ? "var(--surface)" : "var(--text-muted)",
                  border:     `1px solid ${on ? "var(--text)" : "var(--border)"}`,
                }}
              >
                <Icon size={12} /> {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-light)" }}>{modeMeta.hint}</p>
      </div>

      {/* Conversation */}
      {turns.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
        >
          <p className="font-serif text-lg" style={{ color: "var(--text)" }}>
            {mode === "drill-misses"
              ? "Start with what you've been getting wrong"
              : mode === "quiz"
              ? "Ready when you are"
              : "Ask it anything from this course"}
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {(mode === "drill-misses"
              ? ["Start drilling my weak spots"]
              : mode === "quiz"
              ? ["Start quizzing me"]
              : mode === "exam-prep"
              ? ["What should I study first?", "What am I weakest on?"]
              : ["Explain the hardest thing in my last lecture", "What did I miss most recently?"]
            ).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-2 rounded-full"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {turns.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl px-4 py-3"
              style={
                t.role === "user"
                  ? { background: "var(--surface2)", border: "1px solid var(--border)", marginLeft: compact ? "8%" : "12%" }
                  : { background: "var(--surface)", border: "1.5px solid var(--border)", marginRight: compact ? "0" : "6%" }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1" style={{ color: "var(--text)" }}>
                  {t.content}
                </p>
                {t.role === "assistant" && (
                  <button
                    onClick={() => say(t.content.slice(0, 900))}
                    aria-label="Read this aloud"
                    className="flex-shrink-0 p-1.5 rounded-lg"
                    style={{ color: "var(--text-light)" }}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={14} className="animate-spin" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}

      {/* Ask */}
      <div
        className={`flex items-end gap-2 rounded-2xl p-2 sticky ${compact ? "bottom-0" : "bottom-4"}`}
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          rows={1}
          placeholder={mode === "quiz" ? "Your answer…" : "Ask about anything in this course…"}
          className="flex-1 bg-transparent border-0 outline-none text-sm resize-none py-2 px-2"
          style={{ color: "var(--text)", maxHeight: 140 }}
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 disabled:opacity-40"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
