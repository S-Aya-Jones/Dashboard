"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CreditPlan } from "./CreditPlan";
import { toBase64 } from "@/lib/slidesUpload";
import { CREDIT_UPDATED, announceCreditUpdate } from "@/lib/creditEvents";

interface Snapshot {
  report_date: string;
  transunion: number | null; experian: number | null; equifax: number | null;
  derogatory: number | null; collections: number | null; delinquent: number | null;
  balances: string | number | null; inquiries: number | null;
}

const BUREAU_NAME = (b: string) =>
  b === "transunion" ? "TransUnion" : b === "experian" ? "Experian" : b === "equifax" ? "Equifax" : b;

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
  useEffect(() => {
    const on = () => load();
    window.addEventListener(CREDIT_UPDATED, on);
    return () => window.removeEventListener(CREDIT_UPDATED, on);
  }, [load]);

  const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === "application/pdf";

  // All three bureaus at once, or one at a time — everything in one selection
  // merges into a single dated snapshot, and uploading Equifax tomorrow fills
  // the gap in that same snapshot rather than starting a second one.
  //
  // HTML files go up together because they are small. PDFs go one per request:
  // three of them in one body would blow the 4.5MB request limit, and reading
  // a PDF takes long enough that batching them risks the function timeout.
  // The first response's date is threaded through the rest as groupDate so
  // they still land together.
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setMsg(null);

    const tooBig = files.filter(f => f.size > 3.5 * 1024 * 1024);
    if (tooBig.length) {
      setMsg(`Too large to upload: ${tooBig.map(f => f.name).join(", ")}. Save the summary pages only and try again.`);
      setBusy(false);
      return;
    }

    const htmlFiles = files.filter(f => !isPdf(f));
    const pdfFiles  = files.filter(isPdf);
    const covered = new Set<string>();
    const failures: string[] = [];
    let groupDate: string | null = null;
    let merged = false;
    let anyOk = false;

    const send = async (payload: Record<string, unknown>, names: string[]) => {
      const res = await fetch("/api/credit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(groupDate ? { groupDate } : {}) }),
      });
      const d = await res.json();
      if (!res.ok) { failures.push(...names); return; }
      anyOk = true;
      merged = merged || Boolean(d.merged);
      groupDate = groupDate ?? d.reportDate ?? null;
      for (const b of d.covered ?? []) covered.add(b);
      for (const f of (d.files ?? []).filter((x: { ok: boolean }) => !x.ok)) failures.push(f.file);
    };

    try {
      if (htmlFiles.length) {
        const reports = await Promise.all(
          htmlFiles.map(async f => ({ name: f.name, html: await f.text() })),
        );
        await send({ reports }, htmlFiles.map(f => f.name));
      }

      for (let i = 0; i < pdfFiles.length; i++) {
        const f = pdfFiles[i];
        setMsg(`Reading ${f.name}${pdfFiles.length > 1 ? ` (${i + 1} of ${pdfFiles.length})` : ""}…`);
        const data = toBase64(await f.arrayBuffer());
        await send({ pdfs: [{ name: f.name, data }] }, [f.name]);
      }

      if (!anyOk) {
        setMsg(`Couldn't read ${failures.join(", ") || "those files"}.`);
        return;
      }

      const missing = ["transunion", "experian", "equifax"].filter(b => !covered.has(b));
      const parts = [
        `${merged ? "Added to" : "Saved"} the ${groupDate} report`,
        covered.size ? `(${Array.from(covered).map(BUREAU_NAME).join(", ")})` : "",
        missing.length ? `· still missing ${missing.map(BUREAU_NAME).join(" and ")}` : "",
        failures.length ? `· couldn't read ${failures.join(", ")}` : "",
      ].filter(Boolean);
      setMsg(parts.join(" ") + ".");

      await load();
      // The plan, the loan panel and the summary line all read the snapshot —
      // a new report should redraw them rather than wait for a reload.
      announceCreditUpdate();
    } catch (e) {
      setMsg(String(e).slice(0, 160));
    } finally { setBusy(false); }
  }

  const latest = snaps[0];
  const prev = snaps[1];

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={17} style={{ color: "var(--purple)" }} />
        <h3 className="section-title flex-1">Credit</h3>
        <input ref={fileRef} type="file" accept=".html,.htm,text/html,.pdf,application/pdf" multiple className="hidden"
          onChange={e => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ background: "var(--purple)" }}>
          <Upload size={12} /> {busy ? "Reading…" : "Upload reports"}
        </button>
      </div>

      {!latest && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          HTML or PDF. Upload a tri-bureau export (IdentityIQ, Credit Karma), or pick all
          three bureau reports at once — TransUnion, Experian and Equifax merge into one
          dated snapshot. The game plan below is built from whatever you upload, and you
          get a reminder to pull fresh reports every 90 days.
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

      <div className="mt-4">
        <CreditPlan />
      </div>
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
