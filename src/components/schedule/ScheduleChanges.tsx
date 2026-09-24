"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, Loader2, Trash2, Plus, CalendarPlus, X } from "lucide-react";
import { announceScheduleChange } from "@/lib/useDatedChanges";

// Telling the schedule what changed, without going through anyone.
//
// Two ways in on purpose. Saying it is the fast path; the form underneath
// always works, including when the model is unavailable — which it is whenever
// the API credit runs out, and that is exactly when being stuck would be worst.

interface Change {
  kind: "add" | "cancel";
  date: string;
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

interface Override extends Change { id: string }

interface SRInstance extends EventTarget {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void;
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function pretty(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function ScheduleChanges() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [proposed, setProposed] = useState<Change[] | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const recog = useRef<SRInstance | null>(null);

  const [form, setForm] = useState({ date: todayISO(), label: "", startTime: "14:30", endTime: "15:30" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/overrides?from=${todayISO()}`, { cache: "no-store" });
      const d = await res.json();
      setOverrides(d.overrides ?? []);
    } catch { /* the list is a convenience, not the feature */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  function listen() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setErr("This browser can't do voice — type it instead."); return; }
    const r = new SR() as SRInstance;
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => setText(e.results[0][0].transcript);
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recog.current = r;
    setListening(true);
    r.start();
  }

  async function propose() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null); setProposed(null); setClarify(null);
    try {
      const res = await fetch("/api/schedule/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(`${d.error ?? "Couldn't read that."}${d.fallback ? ` ${d.fallback}` : ""}`);
        if (d.blocking) setShowManual(true);
        return;
      }
      setProposed(d.changes ?? []);
      setClarify(d.clarify ?? null);
    } catch {
      setErr("Couldn't reach the server.");
    } finally { setBusy(false); }
  }

  async function apply(changes: Change[]) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/schedule/overrides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "Couldn't save that."); return; }
      setProposed(null); setText(""); setShowManual(false);
      setForm(f => ({ ...f, label: "" }));
      await load();
      announceScheduleChange();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/schedule/overrides?id=${id}`, { method: "DELETE" });
    await load();
    announceScheduleChange();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div>
          <p className="font-serif text-lg" style={{ color: "var(--text)" }}>Change this week</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-light)" }}>
            Say it or type it. Changes apply to the day you name and expire on their own — your
            usual week stays as it is.
          </p>
        </div>

        <div className="flex items-end gap-2 rounded-xl p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); propose(); } }}
            rows={2}
            placeholder="Thursday right after work, see Tiffany Baker for an hour about the tuition balance"
            className="flex-1 bg-transparent border-0 outline-none text-sm resize-none py-1.5 px-1"
            style={{ color: "var(--text)" }}
          />
          <button
            onClick={listen}
            aria-label="Say it"
            className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0"
            style={{ background: listening ? "var(--purple)" : "var(--surface2)", color: listening ? "#fff" : "var(--text-muted)" }}
          >
            <Mic size={15} />
          </button>
          <button
            onClick={propose}
            disabled={busy || !text.trim()}
            aria-label="Work out the change"
            className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 disabled:opacity-40"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>

        {listening && <p className="text-xs" style={{ color: "var(--purple)" }}>Listening…</p>}
        {err && <p className="text-xs leading-relaxed" style={{ color: "var(--red)" }}>{err}</p>}
        {clarify && <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{clarify}</p>}

        {/* Nothing is saved until she has seen it written out. */}
        {proposed && proposed.length > 0 && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(180,85,47,0.06)", border: "1px solid rgba(180,85,47,0.25)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Before I save this:</p>
            {proposed.map((c, i) => (
              <p key={i} className="text-sm" style={{ color: "var(--text)" }}>
                {c.kind === "cancel"
                  ? <>Cancel <strong>{c.label}</strong> on {pretty(c.date)}</>
                  : <>Add <strong>{c.label}</strong> · {pretty(c.date)} {c.startTime}–{c.endTime}</>}
                {c.note && <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{c.note}</span>}
              </p>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => apply(proposed)} disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--text)", color: "var(--surface)" }}>
                Save it
              </button>
              <button onClick={() => setProposed(null)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                No
              </button>
            </div>
          </div>
        )}

        <button onClick={() => setShowManual(v => !v)} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
          {showManual ? "Hide the form" : "Add one by hand instead"}
        </button>

        {showManual && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <input placeholder="What is it?" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <button
              onClick={() => apply([{ kind: "add", ...form }])}
              disabled={busy || !form.label.trim()}
              className="text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              <Plus size={12} /> Add it
            </button>
          </div>
        )}
      </div>

      {overrides.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Changes coming up
          </p>
          <div className="space-y-2">
            {overrides.map(o => (
              <div key={o.id} className="flex items-start gap-2">
                {o.kind === "cancel"
                  ? <X size={13} style={{ color: "var(--red)", flexShrink: 0, marginTop: 3 }} />
                  : <CalendarPlus size={13} style={{ color: "#3F6F5E", flexShrink: 0, marginTop: 3 }} />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: "var(--text)" }}>
                    {o.label}
                    {o.kind === "add" && o.startTime && (
                      <span style={{ color: "var(--text-light)" }}> · {o.startTime}–{o.endTime}</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-light)" }}>
                    {o.kind === "cancel" ? "cancelled " : ""}{pretty(o.date)}
                    {o.note ? ` · ${o.note}` : ""}
                  </p>
                </div>
                <button onClick={() => remove(o.id)} className="p-1 rounded" style={{ color: "var(--text-light)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
