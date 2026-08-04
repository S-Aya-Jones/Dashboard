"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, FileAudio, Trash2, Download, ChevronRight } from "lucide-react";
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
  | { step: "generating" }
  | { step: "error"; message: string };

export function LectureStudio() {
  const [lectures, setLectures] = useState<LectureListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [course, setCourse] = useState(COURSES[0]);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const [mp3Name, setMp3Name] = useState<string>("lecture.mp3");
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lectures");
      const data = await res.json();
      if (data.lectures) setLectures(data.lectures);
    } catch { /* offline */ }
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
          throw new Error(d.error ?? `chunk ${i} failed (${res.status})`);
        }
      }

      setPhase({ step: "generating" });
      const fin = await fetch(`/api/lectures/${id}/finalize`, { method: "POST" });
      if (!fin.ok) {
        const d = await fin.json().catch(() => ({}));
        throw new Error(d.error ?? `generation failed (${fin.status})`);
      }

      setPhase({ step: "idle" });
      await refresh();
      setSelected(id);
    } catch (e) {
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
          <button
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3 transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <Upload size={32} style={{ color: "var(--purple)" }} />
            <span className="font-semibold" style={{ color: "var(--text)" }}>Drop a lecture recording (MP4 or audio)</span>
            <span className="text-xs">Converted to MP3 in your browser → transcribed → notes, concept map, quiz &amp; flashcards</span>
          </button>
        )}

        {busy && (
          <div className="flex items-center gap-3 p-6 rounded-xl" style={{ background: "var(--bg)" }}>
            <Loader2 className="animate-spin" style={{ color: "var(--purple)" }} />
            <div style={{ color: "var(--text)" }}>
              {phase.step === "loading-ffmpeg" && "Loading audio engine (first time takes ~15s)…"}
              {phase.step === "converting" && "Extracting audio → MP3 (in your browser, nothing uploaded yet)…"}
              {phase.step === "transcribing" && `Transcribing chunk ${phase.done + 1} of ${phase.total}…`}
              {phase.step === "generating" && "Claude is writing your notes, concept map, quiz and flashcards…"}
            </div>
          </div>
        )}

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

      {/* Lecture list */}
      <div className="space-y-3">
        {lectures.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No lectures yet — drop your first recording above.</p>
        )}
        {lectures.map(l => (
          <div
            key={l.id}
            className="rounded-xl p-4 flex items-center gap-4 cursor-pointer"
            style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
            onClick={() => l.status === "ready" && setSelected(l.id)}
          >
            <FileAudio size={20} style={{ color: "var(--purple)", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: "var(--text)" }}>{l.title}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {l.course} · {l.status === "ready" ? (l.summary ?? "") : `status: ${l.status}`}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); removeLecture(l.id); }}
              className="p-2 rounded-lg"
              style={{ color: "var(--text-muted)" }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            {l.status === "ready" && <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
