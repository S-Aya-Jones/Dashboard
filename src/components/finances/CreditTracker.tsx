"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Snapshot {
  report_date: string;
  transunion: number | null; experian: number | null; equifax: number | null;
  derogatory: number | null; collections: number | null; delinquent: number | null;
  balances: string | number | null; inquiries: number | null;
}

const band = (s: number) =>
  s >= 740 ? { label: "Very good", tone: "#2bb3a3" }
  : s >= 670 ? { label: "Good", tone: "#3aa864" }
  : s >= 580 ? { label: "Fair", tone: "#e8842c" }
  : { label: "Poor", tone: "#c0392b" };

export function CreditTracker() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await (await fetch("/api/credit")).json();
      setSnaps(d.snapshots ?? []);
    } catch { /* offline */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    setBusy(true); setMsg(null);
    try {
      const html = await file.text();
      const res = await fetch("/api/credit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Couldn't read that file"); return; }
      setMsg(`Saved ${d.reportDate}. Next pull scheduled for ${d.nextPull}.`);
      await load();
    } catch (e) {
      setMsg(String(e).slice(0, 120));
    } finally { setBusy(false); }
  }

  const latest = snaps[0];
  const prev = snaps[1];

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={17} style={{ color: "var(--purple)" }} />
        <h3 className="section-title flex-1">Credit</h3>
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ background: "var(--purple)" }}>
          <Upload size={12} /> {busy ? "Reading…" : "Upload report"}
        </button>
      </div>

      {!latest && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Upload a tri-bureau export (IdentityIQ, Credit Karma) and it tracks the numbers over time,
          then reminds you to pull a fresh one every 90 days.
        </p>
      )}

      {msg && <p className="text-xs mt-2" style={{ color: "var(--purple)" }}>{msg}</p>}

      {latest && (
        <>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {([["TransUnion", latest.transunion, prev?.transunion],
               ["Experian", latest.experian, prev?.experian],
               ["Equifax", latest.equifax, prev?.equifax]] as const).map(([name, score, before]) => {
              if (score === null || score === undefined) return null;
              const b = band(score);
              const delta = before ? score - before : null;
              return (
                <motion.div key={name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3 text-center" style={{ background: "var(--bg)" }}>
                  <div className="section-kicker">{name}</div>
                  <div className="stat text-2xl mt-1" style={{ color: b.tone }}>{score}</div>
                  <div className="text-[10px] font-semibold" style={{ color: b.tone }}>{b.label}</div>
                  {delta !== null && delta !== 0 && (
                    <div className="text-[10px] font-bold mt-0.5"
                      style={{ color: delta > 0 ? "#2bb3a3" : "#c0392b" }}>
                      {delta > 0 ? "+" : ""}{delta} since last
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Chip warn={(latest.derogatory ?? 0) > 0} label={`${latest.derogatory ?? 0} derogatory`} />
            <Chip warn={(latest.collections ?? 0) > 0} label={`${latest.collections ?? 0} in collections`} />
            <Chip warn={(latest.delinquent ?? 0) > 0} label={`${latest.delinquent ?? 0} delinquent`} />
            <Chip warn={false} label={`${latest.inquiries ?? 0} inquiries`} />
          </div>

          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            Last pulled {latest.report_date}
            {snaps.length > 1 ? ` · ${snaps.length} reports tracked` : ""}
          </p>
        </>
      )}
    </div>
  );
}

function Chip({ label, warn }: { label: string; warn: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={warn
        ? { background: "rgba(232,132,44,.14)", color: "#9a4a05" }
        : { background: "var(--bg)", color: "var(--text-muted)" }}>
      {warn ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />} {label}
    </span>
  );
}
