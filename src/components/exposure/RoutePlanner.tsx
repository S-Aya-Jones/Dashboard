"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, KeyRound, Check, AlertTriangle, Route as RouteIcon, Save, ChevronDown, Smartphone, Copy } from "lucide-react";
import { AddressInput } from "./AddressInput";

interface Step { instruction: string; distanceText: string }
interface RouteOption {
  summary: string; distanceText: string; durationText: string; durationMin: number;
  bridges: string[]; highways: string[]; clean: boolean; steps: Step[]; mapsUrl: string;
  bridgeCheck?: "verified" | "unavailable";
}

export function RoutePlanner({ onSaved }: { onSaved: () => void }) {
  const [places, setPlaces] = useState<Array<{ label: string; address: string }>>([]);
  useEffect(() => {
    fetch("/api/exposure").then(r => r.json())
      .then(d => setPlaces((d.places ?? []).map((p: { label: string; address: string }) => ({ label: p.label, address: p.address }))))
      .catch(() => {});
  }, []);

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
          <AddressInput value={origin} onChange={setOrigin} placeholder="Start — type an address or pick a saved place" saved={places} />
          <AddressInput value={destination} onChange={setDestination} placeholder="Destination" saved={places} />
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
                  <Check size={11} /> {r.bridgeCheck === "verified" ? "no bridges · no interstate" : "no interstate"}
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
                {r.bridges.length > 0 && (
                  <div>{r.bridges.length} bridge{r.bridges.length > 1 ? "s" : ""} on this route: <strong>{r.bridges.join(", ")}</strong></div>
                )}
                {r.highways.length > 0 && <div>Uses interstate: <strong>{r.highways.join(", ")}</strong></div>}
                {r.bridgeCheck === "unavailable" && (
                  <div style={{ color: "var(--text-muted)" }}>Map bridge check didn&apos;t respond — this only reflects road names.</div>
                )}
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

      <ShortcutSetup />

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Bridges are checked against OpenStreetMap&apos;s actual road data along the route&apos;s geometry, so
        unnamed overpasses are caught too. Interstates mean I-24, I-40 and the like — US-41 and US-431 are
        ordinary surface roads here (Dickerson Pike, Gallatin Pike), so they aren&apos;t flagged.
      </p>
    </div>
  );
}


/** iOS Shortcuts automation: the only way to capture a drive without
 *  touching the phone while driving. */
function ShortcutSetup() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const rows: Array<{ key: string; when: string; body: string }> = [
    { key: "start", when: "When CarPlay connects (or: I leave Home)", body: '{"action":"start","label":"Drive","lat":[Current Location→Latitude],"lng":[Current Location→Longitude]}' },
    { key: "end", when: "When CarPlay disconnects (or: I arrive Home)", body: '{"action":"end","lat":[Current Location→Latitude],"lng":[Current Location→Longitude]}' },
    { key: "turnback", when: "Manual shortcut — tap if you turn around", body: '{"action":"turnback","lat":[Current Location→Latitude],"lng":[Current Location→Longitude]}' },
  ];

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <Smartphone size={17} style={{ color: "var(--purple)" }} />
        <h3 className="font-bold text-sm flex-1" style={{ color: "var(--text)" }}>
          Track drives automatically with iPhone Shortcuts
        </h3>
        <ChevronDown size={16} style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <p className="text-xs mt-3 mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              A browser can&apos;t track you in the background, but an iPhone <strong>Personal Automation</strong> can —
              it fires on its own, screen locked, phone in your pocket. Each one below is:
              Shortcuts app → Automation → <em>+</em> → pick the trigger → <strong>Get Current Location</strong> →
              <strong> Get Contents of URL</strong> → Run Immediately (turn OFF &ldquo;Ask Before Running&rdquo;).
            </p>

            <div className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2 flex-wrap"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>URL (all three):</span>
              <code className="text-[11px] flex-1 min-w-[180px]" style={{ color: "var(--text)" }}>{base}/api/drive</code>
              <button onClick={() => copy(`${base}/api/drive`, "url")}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-white"
                style={{ background: copied === "url" ? "#2bb3a3" : "var(--purple)" }}>
                <Copy size={10} /> {copied === "url" ? "Copied" : "Copy"}
              </button>
              <span className="text-[11px] w-full" style={{ color: "var(--text-muted)" }}>
                Method: POST · Request Body: JSON
              </span>
            </div>

            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.key} className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="text-xs font-bold mb-1" style={{ color: "var(--purple)" }}>{r.when}</div>
                  <code className="text-[10px] block leading-relaxed break-all" style={{ color: "var(--text)" }}>{r.body}</code>
                  <button onClick={() => copy(r.body, r.key)}
                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    <Copy size={10} /> {copied === r.key ? "Copied" : "Copy body"}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              The bracketed parts are Shortcuts variables — insert them from the variable picker, don&apos;t type them.
              When a drive ends you&apos;ll get a text with the distance and duration, and it appears on your
              habituation curve ready for fear ratings.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
