"use client";

import { useState, useRef } from "react";
import { Camera, Video, Sparkles, Loader2, X, Save, RefreshCw } from "lucide-react";
import { DashboardData, MCATQuestion } from "@/types/dashboard";
import { TutorAvatar } from "./TutorAvatar";
import { id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

type Mode = "photo" | "transcript";

const TONES = [
  { id: "plain",     label: "Plain & Clear" },
  { id: "gossip",     label: "Gossip" },
  { id: "truecrime",  label: "True Crime" },
  { id: "hype",       label: "Hype Coach" },
  { id: "housewives", label: "Real Housewives" },
];

interface Result {
  narration: string;
  highYield: string[];
  question: Omit<MCATQuestion, "id" | "createdAt">;
}

export function StudyCaptureView({ update }: Props) {
  const [mode, setMode] = useState<Mode>("photo");
  const [tone, setTone] = useState("plain");
  const [photos, setPhotos] = useState<File[]>([]);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setRevealed(false);
    setSelected(null);
    setSaved(false);
    setError(null);
  }

  async function generate() {
    reset();
    setLoading(true);
    try {
      let res: Response;
      if (mode === "photo") {
        if (!photos.length) { setError("Add at least one photo first."); setLoading(false); return; }
        const form = new FormData();
        photos.forEach((p) => form.append("photos", p));
        form.append("tone", tone);
        res = await fetch("/api/mcat/study-capture", { method: "POST", body: form });
      } else {
        if (!transcript.trim()) { setError("Paste a transcript first."); setLoading(false); return; }
        res = await fetch("/api/mcat/study-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, tone }),
        });
      }
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch {
      setError("Something went wrong generating this. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function saveQuestion() {
    if (!result) return;
    const newQuestion: MCATQuestion = {
      ...result.question,
      id: id(),
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, mcatQuestions: [...(d.mcatQuestions ?? []), newQuestion] }));
    setSaved(true);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Study Scan</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Snap your notes or paste a video transcript — get it read back to you, the high-yield facts pulled out, and a practice question made on the spot.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setMode("photo"); reset(); }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={mode === "photo"
            ? { background: "var(--grad)", color: "#fff" }
            : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Camera size={15} /> Photos
        </button>
        <button onClick={() => { setMode("transcript"); reset(); }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={mode === "transcript"
            ? { background: "var(--grad)", color: "#fff" }
            : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Video size={15} /> Video Transcript
        </button>
      </div>

      {/* Tone selector */}
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => (
          <button key={t.id} onClick={() => setTone(t.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={tone === t.id
              ? { background: "#7C5CFC", color: "#fff" }
              : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      {mode === "photo" ? (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
            className="hidden"
            onChange={(e) => {
              const newFiles = Array.from(e.target.files ?? []);
              if (newFiles.length) setPhotos((prev) => [...prev, ...newFiles]);
              e.target.value = "";
            }} />
          <input ref={libraryInputRef} type="file" accept="image/*" multiple
            className="hidden"
            onChange={(e) => {
              const newFiles = Array.from(e.target.files ?? []);
              if (newFiles.length) setPhotos((prev) => [...prev, ...newFiles]);
              e.target.value = "";
            }} />
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl"
              style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
              <Camera size={24} />
              <span className="text-sm font-medium">Take Photo</span>
            </button>
            <button onClick={() => libraryInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl"
              style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
              <Camera size={24} />
              <span className="text-sm font-medium">Choose Photos</span>
            </button>
          </div>
          {photos.length > 0 && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{photos.length} photo(s) added — tap a thumbnail's × to remove, or keep adding more.</p>
          )}
          {photos.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(p)} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.6)" }}>
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste your video transcript here…"
          rows={8}
          className="w-full text-sm rounded-2xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

      <button onClick={generate} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all"
        style={{ background: "linear-gradient(135deg, #7C5CFC, #E879F9)", color: "#fff", opacity: loading ? 0.6 : 1 }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? "Working on it…" : "Generate"}
      </button>

      {result && (
        <div className="space-y-4">

          {/* Narration + voice */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7C5CFC" }}>Narration</span>
              <TutorAvatar text={result.narration} characterId="professor" size={56} />
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{result.narration}</p>
          </div>

          {/* High yield bullets */}
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#E879F9" }}>High Yield</span>
            <ul className="mt-2 space-y-1.5">
              {result.highYield.map((h, i) => (
                <li key={i} className="text-sm flex gap-2" style={{ color: "var(--text)" }}>
                  <span style={{ color: "#E879F9" }}>•</span>{h}
                </li>
              ))}
            </ul>
          </div>

          {/* Generated question */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#10B981" }}>Quick Check</span>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{result.question.stem}</p>
            <div className="space-y-1.5">
              {result.question.choices.map((c) => {
                const isCorrect = c.letter === result.question.correctLetter;
                const isSelected = c.letter === selected;
                let bg = "var(--bg)", border = "var(--border)";
                if (revealed && isCorrect) { bg = "rgba(16,185,129,0.12)"; border = "#10B981"; }
                else if (revealed && isSelected) { bg = "rgba(239,68,68,0.12)"; border = "#EF4444"; }
                return (
                  <button key={c.letter} disabled={revealed}
                    onClick={() => { setSelected(c.letter); setRevealed(true); }}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-xl transition-all"
                    style={{ background: bg, border: `1.5px solid ${border}`, color: "var(--text)" }}>
                    <span className="font-semibold mr-1.5">{c.letter}.</span>{c.text}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <p className="text-sm leading-relaxed pt-1" style={{ color: "var(--text-muted)" }}>{result.question.explanation}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={saveQuestion} disabled={saved}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: saved ? "var(--bg)" : "#10B981", color: saved ? "var(--text-muted)" : "#fff" }}>
              <Save size={14} /> {saved ? "Saved to Q Bank" : "Save Question to Q Bank"}
            </button>
            <button onClick={() => { setPhotos([]); setTranscript(""); reset(); }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <RefreshCw size={14} /> New
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
