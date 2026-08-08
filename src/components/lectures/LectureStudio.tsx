"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, FileAudio, Trash2, Download, ChevronRight, KeyRound, Check, Sparkles, Pencil, AlertTriangle, Paperclip } from "lucide-react";
import { motion } from "framer-motion";
import { LectureDetail } from "./LectureDetail";
import { uploadSlides } from "@/lib/slidesUpload";
import { pairDecks, isDeck, isMedia, stripExtension } from "@/lib/matchSlides";

const COURSES = ["Physiology", "Biochemistry", "Microbiology", "Cell & Molecular Bio", "MCAT", "Other"];

interface LectureListItem {
  id: string; course: string; title: string; status: string; summary: string | null; createdAt: string;
  chunksExpected?: number | null; chunksDone?: number; slidesName?: string | null;
}

// A lecture only ever reaches 'generating' once its transcript is stored, so
// 'transcribing' means transcription never finished. Saying "transcript saved"
// for both told her work was safe when nothing had been captured at all.
function statusLine(l: LectureListItem): string {
  if (l.status !== "transcribing") return "transcript saved — notes unfinished";
  const done = l.chunksDone ?? 0;
  const total = l.chunksExpected ?? 0;
  if (done === 0) return "nothing was saved — this recording needs uploading again";
  return `only ${done}${total ? ` of ${total}` : ""} pieces transcribed — upload didn't finish`;
}

/** Resume can only work if there is something on the server to resume from. */
function resumable(l: LectureListItem): boolean {
  if (l.status !== "transcribing") return true;
  return (l.chunksDone ?? 1) > 0;
}

// A whole week of lectures can be dropped at once and left alone. They run one
// at a time rather than in parallel: conversion is CPU-bound in this tab, and
// firing six transcription streams at the provider at once just trades a queue
// here for a rate limit there.
type ItemStatus = "waiting" | "working" | "done" | "failed";

interface QueueItem {
  key: string;
  file: File;
  course: string;
  title: string;
  status: ItemStatus;
  error?: string;
  lectureId?: string;
  mp3Url?: string;
  mp3Name?: string;
  /** Optional deck, attached to the lecture once it exists. */
  slidesFile?: File;
  slidesNote?: string;
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
    // Reading the deck sits between transcription and notes and has no step of
    // its own — showing one would mark it complete on every lecture without
    // slides. It holds the bar where it is and says what it's doing instead.
    : phase.step === "generating" ? (phase.what === "slides" ? "transcribe" : phase.what)
    : "";
  const activeIdx = PIPELINE_STEPS.findIndex(s => s.key === activeKey);

  const detail =
    phase.step === "loading-ffmpeg" ? "Loading the audio engine — first run takes ~15s"
    : phase.step === "converting" ? "Converting in your browser — nothing uploaded yet"
    : phase.step === "transcribing" ? `Chunk ${phase.done + 1} of ${phase.total}`
    : phase.step === "generating" ? (phase.what === "slides" ? "Reading your slides" : "Claude is writing this section")
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
          style={{ background: "linear-gradient(90deg,#B4552F,#D08A4A)" }}
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
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const slidesInput = useRef<HTMLInputElement>(null);
  const slidesTarget = useRef<{ kind: "queue" | "lecture"; id: string } | null>(null);
  const [slidesBusy, setSlidesBusy] = useState<string | null>(null);
  const [slidesMsg, setSlidesMsg] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  // Decks dropped in that no recording claimed. Held rather than discarded so
  // she can point them at the right lecture herself.
  const [looseDecks, setLooseDecks] = useState<File[]>([]);
  const [keyState, setKeyState] = useState<{ configured: boolean; hint: string | null; provider: string | null; valid: boolean | null } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Picking the wrong subject on upload shouldn't cost the recording.
  const changeLecture = useCallback(async (id: string, fields: { course?: string; title?: string }) => {
    const res = await fetch(`/api/lectures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      setEditing(null);
      refreshRef.current?.();
    }
  }, []);

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
  const [showKeyForm, setShowKeyForm] = useState(false);

  const refreshKey = useCallback(async () => {
    try {
      // verify=1 so a rotated key reads as broken here instead of at upload time.
      const res = await fetch("/api/settings/transcription-key?verify=1", { cache: "no-store" });
      const d = await res.json();
      setKeyState({ configured: !!d.configured, hint: d.hint ?? null, provider: d.provider ?? null, valid: d.valid ?? null });
    } catch { setKeyState({ configured: false, hint: null, provider: null, valid: null }); }
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
      setShowKeyForm(false);
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

  const refreshRef = useRef<null | (() => void)>(null);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { refresh(); }, [refresh]);

  // ffmpeg.wasm costs several seconds and a ~30MB fetch to start, so one
  // instance is kept for the whole batch. Its filesystem persists between runs,
  // which means every file it wrote has to be removed afterwards — otherwise a
  // short lecture inherits the leftover chunks of a longer one before it.
  const ffmpegRef = useRef<unknown>(null);

  async function getFFmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current as never;
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg as never;
  }

  async function wipeWorkspace(ffmpeg: {
    listDir: (p: string) => Promise<{ name: string }[]>;
    deleteFile: (n: string) => Promise<unknown>;
  }) {
    try {
      const dir = await ffmpeg.listDir("/");
      for (const d of dir) {
        if (/^(chunk\d+\.mp3|full\.mp3|input\.[\w]+)$/.test(d.name)) {
          await ffmpeg.deleteFile(d.name).catch(() => {});
        }
      }
    } catch { /* a fresh instance has nothing to clear */ }
  }

  // The ref is the source of truth, not a mirror of state. runQueue picks the
  // next item the instant the previous one returns, which can be before React
  // has re-rendered — a ref synced from state in an effect would still show the
  // finished item as "waiting" and the loop would run it again forever.
  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);

  const commit = useCallback((next: QueueItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const patchItem = useCallback((key: string, fields: Partial<QueueItem>) => {
    commit(queueRef.current.map(it => (it.key === key ? { ...it, ...fields } : it)));
  }, [commit]);

  async function processOne(item: QueueItem) {
    patchItem(item.key, { status: "working", error: undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ffmpeg: any = null;
    try {
      setPhase({ step: "loading-ffmpeg" });
      ffmpeg = await getFFmpeg();
      const { fetchFile } = await import("@ffmpeg/util");
      await wipeWorkspace(ffmpeg);

      setPhase({ step: "converting" });
      const inName = "input" + (item.file.name.match(/\.\w+$/)?.[0] ?? ".mp4");
      await ffmpeg.writeFile(inName, await fetchFile(item.file));

      // 16kHz mono 32kbps: perfect for speech, ~14MB/hour, ~1.2MB per 5-min chunk
      await ffmpeg.exec(["-i", inName, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "full.mp3"]);

      const fullData = (await ffmpeg.readFile("full.mp3")) as Uint8Array;
      const blobUrl = URL.createObjectURL(new Blob([fullData.slice()], { type: "audio/mpeg" }));
      patchItem(item.key, { mp3Url: blobUrl, mp3Name: item.title + ".mp3" });

      // Split into 5-minute chunks so each upload stays under Vercel's 4.5MB cap
      await ffmpeg.exec(["-i", "full.mp3", "-f", "segment", "-segment_time", "300", "-c", "copy", "chunk%03d.mp3"]);
      const dir = await ffmpeg.listDir("/");
      const chunkNames = dir
        .map((d: { name: string }) => d.name)
        .filter((n: string) => /^chunk\d+\.mp3$/.test(n))
        .sort();
      if (chunkNames.length === 0) throw new Error("audio conversion produced no chunks");

      const createRes = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: item.course,
          title: item.title,
          chunksExpected: chunkNames.length,
        }),
      });
      const { id, error } = await createRes.json();
      if (!id) throw new Error(error ?? "could not create lecture");
      patchItem(item.key, { lectureId: id });

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
            throw new Error("No transcription key saved. Add one above, then press Retry.");
          }
          throw new Error(d.error ?? `chunk ${i} failed (${res.status})`);
        }
      }

      // Slides go up before the notes are written, so they're folded in on the
      // first pass. A deck that fails must not cost her the transcribed
      // lecture, so this never throws — it records a note and generation runs
      // from the recording alone.
      if (item.slidesFile) {
        setPhase({ step: "generating", what: "slides" });
        try {
          await uploadSlides(id, item.slidesFile);
        } catch (e) {
          patchItem(item.key, {
            slidesNote: `Slides couldn't be read (${e instanceof Error ? e.message : String(e)}). Notes were written from the recording only.`,
          });
        }
      }

      await runGeneration(id);
      patchItem(item.key, { status: "done" });
    } catch (e) {
      patchItem(item.key, { status: "failed", error: String(e).slice(0, 400) });
    } finally {
      if (ffmpeg) await wipeWorkspace(ffmpeg);
      setPhase({ step: "idle" });
      await refresh();
    }
  }

  // One at a time, and a failure never takes the rest of the batch with it.
  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      for (;;) {
        const next = queueRef.current.find(it => it.status === "waiting");
        if (!next) break;
        await processOne(next);
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recordings and slide decks can be dropped together — they're separated
  // here and matched on filename, which is how the course posts them anyway.
  function addFiles(files: File[]) {
    if (!files.length) return;

    const media = files.filter(isMedia);
    const decks = files.filter(isDeck);
    const ignored = files.filter(f => !isMedia(f) && !isDeck(f));

    const newItems: QueueItem[] = media.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      course,
      title: stripExtension(file.name),
      status: "waiting",
    }));

    const next = [...queueRef.current, ...newItems];

    // Anything still waiting and deckless is fair game, so dropping the
    // recordings first and the slides afterwards works the same as together.
    const candidates = next.filter(it => it.status === "waiting" && !it.slidesFile);
    const pool = [...looseDecks, ...decks];

    const { pairs, unmatchedDecks } = pairDecks<QueueItem, File>(
      candidates, pool, x => (x instanceof File ? x.name : x.file.name));

    const deckFor: Record<string, File> = {};
    for (const p of pairs) if (p.deck) deckFor[p.recording.key] = p.deck;

    commit(next.map(it => (deckFor[it.key] ? { ...it, slidesFile: deckFor[it.key] } : it)));
    setLooseDecks(unmatchedDecks);

    if (ignored.length) {
      setSlidesMsg({
        id: "__drop__",
        text: `Skipped ${ignored.map(f => f.name).join(", ")} — recordings or PDF/.pptx slides only.`,
        bad: true,
      });
    }
    runQueue();
  }

  /** Point a stray deck at a specific queued recording. */
  function assignLooseDeck(deckName: string, itemKey: string) {
    const deck = looseDecks.find(d => d.name === deckName);
    if (!deck) return;
    patchItem(itemKey, { slidesFile: deck, slidesNote: undefined });
    setLooseDecks(ds => ds.filter(d => d.name !== deckName));
  }

  function retryItem(key: string) {
    patchItem(key, { status: "waiting", error: undefined });
    runQueue();
  }

  function dropItem(key: string) {
    commit(queueRef.current.filter(it => it.key !== key));
  }

  // Closing the tab mid-batch abandons whatever is still converting.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

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

  // Attaching a deck to a lecture that already exists.
  async function attachSlides(lectureId: string, file: File) {
    setSlidesBusy(lectureId);
    setSlidesMsg(null);
    try {
      await uploadSlides(lectureId, file, (stage) => {
        setSlidesMsg({
          id: lectureId,
          text: stage === "digesting" ? "Reading the slides…" : "Uploading the slides…",
        });
      });
      setSlidesMsg({ id: lectureId, text: "Slides attached. Redo the notes to fold them in." });
      await refresh();
    } catch (e) {
      setSlidesMsg({ id: lectureId, text: e instanceof Error ? e.message : String(e), bad: true });
    } finally {
      setSlidesBusy(null);
    }
  }

  async function removeSlides(lectureId: string) {
    setSlidesBusy(lectureId);
    try {
      await fetch(`/api/lectures/${lectureId}/slides`, { method: "DELETE" });
      setSlidesMsg(null);
      await refresh();
    } finally {
      setSlidesBusy(null);
    }
  }

  function pickSlidesFor(kind: "queue" | "lecture", id: string) {
    slidesTarget.current = { kind, id };
    slidesInput.current?.click();
  }

  async function removeLecture(id: string) {
    await fetch(`/api/lectures/${id}`, { method: "DELETE" });
    if (selected === id) setSelected(null);
    refresh();
  }

  if (selected) {
    return <LectureDetail id={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  // Tracks the batch, not a single stage — `phase` drops back to idle between
  // queued items, which would otherwise flicker the whole UI back to ready.
  const busy = running;

  return (
    <div className="space-y-6">
      {/* A saved key the provider now rejects. Worth its own warning, because
          the upload looks fine until every chunk fails. */}
      {keyState?.configured && keyState.valid === false && (
        <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5"
          style={{ color: "var(--text)", background: "rgba(193,74,58,0.08)", border: "1px solid rgba(193,74,58,0.3)" }}>
          <AlertTriangle size={14} style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }} />
          <span>
            Your saved transcription key {keyState.hint ? `(${keyState.hint}) ` : ""}is being rejected —
            it&apos;s been rotated or revoked. Paste a current one below before uploading.
          </span>
        </div>
      )}

      {/* Key setup. Also shown when a saved key is being rejected — telling her
          to paste a new one while hiding the only input is a dead end. */}
      {keyState && (!keyState.configured || keyState.valid === false || showKeyForm) && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--purple)" }}>
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={18} style={{ color: "var(--purple)" }} />
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>
              {keyState.configured ? "Replace your transcription key" : "One-time setup: transcription key"}
            </h3>
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
            {showKeyForm && keyState.valid !== false && (
              <button
                onClick={() => { setShowKeyForm(false); setKeyInput(""); setKeyError(null); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: "var(--text-muted)", border: "1.5px solid var(--border)" }}>
                Cancel
              </button>
            )}
          </div>
          {keyError && <p className="text-sm mt-2" style={{ color: "#c0392b" }}>{keyError}</p>}
        </div>
      )}

      {keyState?.configured && keyState.valid !== false && !showKeyForm && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Check size={14} style={{ color: "#2eaf6e" }} />
          Transcription key active{keyState.provider === "whisperapi" ? " — whisper-api.com" : keyState.provider === "openai" ? " — OpenAI Whisper" : ""} {keyState.hint ? `(${keyState.hint})` : ""}
          {/* A working key still needs to be changeable, or the next rotation
              leaves her with no way in. */}
          <button onClick={() => setShowKeyForm(true)} className="underline" style={{ color: "var(--purple)" }}>
            Change
          </button>
        </div>
      )}

      {/* Upload card */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Course:</label>
          <select
            value={course}
            onChange={e => setCourse(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
          >
            {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept="video/*,audio/*,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />

        {/* One picker serves both the queue rows and the finished lectures;
            slidesTarget records which asked for it. */}
        <input
          ref={slidesInput}
          type="file"
          accept=".pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            const t = slidesTarget.current;
            e.target.value = "";
            if (!f || !t) return;
            if (t.kind === "queue") patchItem(t.id, { slidesFile: f, slidesNote: undefined });
            else attachSlides(t.id, f);
          }}
        />

        {/* Always available, even mid-batch — more can be added to the back of
            the queue while earlier ones are still running. */}
        <motion.button
          onClick={() => fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3"
          style={{
            borderColor: dragOver ? "var(--purple)" : "var(--border)",
            background: dragOver ? "rgba(180,85,47,0.05)" : "transparent",
            color: "var(--text-muted)",
          }}
        >
          <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
            <Upload size={32} style={{ color: "var(--purple)" }} />
          </motion.span>
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            Drop your recordings and their slides together
          </span>
          <span className="text-xs">
            Slides are matched to recordings by filename — they queue up and run one after another
          </span>
        </motion.button>

        {slidesMsg?.id === "__drop__" && (
          <p className="text-xs mt-3" style={{ color: "var(--red)" }}>{slidesMsg.text}</p>
        )}

        {/* Decks whose filename didn't match any recording. Rather than
            guessing, she says which lecture they belong to. */}
        {looseDecks.length > 0 && (
          <div className="mt-4 rounded-xl p-3 space-y-2"
            style={{ background: "rgba(180,85,47,0.05)", border: "1px solid rgba(180,85,47,0.25)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              {looseDecks.length === 1 ? "This deck didn't match a recording" : "These decks didn't match a recording"}
            </p>
            {looseDecks.map(d => (
              <div key={d.name} className="flex items-center gap-2 flex-wrap">
                <Paperclip size={12} style={{ color: "var(--text-light)", flexShrink: 0 }} />
                <span className="text-xs truncate max-w-[220px]" style={{ color: "var(--text-muted)" }}>{d.name}</span>
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) assignLooseDeck(d.name, e.target.value); }}
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  <option value="">Belongs to…</option>
                  {queue.filter(it => it.status === "waiting").map(it => (
                    <option key={it.key} value={it.key}>{it.title}</option>
                  ))}
                </select>
                <button onClick={() => setLooseDecks(ds => ds.filter(x => x.name !== d.name))}
                  className="text-xs underline" style={{ color: "var(--text-light)" }}>
                  discard
                </button>
              </div>
            ))}
            {!queue.some(it => it.status === "waiting") && (
              <p className="text-[11px]" style={{ color: "var(--text-light)" }}>
                Drop the matching recording and these will attach to it.
              </p>
            )}
          </div>
        )}

        {/* The batch */}
        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.map(it => (
              <div key={it.key} className="rounded-xl p-3"
                style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex-shrink-0">
                    {it.status === "working" ? <Loader2 size={15} className="animate-spin" style={{ color: "var(--purple)" }} />
                      : it.status === "done" ? <Check size={15} style={{ color: "#2eaf6e" }} />
                      : it.status === "failed" ? <AlertTriangle size={15} style={{ color: "var(--red)" }} />
                      : <FileAudio size={15} style={{ color: "var(--text-light)" }} />}
                  </span>
                  <span className="text-sm font-semibold flex-1 min-w-[160px] truncate" style={{ color: "var(--text)" }}>
                    {it.title}
                  </span>

                  {/* Course is still changeable right up until it starts. */}
                  {it.status === "waiting" ? (
                    <select
                      value={it.course}
                      onChange={e => patchItem(it.key, { course: e.target.value })}
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                    >
                      {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-light)" }}>{it.course}</span>
                  )}

                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {it.status === "waiting" ? "waiting"
                      : it.status === "done" ? "done"
                      : it.status === "failed" ? "failed"
                      : "working"}
                  </span>

                  {it.mp3Url && (
                    <a href={it.mp3Url} download={it.mp3Name} title="MP3 for the commute"
                      className="p-1.5 rounded-lg" style={{ color: "var(--purple)" }}>
                      <Download size={14} />
                    </a>
                  )}
                  {it.status === "failed" && (
                    <button onClick={() => retryItem(it.key)} className="text-xs font-semibold underline"
                      style={{ color: "var(--purple)" }}>
                      Retry
                    </button>
                  )}
                  {it.status !== "working" && (
                    <button onClick={() => dropItem(it.key)} className="p-1.5 rounded-lg" title="Remove from this list"
                      style={{ color: "var(--text-light)" }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Slides for this recording, attached before the notes are written. */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Paperclip size={12} style={{ color: "var(--text-light)", flexShrink: 0 }} />
                  {it.slidesFile ? (
                    <>
                      <span className="text-xs truncate max-w-[240px]" style={{ color: "var(--text-muted)" }}>
                        {it.slidesFile.name}
                      </span>
                      {it.status === "waiting" && (
                        <button onClick={() => patchItem(it.key, { slidesFile: undefined })}
                          className="text-xs underline" style={{ color: "var(--text-light)" }}>
                          remove
                        </button>
                      )}
                    </>
                  ) : it.status === "waiting" ? (
                    <button onClick={() => pickSlidesFor("queue", it.key)}
                      className="text-xs underline" style={{ color: "var(--purple)" }}>
                      Add the slides for this lecture (PDF or .pptx)
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-light)" }}>no slides</span>
                  )}
                </div>

                {it.status === "working" && <div className="mt-2"><Pipeline phase={phase} /></div>}
                {it.slidesNote && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--red)" }}>{it.slidesNote}</p>
                )}
                {it.error && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: "#c0392b" }}>{it.error}</p>
                )}
              </div>
            ))}

            {running && (
              <p className="text-xs" style={{ color: "var(--text-light)" }}>
                Keep this page open until the last one finishes — the conversion runs here in your browser.
              </p>
            )}
            {!running && queue.some(it => it.status === "done") && (
              <button
                onClick={() => commit(queueRef.current.filter(it => it.status !== "done"))}
                className="text-xs font-semibold underline" style={{ color: "var(--text-muted)" }}>
                Clear the finished ones
              </button>
            )}
          </div>
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
              <div key={l.id} className="space-y-2">
          <motion.div
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
                {l.status === "ready" ? (l.summary ?? "") : statusLine(l)}
              </div>
            </div>
            {l.status !== "ready" && !busy && resumable(l) && (
              <button
                onClick={e => { e.stopPropagation(); resumeGeneration(l.id); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--purple)" }}>
                Resume
              </button>
            )}
            {/* Slides can be added to a lecture that's already been processed —
                the notes are redone from the recording plus the deck. */}
            <button
              onClick={e => { e.stopPropagation(); pickSlidesFor("lecture", l.id); }}
              disabled={slidesBusy === l.id}
              className="p-2 rounded-lg disabled:opacity-40"
              style={{ color: l.slidesName ? "var(--purple)" : "var(--text-muted)" }}
              title={l.slidesName ? `Slides attached: ${l.slidesName} — click to replace` : "Attach the slides for this lecture"}
            >
              {slidesBusy === l.id ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setEditing(editing === l.id ? null : l.id); }}
              className="p-2 rounded-lg"
              style={{ color: editing === l.id ? "var(--purple)" : "var(--text-muted)" }}
              title="Change the course or title"
            >
              <Pencil size={15} />
            </button>
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

              {/* Attached deck: what it is, and the one action that makes it
                  count — the notes already on file were written without it. */}
              {(l.slidesName || (slidesMsg && slidesMsg.id === l.id)) && (
                <div className="rounded-xl px-4 py-2.5 -mt-1 flex items-center gap-2 flex-wrap"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <Paperclip size={12} style={{ color: "var(--text-light)", flexShrink: 0 }} />
                  {l.slidesName && (
                    <span className="text-xs truncate max-w-[260px]" style={{ color: "var(--text-muted)" }}>
                      {l.slidesName}
                    </span>
                  )}
                  {slidesMsg?.id === l.id && (
                    <span className="text-xs" style={{ color: slidesMsg.bad ? "var(--red)" : "var(--text-muted)" }}>
                      {slidesMsg.text}
                    </span>
                  )}
                  {l.slidesName && !busy && slidesBusy !== l.id && (
                    <>
                      <button
                        onClick={() => resumeGeneration(l.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                        style={{ background: "var(--purple)" }}>
                        Redo the notes with these slides
                      </button>
                      <button onClick={() => removeSlides(l.id)}
                        className="text-xs underline" style={{ color: "var(--text-light)" }}>
                        remove slides
                      </button>
                    </>
                  )}
                </div>
              )}

              {editing === l.id && (
                <div
                  className="rounded-xl p-4 space-y-3 -mt-1"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Course
                    </label>
                    <select
                      defaultValue={l.course}
                      onChange={e => changeLecture(l.id, { course: e.target.value })}
                    >
                      {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Title
                    </label>
                    <input
                      type="text"
                      defaultValue={l.title}
                      onBlur={e => {
                        const t = e.target.value.trim();
                        if (t && t !== l.title) changeLecture(l.id, { title: t });
                      }}
                    />
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-light)" }}>
                    Changing the course moves this lecture into that group and renumbers both.
                    The notes, questions and flashcards are untouched.
                  </p>
                </div>
              )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
