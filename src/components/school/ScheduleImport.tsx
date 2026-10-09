"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Check } from "lucide-react";

// Every term the school issues a new course schedule PDF. Retyping the quiz
// and exam dates by hand is exactly the kind of thing that quietly stops
// happening, so this reads the PDF and puts the dates straight into the
// deadline engine — which is what aims the evening study blocks.

interface Found {
  course: string;
  kind: string;
  title: string;
  date: string;
}

export function ScheduleImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]   = useState<File | null>(null);
  const [busy, setBusy]   = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [saved, setSaved] = useState(0);
  const [err, setErr]     = useState<string | null>(null);

  async function send(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("year", String(new Date().getFullYear()));
      if (commit) body.append("commit", "1");

      const res  = await fetch("/api/school/course-schedule", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that schedule");

      setFound(data.assessments ?? []);
      if (commit) setSaved(data.imported ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that schedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
    >
      <div>
        <p className="font-serif text-lg" style={{ color: "var(--text)" }}>Course schedule</p>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Drop in the term&apos;s PDF and every quiz, exam and review goes into your
          deadlines — which is what decides what each evening&apos;s study blocks point at.
          You&apos;ll see the list before anything is saved.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFound(null); setSaved(0); }}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          <Upload size={14} /> {file ? "Pick a different PDF" : "Choose the PDF"}
        </button>
        {file && !found && (
          <button
            onClick={() => send(false)}
            disabled={busy}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-2"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null} Read it
          </button>
        )}
      </div>

      {file && <p className="text-xs" style={{ color: "var(--text-light)" }}>{file.name}</p>}

      {found && (
        <div className="space-y-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {found.length} assessment{found.length === 1 ? "" : "s"} found
            {saved > 0 && <span style={{ color: "var(--green)" }}> — {saved} saved</span>}
          </p>

          <div
            className="max-h-72 overflow-y-auto rounded-xl divide-y"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
          >
            {found.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--text)" }}>{a.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-light)" }}>{a.course}</p>
                </div>
                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
            {found.length === 0 && (
              <p className="px-3 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
                Nothing found in that file. If it isn&apos;t the week-by-week grid, try the other PDF.
              </p>
            )}
          </div>

          {found.length > 0 && saved === 0 && (
            <button
              onClick={() => send(true)}
              disabled={busy}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-2"
              style={{ background: "var(--purple)", color: "var(--surface)" }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
              Add these to my deadlines
            </button>
          )}
        </div>
      )}

      {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
    </div>
  );
}
