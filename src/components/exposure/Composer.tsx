"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Car, Mountain, MapPin, Plus, Trash2, Timer } from "lucide-react";
import { AddressInput } from "./AddressInput";

// A fixed ladder is always generic — the same drive is easy at 5am and hard at
// 5pm. So instead of listing tasks, you compose the real conditions and the
// difficulty is computed from them. Every exposure is a specific, real plan.

interface Place { id: string; label: string; address: string; kind: string }

const post = (body: Record<string, unknown>) =>
  fetch("/api/exposure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function scoreDrive(c: {
  minutes: number; familiar: boolean; alone: boolean;
  traffic: "empty" | "light" | "moderate" | "rush";
  light: "day" | "dusk" | "dark"; weather: "clear" | "rain";
  bridges: number; interstate: boolean; timePressure: boolean;
}) {
  let n = 8;
  n += Math.min(18, c.minutes * 0.5);
  if (!c.familiar) n += 12;
  if (c.alone) n += 10;
  n += { empty: 0, light: 4, moderate: 10, rush: 18 }[c.traffic];
  n += { day: 0, dusk: 5, dark: 11 }[c.light];
  if (c.weather === "rain") n += 9;
  n += Math.min(22, c.bridges * 14);
  if (c.interstate) n += 20;
  if (c.timePressure) n += 8;
  return Math.max(5, Math.min(100, Math.round(n)));
}

function scoreHeight(c: {
  floor: number; position: "back" | "near" | "at-glass" | "at-rail" | "looking-down";
  open: boolean; minutes: number; alone: boolean;
}) {
  let n = 6;
  n += Math.min(26, Math.max(0, c.floor - 1) * 5);
  n += { back: 0, near: 6, "at-glass": 12, "at-rail": 20, "looking-down": 26 }[c.position];
  if (c.open) n += 14;
  n += Math.min(10, c.minutes * 1.5);
  if (c.alone) n += 6;
  return Math.max(5, Math.min(100, Math.round(n)));
}

const sel: React.CSSProperties = {
  width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)",
  color: "var(--text)", borderRadius: 10, padding: ".5rem .65rem", fontSize: ".85rem",
};

export function Composer({ onLog }: { onLog: (t: { phobia: string; label: string }) => void }) {
  const [mode, setMode] = useState<"driving" | "heights">("driving");
  const [places, setPlaces] = useState<Place[]>([]);

  const load = async () => {
    const d = await (await fetch("/api/exposure")).json();
    setPlaces(d.places ?? []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["driving", "Driving", Car], ["heights", "Heights", Mountain]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setMode(k)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={mode === k
              ? { background: "rgba(180,85,47,.13)", border: "1.5px solid var(--purple)", color: "var(--purple)" }
              : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {mode === "driving"
        ? <DriveComposer places={places} onLog={onLog} reloadPlaces={load} />
        : <HeightComposer onLog={onLog} />}
    </div>
  );
}

// ── Driving ──────────────────────────────────────────────────────────────────

function DriveComposer({ places, onLog, reloadPlaces }: {
  places: Place[]; onLog: (t: { phobia: string; label: string }) => void; reloadPlaces: () => void;
}) {
  const [to, setTo] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [familiar, setFamiliar] = useState(true);
  const [alone, setAlone] = useState(true);
  const [traffic, setTraffic] = useState<"empty" | "light" | "moderate" | "rush">("light");
  const [light, setLight] = useState<"day" | "dusk" | "dark">("day");
  const [weather, setWeather] = useState<"clear" | "rain">("clear");
  const [bridges, setBridges] = useState(0);
  const [interstate, setInterstate] = useState(false);
  const [timePressure, setTimePressure] = useState(false);

  const score = scoreDrive({ minutes, familiar, alone, traffic, light, weather, bridges, interstate, timePressure });
  const dest = places.find(p => p.id === to);

  const label = [
    dest ? `Drive to ${dest.label}` : `${minutes}-min drive`,
    alone ? "alone" : "with someone",
    traffic === "rush" ? "rush hour" : traffic === "moderate" ? "moderate traffic" : null,
    light !== "day" ? (light === "dark" ? "after dark" : "at dusk") : null,
    weather === "rain" ? "in rain" : null,
    bridges > 0 ? `${bridges} bridge${bridges > 1 ? "s" : ""}` : null,
    interstate ? "interstate" : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <PlaceManager places={places} reload={reloadPlaces} />

      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Build the drive</h3>

        <Field label="Where to">
          <select value={to} onChange={e => setTo(e.target.value)} style={sel}>
            <option value="">Anywhere / not a saved place</option>
            {places.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`About ${minutes} min`}>
            <input type="range" min={5} max={60} step={5} value={minutes}
              onChange={e => setMinutes(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Traffic">
            <select value={traffic} onChange={e => setTraffic(e.target.value as never)} style={sel}>
              <option value="empty">Empty roads (5am)</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="rush">Rush hour</option>
            </select>
          </Field>
          <Field label="Light">
            <select value={light} onChange={e => setLight(e.target.value as never)} style={sel}>
              <option value="day">Daylight</option>
              <option value="dusk">Dusk</option>
              <option value="dark">After dark</option>
            </select>
          </Field>
          <Field label="Weather">
            <select value={weather} onChange={e => setWeather(e.target.value as never)} style={sel}>
              <option value="clear">Clear</option>
              <option value="rain">Rain</option>
            </select>
          </Field>
          <Field label="Bridges to cross">
            <select value={bridges} onChange={e => setBridges(Number(e.target.value))} style={sel}>
              <option value={0}>None</option>
              <option value={1}>One</option>
              <option value={2}>Two or more</option>
            </select>
          </Field>
          <Field label="Route">
            <select value={familiar ? "1" : "0"} onChange={e => setFamiliar(e.target.value === "1")} style={sel}>
              <option value="1">One I know</option>
              <option value="0">Somewhere new</option>
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm pt-1" style={{ color: "var(--text)" }}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={alone} onChange={e => setAlone(e.target.checked)} /> Driving alone</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={interstate} onChange={e => setInterstate(e.target.checked)} /> Interstate</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={timePressure} onChange={e => setTimePressure(e.target.checked)} /> Must arrive by a set time</label>
        </div>

        <ScoreBar score={score} label={label} onGo={() => onLog({ phobia: "driving", label })} />
      </div>
    </div>
  );
}

// ── Heights ──────────────────────────────────────────────────────────────────

function HeightComposer({ onLog }: { onLog: (t: { phobia: string; label: string }) => void }) {
  const [where, setWhere] = useState("Meharry — main building");
  const [floor, setFloor] = useState(2);
  const [position, setPosition] = useState<"back" | "near" | "at-glass" | "at-rail" | "looking-down">("near");
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(2);
  const [alone, setAlone] = useState(true);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const score = scoreHeight({ floor, position, open, minutes, alone });
  const posLabel = { back: "back from the edge", near: "a few steps away", "at-glass": "at the glass", "at-rail": "at the rail", "looking-down": "looking straight down" }[position];
  const label = `${where}, floor ${floor}, ${posLabel}${open ? ", open air" : ""} — ${minutes} min`;

  const target = minutes * 60;
  const pct = Math.min(100, (elapsed / target) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Build the exposure</h3>

        <Field label="Where">
          <input value={where} onChange={e => setWhere(e.target.value)} style={sel}
            placeholder="Building or place you're already in" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Floor ${floor}`}>
            <input type="range" min={1} max={12} value={floor} onChange={e => setFloor(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="How close">
            <select value={position} onChange={e => setPosition(e.target.value as never)} style={sel}>
              <option value="back">Back from the edge</option>
              <option value="near">A few steps away</option>
              <option value="at-glass">At the glass</option>
              <option value="at-rail">At the rail</option>
              <option value="looking-down">Looking straight down</option>
            </select>
          </Field>
          <Field label={`Stay ${minutes} min`}>
            <input type="range" min={1} max={10} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Barrier">
            <select value={open ? "1" : "0"} onChange={e => setOpen(e.target.value === "1")} style={sel}>
              <option value="0">Behind glass</option>
              <option value="1">Open air</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={alone} onChange={e => setAlone(e.target.checked)} /> On my own
        </label>

        <ScoreBar score={score} label={label} onGo={() => onLog({ phobia: "heights", label })} goText="Log it" />
      </div>

      {/* Staying put is the whole mechanism for heights — most people leave too early */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Timer size={16} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Stay-put timer</h3>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          With heights the goal isn&apos;t to finish something — it&apos;s to stay while the fear falls.
          It usually starts dropping around the two-minute mark. Leaving before that teaches the wrong lesson.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div className="font-serif text-3xl tabular-nums" style={{ color: "var(--text)" }}>
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
            <motion.div className="h-full" animate={{ width: `${pct}%` }}
              style={{ background: pct >= 100 ? "#2bb3a3" : "linear-gradient(90deg,#B4552F,#D08A4A)" }} />
          </div>
          <span className="text-xs font-bold" style={{ color: pct >= 100 ? "#2bb3a3" : "var(--text-muted)" }}>
            {pct >= 100 ? "target hit" : `${minutes}m`}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRunning(r => !r)}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: running ? "#e8842c" : "var(--purple)" }}>
            {running ? "Pause" : elapsed ? "Resume" : "Start"}
          </button>
          <button onClick={() => { setRunning(false); setElapsed(0); }}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            Reset
          </button>
        </div>
        {elapsed >= 120 && (
          <p className="text-xs mt-2 font-semibold" style={{ color: "#2bb3a3" }}>
            Past two minutes — notice whether it&apos;s already lower than when you started.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function ScoreBar({ score, label, onGo, goText = "I'm doing this" }: {
  score: number; label: string; onGo: () => void; goText?: string;
}) {
  const tone = score > 70 ? "#c0392b" : score > 45 ? "#e8842c" : "#2bb3a3";
  const word = score > 75 ? "This is a big one" : score > 55 ? "A real stretch" : score > 35 ? "Doable, uncomfortable" : "Warm-up";
  return (
    <div className="rounded-xl p-4 mt-1" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
          <motion.div className="h-full" animate={{ width: `${score}%` }} style={{ background: tone }} />
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: tone }}>{score}</span>
      </div>
      <div className="text-xs font-semibold mb-1" style={{ color: tone }}>{word}</div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text)" }}>{label}</p>
      <button onClick={onGo} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white"
        style={{ background: "var(--purple)" }}>
        {goText}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function PlaceManager({ places, reload }: { places: Place[]; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={15} style={{ color: "var(--purple)" }} />
        <h3 className="font-bold text-sm flex-1" style={{ color: "var(--text)" }}>Your places</h3>
        <button onClick={() => setAdding(a => !a)} className="text-xs font-semibold" style={{ color: "var(--purple)" }}>
          <Plus size={13} className="inline" /> Add
        </button>
      </div>

      {places.length === 0 && !adding && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Save the handful of places you actually drive — home, Meharry, the gym, church. Then you never type an address again.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {places.map(p => (
          <span key={p.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {p.label}
            <button onClick={async () => { await post({ action: "deletePlace", id: p.id }); reload(); }}
              style={{ color: "var(--text-muted)" }}><Trash2 size={11} /></button>
          </span>
        ))}
      </div>

      {adding && (
        <div className="mt-3 space-y-2">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Name it — Home, Meharry, Gym" style={sel} />
          <AddressInput value={address} onChange={setAddress} placeholder="Start typing the address…" />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--bg)", color: "var(--text-muted)" }}>Cancel</button>
            <button disabled={!label.trim() || !address.trim()}
              onClick={async () => {
                await post({ action: "addPlace", label, address, kind: "other" });
                setLabel(""); setAddress(""); setAdding(false); reload();
              }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--purple)" }}>Save place</button>
          </div>
        </div>
      )}
    </div>
  );
}
