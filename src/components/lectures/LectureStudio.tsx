"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, FileAudio, Trash2, Download, ChevronRight, KeyRound, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LectureDetail } from "./LectureDetail";

const COURSES = ["Physiology", "Biochemistry", "Microbiology", "Cell & Molecular Bio", "MCAT", "Other"];

interface LectureListItem {
  id: string; course: string; title: string; status: string; summary: string | null; createdAt: string;
}

type Phase =
  | { step: "idle" }
  | { step: "loading-ffmpeg" }
  | { step: "converting" }
  | { step: "transcribing"; done: number; total: number }
  | { step: "generating"; what: string }
  | { step: "error"; message: string };


const PIPELINE_STEPS = [
  { key: "convert",    label: "Extract audio" },
  { key: "transcribe", label: "Transcribe" },
  { key: "notes (part 1)", label: "Notes 1" },
  { key: "notes (part 2)", label: "Notes 2" },
  { key: "concept map", label: "Concept map" },
  { key: "exam focus", label: "Exam focus" },
  { key: "quiz", label: "Quiz" },
  { key: "flashcards", label: "Cards" },
  { key: "question bank 1/6", label: "Bank 1" },
  { key: "question bank 2/6", label: "Bank 2" },
  { key: "question bank 3/6", label: "Bank 3" },
  { key: "question bank 4/6", label: "Bank 4" },
  { key: "question bank 5/6", label: "Bank 5" },
  { key: "question bank 6/6", label: "Bank 6" },
];

function Pipeline({ phase }: { phase: Phase }) {
  const activeKey =
    phase.step === "loading-ffmpeg" || phase.step === "converting" ? "convert"
    : phase.step === "transcribing" ? "transcribe"
    : phase.step === "generating" ? phase.what
    : "";
  const activeIdx = PIPELINE_STEPS.findIndex(s => s.key === activeKey);

  const detail =
    phase.step === "loading-ffmpeg" ? "Loading the audio engine — first run takes ~15s"
    : phase.step === "converting" ? "Converting in your browser — nothing uploaded yet"
    : phase.step === "transcribing" ? `Chunk ${phase.done + 1} of ${phase.total}`
    : phase.step === "generating" ? "Claude is writing this section"
    : "";

  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--bg)" }}>
      <div className="flex flex-wrap gap-x-2 gap-y-3 mb-4">
        {PIPELINE_STEPS.map((s, i) => {
          const done = activeIdx > i;
          const active = activeIdx === i;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <motion.div
                animate={active ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={active ? { repeat: Infinity, duration: 1.4 } : {}}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  background: done ? "#2bb3a3" : active ? "var(--purple)" : "var(--surface)",
                  color: done || active ? "white" : "var(--text-muted)",
                  border: done || active ? "none" : "1.5px solid var(--border)",
                }}>
                {done ? <Check size={12} /> : i + 1}
              </motion.div>
              <span className="text-xs font-medium"
                style={{ color: active ? "var(--text)" : done ? "#2bb3a3" : "var(--text-muted)" }}>
                {s.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="w-4 h-px" style={{ background: "var(--border)" }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--surface)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#B4552F,#ec4899)" }}
          animate={{ width: `${((activeIdx + 1) / PIPELINE_STEPS.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }} />
      </div>

      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}>
          <Sparkles size={14} style={{ color: "var(--purple)" }} />
        </motion.span>
        {detail}
      </div>
    </div>
  );
}

export function LectureStudio() {
  const [lectures, setLectures] = useState<LectureListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [course, setCourse] = useState(COURSES[0]);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const [mp3Name, setMp3Name] = useState<string>("lecture.mp3");
  const fileInput = useRef<HTMLInputElement>(null);
  const [keyState, setKeyState] = useState<{ configured: boolean; hint: string | null; provider: string | null } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Grouped by course, numbered oldest-first within each so "Biochem 3" means
  // the third Biochem lecture and keeps meaning that as more are added.
  const byCourse = useMemo(() => {
    const groups = new Map<string, LectureListItem[]>();
    for (const l of lectures) {
      const g = groups.get(l.course) ?? [];
      g.push(l);
      groups.set(l.course, g);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([courseName, items]) => {
        const oldestFirst = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const numberOf = new Map(oldestFirst.map((l, i) => [l.id, i + 1]));
        // Newest at the top, but numbered by when it was recorded.
        const numbered: { lecture: LectureListItem; number: number }[] =
          [...oldestFirst].reverse().map(l => ({ lecture: l, number: numberOf.get(l.id)! }));
        return [courseName, numbered] as [string, typeof numbered];
      });
  }, [lectures]);
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const refreshKey = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/transcription-key");
      const d = await res.json();
      setKeyState({ configured: !!d.configured, hint: d.hint ?? null, provider: d.provider ?? null });
    } catch { setKeyState({ configured: false, hint: null, provider: null }); }
  }, []);

  useEffect(() => { refreshKey(); }, [refreshKey]);

  async function saveKey() {
    setKeySaving(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/settings/transcription-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setKeyError(d.error ?? "Could not save key"); return; }
      setKeyInput("");
      await refreshKey();
    } catch (e) {
      setKeyError(String(e));
    } finally {
      setKeySaving(false);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lectures");
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Couldn't load your lectures"));
      setLectures(data.lectures ?? []);
      setLoadError(null);
    } catch (e) {
      // Falling through to the empty state here would say "No lectures yet"
      // over a library that is sitting safely in the database — which reads
      // as data loss when it is only a failure to read.
      setLoadError(e instanceof Error ? e.message : "Couldn't load your lectures");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function processFile(file: File) {
    try {
      setPhase({ step: "loading-ffmpeg" });

      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setPhase({ step: "converting" });
      const inName = "input" + (file.name.match(/\.\w+$/)?.[0] ?? ".mp4");
      await ffmpeg.writeFile(inName, await fetchFile(file));

      // 16kHz mono 32kbps: perfect for speech, ~14MB/hour, ~1.2MB per 5-min chunk
      await ffmpeg.exec(["-i", inName, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "full.mp3"]);

      const fullData = (await ffmpeg.readFile("full.mp3")) as Uint8Array;
      const blobUrl = URL.createObjectURL(new Blob([fullData.slice()], { type: "audio/mpeg" }));
      setMp3Url(blobUrl);
      setMp3Name(file.name.replace(/\.\w+$/, "") + ".mp3");

      // Split into 5-minute chunks so each upload stays under Vercel's 4.5MB cap
      await ffmpeg.exec(["-i", "full.mp3", "-f", "segment", "-segment_time", "300", "-c", "copy", "chunk%03d.mp3"]);
      const dir = await ffmpeg.listDir("/");
      const chunkNames = dir
        .map(d => d.name)
        .filter(n => /^chunk\d+\.mp3$/.test(n))
        .sort();
      if (chunkNames.length === 0) throw new Error("audio conversion produced no chunks");

      const createRes = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          title: file.name.replace(/\.\w+$/, ""),
          chunksExpected: chunkNames.length,
        }),
      });
      const { id, error } = await createRes.json();
      if (!id) throw new Error(error ?? "could not create lecture");

      for (let i = 0; i < chunkNames.length; i++) {
        setPhase({ step: "transcribing", done: i, total: chunkNames.length });
        const data = (await ffmpeg.readFile(chunkNames[i])) as Uint8Array;
        let binary = "";
        const bytes = data;
        for (let j = 0; j < bytes.length; j += 0x8000) {
          binary += String.fromCharCode(...Array.from(bytes.subarray(j, j + 0x8000)));
        }
        const audioBase64 = btoa(binary);
        const res = await fetch(`/api/lectures/${id}/transcribe-chunk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: i, audioBase64 }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (d.error === "NO_TRANSCRIPTION_KEY") {
            await refreshKey();
            throw new Error("Add your transcription key above, then drop the file again — your MP3 is already downloadable below.");
          }
          throw new Error(d.error ?? `chunk ${i} failed (${res.status})`);
        }
      }

      await runGeneration(id);

      setPhase({ step: "idle" });
      await refresh();
      setSelected(id);
    } catch (e) {
      await refresh();
      setPhase({ step: "error", message: String(e).slice(0, 400) });
    }
  }

  // Three separate requests — one combined call exceeded Vercel's 60s cap
  async function runGeneration(id: string) {
    const stages: Array<{ key: string; label: string }> = [
      { key: "notes1", label: "notes (part 1)" },
      { key: "notes2", label: "notes (part 2)" },
      { key: "map",    label: "concept map" },
      { key: "exam",   label: "exam focus" },
      { key: "quiz",   label: "quiz" },
      { key: "cards",  label: "flashcards" },
    ];
    for (const st of stages) {
      setPhase({ step: "generating", what: st.label });
      const res = await fetch(`/api/lectures/${id}/finalize?stage=${st.key}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const detail = d.error ?? (res.status === 504 ? "timed out" : `HTTP ${res.status}`);
        throw new Error(`Generating ${st.label} failed: ${detail}. Your transcript is saved — press Resume on the lecture below to pick up from here.`);
      }
    }

    // Question bank: 6 batches, ~46 questions across every exam format
    for (let b = 0; b < 6; b++) {
      setPhase({ step: "generating", what: `question bank ${b + 1}/6` });
      const res = await fetch(`/api/lectures/${id}/bank?batch=${b}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(`Question bank batch ${b + 1} failed: ${d.error ?? res.status}. Press Resume to continue.`);
      }
    }
  }

  async function resumeGeneration(id: string) {
    try {
      await runGeneration(id);
      setPhase({ step: "idle" });
      await refresh();
      setSelected(id);
    } catch (e) {
      await refresh();
      setPhase({ step: "error", message: String(e).slice(0, 400) });
    }
  }

  async function removeLecture(id: string) {
    await fetch(`/api/lectures/${id}`, { method: "DELETE" });
    if (selected === id) setSelected(null);
    refresh();
  }

  if (selected) {
    return <LectureDetail id={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  const busy = phase.step !== "idle" && phase.step !== "error";

  return (
    <div className="space-y-6">
      {/* One-time Whisper key setup */}
      {keyState && !keyState.configured && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--purple)" }}>
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={18} style={{ color: "var(--purple)" }} />
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>One-time setup: transcription key</h3>
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            Paste a transcription API key — either one works:{" "}
            <a href="https://whisper-api.com/" target="_blank" rel="noreferrer"
              className="underline" style={{ color: "var(--purple)" }}>whisper-api.com</a>
            {" "}(keys start with <code>wai_</code>) or{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
              className="underline" style={{ color: "var(--purple)" }}>OpenAI</a>
            {" "}(keys start with <code>sk-</code>). Stored in your dashboard — no Vercel editing needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="wai_... or sk-..."
              className="flex-1 min-w-[240px] rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
            />
            <button
              onClick={saveKey}
              disabled={keySaving || !keyInput.trim()}
              className="px-5 py-2 rounded-lg font-semibold text-white text-sm disabled:opacity-40"
              style={{ background: "var(--purple)" }}>
              {keySaving ? "Verifying…" : "Save key"}
            </button>
          </div>
          {keyError && <p className="text-sm mt-2" style={{ color: "#c0392b" }}>{keyError}</p>}
        </div>
      )}

      {keyState?.configured && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Check size={14} style={{ color: "#2eaf6e" }} />
          Transcription key active{keyState.provider === "whisperapi" ? " — whisper-api.com" : keyState.provider === "openai" ? " — OpenAI Whisper" : ""} {keyState.hint ? `(${keyState.hint})` : ""}
        </div>
      )}

      {/* Upload card */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Course:</label>
          <select
            value={course}
            onChange={e => setCourse(e.target.value)}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
          >
            {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="video/mp4,video/*,audio/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
        />

        {!busy && (
          <motion.button
            onClick={() => fileInput.current?.click()}
            whileHover={{ scale: 1.01, borderColor: "var(--purple)" }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
              <Upload size={32} style={{ color: "var(--purple)" }} />
            </motion.span>
            <span className="font-semibold" style={{ color: "var(--text)" }}>Drop a lecture recording (MP4 or audio)</span>
            <span className="text-xs">Converted to MP3 in your browser → transcribed → notes, concept map, exam focus, quiz &amp; flashcards</span>
          </motion.button>
        )}

        {busy && <Pipeline phase={phase} />}

        {phase.step === "error" && (
          <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(220,60,60,0.08)", color: "#c0392b", border: "1px solid rgba(220,60,60,0.25)" }}>
            {phase.message}
            <button onClick={() => setPhase({ step: "idle" })} className="ml-3 underline">dismiss</button>
          </div>
        )}

        {mp3Url && (
          <a
            href={mp3Url}
            download={mp3Name}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--purple)" }}
          >
            <Download size={16} /> Download MP3 for the commute
          </a>
        )}
      </div>

      {/* Lecture list, grouped by course */}
      <div className="space-y-6">
        {lectures.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs" style={{ color: "var(--text-light)" }}>
              Everything here is saved permanently — notes, exam focus, questions and flashcards.
            </p>
            <a
              href="/api/lectures/export-all"
              className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0"
              style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              <Download size={13} /> Save a copy of everything
            </a>
          </div>
        )}
        {loadError ? (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1.5px solid var(--red)" }}
          >
            <p className="font-semibold text-sm" style={{ color: "var(--red)" }}>
              Couldn&apos;t reach the database — your lectures are safe
            </p>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Nothing has been deleted. They&apos;re stored on the server and will be
              here as soon as the connection is back.
              {/^.*402.*$/.test(loadError) || loadError.includes("quota")
                ? " The database is over its data transfer quota."
                : ""}
            </p>
            <button
              onClick={refresh}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl"
              style={{ background: "var(--text)", color: "var(--surface)" }}
            >
              Try again
            </button>
          </div>
        ) : lectures.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No lectures yet — drop your first recording above.</p>
        ) : null}
        {byCourse.map(([courseName, items]) => (
          <div key={courseName} className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>{courseName}</h3>
              <span className="text-xs" style={{ color: "var(--text-light)" }}>
                {items.length} lecture{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {items.map(({ lecture: l, number }) => (
          <motion.div
            key={l.id}
            layout
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(180,85,47,.13)" }}
            className="rounded-xl p-4 flex items-center gap-4 cursor-pointer"
            style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
            onClick={() => l.status === "ready" && setSelected(l.id)}
          >
            <span
              className="flex-shrink-0 w-9 h-9 rounded-full grid place-items-center text-xs font-bold tabular-nums"
              style={{ background: "var(--surface2)", color: "var(--purple)", border: "1px solid var(--border)" }}
              title={`Lecture ${number}`}
            >
              {number}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: "var(--text)" }}>{l.title}</div>
              <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {l.status === "ready"
                  ? (l.summary ?? "")
                  : `transcript saved — generation ${l.status === "error" ? "failed" : "unfinished"}`}
              </div>
            </div>
            {l.status !== "ready" && !busy && (
              <button
                onClick={e => { e.stopPropagation(); resumeGeneration(l.id); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--purple)" }}>
                Resume
              </button>
            )}
            {l.status === "ready" && (
              <a
                href={`/api/lectures/${l.id}/export`}
                onClick={e => e.stopPropagation()}
                className="p-2 rounded-lg"
                style={{ color: "var(--text-muted)" }}
                title="Save a copy — notes, exam focus, questions and flashcards"
              >
                <Download size={15} />
              </a>
            )}
            <button
              onClick={e => { e.stopPropagation(); removeLecture(l.id); }}
              className="p-2 rounded-lg"
              style={{ color: "var(--text-muted)" }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            {l.status === "ready" && <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />}
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
