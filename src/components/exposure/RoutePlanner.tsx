"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, KeyRound, Check, AlertTriangle, Route as RouteIcon, Save, ChevronDown } from "lucide-react";

interface Step { instruction: string; distanceText: string }
interface RouteOption {
  summary: string; distanceText: string; durationText: string; durationMin: number;
  bridges: string[]; highways: string[]; clean: boolean; steps: Step[]; mapsUrl: string;
}

export function RoutePlanner({ onSaved }: { onSaved: () => void }) {
  const [keyState, setKeyState] = useState<{ configured: boolean; hint: string | null } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [avoidHighways, setAvoidHighways] = useState(true);
  const [routes, setRoutes] = useState<RouteOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const loadKey = useCallback(async () => {
    try {
      const d = await (await fetch("/api/routes/plan")).json();
      setKeyState({ configured: !!d.configured, hint: d.hint ?? null });
    } catch { setKeyState({ configured: false, hint: null }); }
  }, []);
  useEffect(() => { loadKey(); }, [loadKey]);

  async function saveKey() {
    setSavingKey(true); setKeyErr(null);
    try {
      const res = await fetch("/api/routes/plan", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setKeyErr(d.error ?? "Could not save"); return; }
      setKeyInput(""); await loadKey();
    } finally { setSavingKey(false); }
  }

  async function search() {
    setLoading(true); setErr(null); setRoutes(null);
    try {
      const res = await fetch("/api/routes/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, avoidHighways }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error === "NO_MAPS_KEY" ? "Add your Google Maps key above first." : d.error);
        return;
      }
      setRoutes(d.routes);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  async function saveRoute(r: RouteOption) {
    await fetch("/api/exposure", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addRoute",
        name: `${origin.split(",")[0]} → ${destination.split(",")[0]} (${r.summary})`,
        origin, destination,
        noHighway: r.highways.length === 0,
        noBridge: r.bridges.length === 0,
        minutes: r.durationMin,
        notes: r.clean ? "Verified clean by route check" : `Contains: ${[...r.bridges, ...r.highways].join(", ")}`,
      }),
    });
    onSaved();
  }

  if (keyState && !keyState.configured) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--purple)" }}>
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={17} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Connect Google Maps</h3>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          This finds real routes and reads the turn-by-turn directions to tell you which ones cross bridges
          or use interstates. Get a key at{" "}
          <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer"
            className="underline" style={{ color: "var(--purple)" }}>Google Cloud Console</a>{" "}
          and enable the <strong>Directions API</strong> on it.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AIza..."
            className="flex-1 min-w-[220px] rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }} />
          <button onClick={saveKey} disabled={savingKey || !keyInput.trim()}
            className="px-5 py-2 rounded-lg font-semibold text-white text-sm disabled:opacity-40"
            style={{ background: "var(--purple)" }}>
            {savingKey ? "Checking…" : "Save key"}
          </button>
        </div>
        {keyErr && <p className="text-sm mt-2" style={{ color: "#c0392b" }}>{keyErr}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <RouteIcon size={17} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Find a route</h3>
          {keyState?.configured && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: "#2bb3a3" }}>
              <Check size={11} /> Maps connected
            </span>
          )}
        </div>
        <div className="space-y-2">
          <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Start address"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination address"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
            <input type="checkbox" checked={avoidHighways} onChange={e => setAvoidHighways(e.target.checked)} />
            Avoid interstates, tolls and ferries
          </label>
          <button onClick={search} disabled={loading || !origin || !destination}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
            style={{ background: "var(--purple)" }}>
            {loading ? "Checking routes…" : "Check routes"}
          </button>
        </div>
        {err && <p className="text-sm mt-2" style={{ color: "#c0392b" }}>{err}</p>}
      </div>

      <AnimatePresence>
        {routes?.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)",
                     border: `1.5px solid ${r.clean ? "rgba(43,179,163,.5)" : "var(--border)"}` }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>via {r.summary}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.durationText} · {r.distanceText}</div>
              </div>
              {r.clean ? (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
                  style={{ background: "rgba(43,179,163,.15)", color: "#1e8a7e" }}>
                  <Check size={11} /> no bridges · no interstate
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
                  style={{ background: "#ffe3d0", color: "#9a4a05" }}>
                  <AlertTriangle size={11} /> check below
                </span>
              )}
            </div>

            {(r.bridges.length > 0 || r.highways.length > 0) && (
              <div className="text-xs mb-3 space-y-1" style={{ color: "var(--text)" }}>
                {r.bridges.length > 0 && <div>🌉 Crosses: <strong>{r.bridges.join(", ")}</strong></div>}
                {r.highways.length > 0 && <div>🛣 Uses: <strong>{r.highways.join(", ")}</strong></div>}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <a href={r.mapsUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "var(--purple)" }}>
                <Navigation size={13} /> Open in Maps
              </a>
              <button onClick={() => saveRoute(r)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <Save size={13} /> Save this route
              </button>
              <button onClick={() => setOpen(open === i ? null : i)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ color: "var(--text-muted)" }}>
                <ChevronDown size={13} style={{ transform: open === i ? "rotate(180deg)" : undefined }} />
                {r.steps.length} turns
              </button>
            </div>

            <AnimatePresence>
              {open === i && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3 space-y-1.5">
                  {r.steps.map((s, si) => (
                    <li key={si} className="text-xs flex gap-2" style={{ color: "var(--text)" }}>
                      <span style={{ color: "var(--text-muted)" }}>{si + 1}.</span>
                      <span>{s.instruction} <em style={{ color: "var(--text-muted)" }}>({s.distanceText})</em></span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>

      {routes && routes.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No routes came back for those addresses.</p>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Bridges and interstates are detected by reading the actual turn-by-turn directions Google returns.
        It catches anything named — &ldquo;… Bridge&rdquo;, I-24, US-31 — but an unnamed overpass can slip through,
        so treat a clean result as a strong start, not a guarantee.
      </p>
    </div>
  );
}
