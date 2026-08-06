"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Mountain, Trophy, Flame, TrendingDown, Plus, Trash2,
  Navigation, MapPin, Check, CalendarCheck, Sparkles,
} from "lucide-react";
import { PanicToolkit } from "./PanicToolkit";
import { RoutePlanner } from "./RoutePlanner";
import { NextSteps } from "./NextSteps";
import { Composer } from "./Composer";

interface Step { id: string; phobia: string; title: string; detail: string; sud: number; position: number; reps: number; mastered: boolean }
interface Route { id: string; name: string; origin: string; destination: string; noHighway: boolean; noBridge: boolean; minutes: number | null; notes: string; timesDriven: number; lastDriven: string | null }
interface Session { id: string; phobia: string; label: string; sudBefore: number | null; sudPeak: number | null; sudAfter: number | null; minutes: number | null; panic: boolean; avoided: boolean; doneAt: string }
interface Checkin { weekOf: string; wins: string; hardest: string; avoided: string; nextTarget: string; confidence: number | null }
interface Stats { thisWeek: number; total: number; mastered: number; steps: number; avgDrop: number | null; streak: number }

type Tab = "Plan one" | "Next steps" | "Routes" | "Progress" | "Check-in";
const TABS: Tab[] = ["Plan one", "Next steps", "Routes", "Progress", "Check-in"];

const post = (body: Record<string, unknown>) =>
  fetch("/api/exposure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function mapsUrl(origin: string, destination: string, noHighway: boolean) {
  const p = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (noHighway) p.set("avoid", "highways|ferries|tolls");
  return `https://www.google.com/maps/dir/?${p}`;
}

export function ExposureHub() {
  const [tab, setTab] = useState<Tab>("Plan one");
  const [ladder, setLadder] = useState<Step[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logFor, setLogFor] = useState<{ phobia: string; label: string; stepId?: string; routeId?: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/exposure");
    const d = await res.json();
    if (d.ladder) { setLadder(d.ladder); setRoutes(d.routes); setSessions(d.sessions); setCheckins(d.checkins); setStats(d.stats); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <PanicToolkit />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Flame size={17} />} value={String(stats?.streak ?? 0)} label="day streak" tint="#e8842c" />
        <Stat icon={<Sparkles size={17} />} value={String(stats?.thisWeek ?? 0)} label="this week" tint="#B4552F" />
        <Stat icon={<Trophy size={17} />} value={`${stats?.mastered ?? 0}/${stats?.steps ?? 0}`} label="steps mastered" tint="#2bb3a3" />
        <Stat icon={<TrendingDown size={17} />} value={stats?.avgDrop === null || stats?.avgDrop === undefined ? "—" : `−${stats.avgDrop}`} label="avg anxiety drop" tint="#3aa864" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="relative px-4 py-2 rounded-full text-sm font-semibold"
            style={{ color: tab === t ? "white" : "var(--text-muted)",
                     border: tab === t ? "1.5px solid transparent" : "1.5px solid var(--border)",
                     background: tab === t ? "transparent" : "var(--surface)" }}>
            {tab === t && <motion.span layoutId="exptab" className="absolute inset-0 rounded-full" style={{ background: "var(--purple)" }} />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {tab === "Plan one" && <Composer onLog={setLogFor} />}
          {tab === "Next steps" && <NextSteps onLog={setLogFor} />}
          {tab === "Routes" && (
            <div className="space-y-5">
              <RoutePlanner onSaved={load} />
              <Routes routes={routes} onLog={setLogFor} reload={load} />
            </div>
          )}
          {tab === "Progress" && <Progress sessions={sessions} />}
          {tab === "Check-in" && <CheckIn checkins={checkins} sessions={sessions} reload={load} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {logFor && <LogModal target={logFor} onClose={() => setLogFor(null)} reload={load} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon, value, label, tint }: { icon: React.ReactNode; value: string; label: string; tint: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div style={{ color: tint }}>{icon}</div>
      <div className="font-serif text-2xl mt-1" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</div>
    </motion.div>
  );
}

// ── Ladder ───────────────────────────────────────────────────────────────────

function Ladder({ ladder, onLog, reload }: {
  ladder: Step[];
  onLog: (t: { phobia: string; label: string; stepId?: string }) => void;
  reload: () => void;
}) {
  const [phobia, setPhobia] = useState<"driving" | "heights">("driving");
  const steps = ladder.filter(s => s.phobia === phobia);
  const nextStep = steps.find(s => !s.mastered);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["driving", "Driving", Car], ["heights", "Heights", Mountain]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setPhobia(k)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={phobia === k
              ? { background: "rgba(180,85,47,.13)", border: "1.5px solid var(--purple)", color: "var(--purple)" }
              : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {nextStep && (
        <motion.div layout className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#B4552F,#a855f7)", color: "white" }}>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Your next step</div>
          <div className="font-serif text-xl mt-1">{nextStep.title}</div>
          {nextStep.detail && <p className="text-sm opacity-90 mt-1">{nextStep.detail}</p>}
          <button onClick={() => onLog({ phobia, label: nextStep.title, stepId: nextStep.id })}
            className="mt-3 px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: "white", color: "#B4552F" }}>
            I did it — log it
          </button>
        </motion.div>
      )}

      <div className="space-y-2">
        {steps.map((s, i) => (
          <motion.div key={s.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--surface)",
                     border: `1.5px solid ${s.mastered ? "rgba(43,179,163,.45)" : "var(--border)"}`,
                     opacity: s.mastered ? 0.85 : 1 }}>
            <button
              onClick={async () => { await post({ action: "updateStep", id: s.id, mastered: !s.mastered }); reload(); }}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
              style={{ background: s.mastered ? "#2bb3a3" : "var(--bg)", border: `1.5px solid ${s.mastered ? "#2bb3a3" : "var(--border)"}` }}>
              {s.mastered && <Check size={13} color="white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--text)", textDecoration: s.mastered ? "line-through" : "none" }}>
                {s.title}
              </div>
              {s.detail && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.detail}</div>}
              <div className="flex items-center gap-2 mt-2">
                <div className="h-1.5 rounded-full flex-1 max-w-[110px] overflow-hidden" style={{ background: "var(--bg)" }}>
                  <div className="h-full" style={{ width: `${s.sud}%`, background: s.sud > 70 ? "#c0392b" : s.sud > 45 ? "#e8842c" : "#2bb3a3" }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>fear {s.sud}</span>
                {s.reps > 0 && <span className="text-[10px] font-bold" style={{ color: "#2bb3a3" }}>×{s.reps} done</span>}
              </div>
            </div>
            <button onClick={() => onLog({ phobia: s.phobia, label: s.title, stepId: s.id })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--purple)" }}>
              Log
            </button>
          </motion.div>
        ))}
      </div>
      <AddStep phobia={phobia} reload={reload} />
    </div>
  );
}

function AddStep({ phobia, reload }: { phobia: string; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sud, setSud] = useState(50);
  if (!open) return (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--purple)" }}>
      <Plus size={15} /> Add your own step
    </button>
  );
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--purple)" }}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the step?"
        className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
      <div>
        <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>How scary, 0–100: {sud}</label>
        <input type="range" min={0} max={100} value={sud} onChange={e => setSud(Number(e.target.value))} className="w-full" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--bg)", color: "var(--text-muted)" }}>Cancel</button>
        <button disabled={!title.trim()}
          onClick={async () => { await post({ action: "addStep", phobia, title, sud }); setTitle(""); setOpen(false); reload(); }}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--purple)" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

function Routes({ routes, onLog, reload }: {
  routes: Route[];
  onLog: (t: { phobia: string; label: string; routeId?: string }) => void;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", origin: "", destination: "", noHighway: true, noBridge: true, minutes: "", notes: "" });

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: "rgba(180,85,47,.07)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        Maps links open with <strong>highways, tolls and ferries avoided</strong> — that covers interstates.
        Google has no &ldquo;avoid bridges&rdquo; option, so the bridge-free flag is <em>your</em> knowledge:
        save a route once you&apos;ve confirmed it, and it stays trustworthy forever.
      </div>

      {routes.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{r.name}</div>
              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <MapPin size={11} /> {r.origin} → {r.destination}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {r.noHighway && <Tag text="no interstate" tint="#2bb3a3" />}
                {r.noBridge && <Tag text="no bridges" tint="#B4552F" />}
                {r.minutes && <Tag text={`~${r.minutes} min`} tint="#8a8fa3" />}
                {r.timesDriven > 0 && <Tag text={`driven ${r.timesDriven}×`} tint="#e8842c" />}
              </div>
              {r.notes && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{r.notes}</p>}
            </div>
            <button onClick={async () => { await post({ action: "deleteRoute", id: r.id }); reload(); }}
              style={{ color: "var(--text-muted)" }}><Trash2 size={15} /></button>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <a href={mapsUrl(r.origin, r.destination, r.noHighway)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: "var(--purple)" }}>
              <Navigation size={13} /> Open in Maps
            </a>
            <button onClick={async () => { await post({ action: "drove", id: r.id }); onLog({ phobia: "driving", label: r.name, routeId: r.id }); reload(); }}
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
              I drove it
            </button>
          </div>
        </motion.div>
      ))}

      {!open ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--purple)" }}>
          <Plus size={15} /> Save a route
        </button>
      ) : (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1.5px solid var(--purple)" }}>
          {([["name", "Name it — e.g. 'Home → Meharry, back roads'"], ["origin", "Start address"], ["destination", "Destination address"], ["notes", "Notes — landmarks, where to pull over"]] as const).map(([k, ph]) => (
            <input key={k} value={(f as never)[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          ))}
          <input value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} placeholder="Roughly how many minutes?"
            className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <div className="flex gap-4 text-sm" style={{ color: "var(--text)" }}>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.noHighway} onChange={e => setF({ ...f, noHighway: e.target.checked })} /> No interstate</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.noBridge} onChange={e => setF({ ...f, noBridge: e.target.checked })} /> No bridges</label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>Cancel</button>
            <button disabled={!f.name || !f.origin || !f.destination}
              onClick={async () => {
                await post({ action: "addRoute", ...f, minutes: f.minutes ? Number(f.minutes) : null });
                setF({ name: "", origin: "", destination: "", noHighway: true, noBridge: true, minutes: "", notes: "" });
                setOpen(false); reload();
              }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--purple)" }}>
              Save route
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ text, tint }: { text: string; tint: string }) {
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${tint}1f`, color: tint }}>{text}</span>;
}

// ── Progress ─────────────────────────────────────────────────────────────────

function Progress({ sessions }: { sessions: Session[] }) {
  const withSud = sessions.filter(s => s.sudPeak !== null).slice(0, 20).reverse();

  if (!sessions.length) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>No sessions logged yet — do one step and it starts drawing.</p>;
  }

  return (
    <div className="space-y-5">
      {withSud.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <h3 className="font-bold mb-1" style={{ color: "var(--text)" }}>Your habituation curve</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Peak fear per session, oldest to newest. Watch it come down — that&apos;s the whole point.
          </p>
          <div className="flex items-end gap-1.5" style={{ height: 130 }}>
            {withSud.map((s, i) => (
              <motion.div key={s.id} initial={{ height: 0 }} animate={{ height: `${s.sudPeak}%` }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 90 }}
                title={`${s.label} — peak ${s.sudPeak}`}
                className="flex-1 rounded-t"
                style={{ background: (s.sudPeak ?? 0) > 70 ? "#c0392b" : (s.sudPeak ?? 0) > 45 ? "#e8842c" : "#2bb3a3", minWidth: 6 }} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sessions.slice(0, 25).map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
            className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            {s.phobia === "driving" ? <Car size={16} style={{ color: "var(--purple)" }} /> : <Mountain size={16} style={{ color: "var(--purple)" }} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{s.label}</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {new Date(s.doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {s.minutes ? ` · ${s.minutes} min` : ""}
                {s.panic ? " · panicked and stayed" : ""}
              </div>
            </div>
            {s.sudPeak !== null && s.sudAfter !== null && (
              <span className="text-xs font-bold tabular-nums flex-shrink-0"
                style={{ color: s.sudAfter < s.sudPeak ? "#2bb3a3" : "var(--text-muted)" }}>
                {s.sudPeak} → {s.sudAfter}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Weekly check-in ──────────────────────────────────────────────────────────

function CheckIn({ checkins, sessions, reload }: { checkins: Checkin[]; sessions: Session[]; reload: () => void }) {
  const weekOf = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Sunday
    return d.toISOString().slice(0, 10);
  })();
  const existing = checkins.find(c => c.weekOf === weekOf);
  const [f, setF] = useState({
    wins: existing?.wins ?? "", hardest: existing?.hardest ?? "",
    avoided: existing?.avoided ?? "", nextTarget: existing?.nextTarget ?? "",
    confidence: existing?.confidence ?? 5,
  });
  const [saved, setSaved] = useState(false);

  const weekSessions = sessions.filter(s => new Date(s.doneAt) > new Date(Date.now() - 7 * 86400000));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(180,85,47,.10),rgba(43,179,163,.08))", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck size={17} style={{ color: "var(--purple)" }} />
          <h3 className="font-bold" style={{ color: "var(--text)" }}>This week&apos;s check-in</h3>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {weekSessions.length} session{weekSessions.length === 1 ? "" : "s"} logged since Sunday.
          Bring this to therapy — it&apos;s exactly what they ask you.
        </p>
      </div>

      {([
        ["wins", "What did you do that you couldn't have done a month ago?"],
        ["hardest", "What was the hardest moment, and what did you do with it?"],
        ["avoided", "What did you avoid or turn back from? (No judgement — this is the data)"],
        ["nextTarget", "What's the one step you're taking on next week?"],
      ] as const).map(([k, label]) => (
        <div key={k}>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
          <textarea value={(f as never)[k]} onChange={e => { setF({ ...f, [k]: e.target.value }); setSaved(false); }} rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }} />
        </div>
      ))}

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
          How confident do you feel behind the wheel right now? {f.confidence}/10
        </label>
        <input type="range" min={0} max={10} value={f.confidence}
          onChange={e => { setF({ ...f, confidence: Number(e.target.value) }); setSaved(false); }} className="w-full" />
      </div>

      <button onClick={async () => { await post({ action: "checkin", weekOf, ...f }); setSaved(true); reload(); }}
        className="w-full py-3 rounded-xl font-semibold text-white" style={{ background: "var(--purple)" }}>
        {saved ? "Saved ✓" : "Save check-in"}
      </button>

      {checkins.filter(c => c.weekOf !== weekOf).slice(0, 4).map(c => (
        <div key={c.weekOf} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "var(--purple)" }}>
            Week of {new Date(c.weekOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {c.confidence !== null && ` · confidence ${c.confidence}/10`}
          </div>
          {c.wins && <p className="text-sm" style={{ color: "var(--text)" }}>{c.wins}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Log modal ────────────────────────────────────────────────────────────────

function LogModal({ target, onClose, reload }: {
  target: { phobia: string; label: string; stepId?: string; routeId?: string };
  onClose: () => void; reload: () => void;
}) {
  const [before, setBefore] = useState(50);
  const [peak, setPeak] = useState(60);
  const [after, setAfter] = useState(30);
  const [minutes, setMinutes] = useState("");
  const [panic, setPanic] = useState(false);
  const [notes, setNotes] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  async function save() {
    await post({
      action: "logSession", phobia: target.phobia, stepId: target.stepId ?? null,
      routeId: target.routeId ?? null, label: target.label,
      sudBefore: before, sudPeak: peak, sudAfter: after,
      minutes: minutes ? Number(minutes) : null, panic, notes,
    });
    setCelebrate(true);
    setTimeout(() => { reload(); onClose(); }, 1700);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(20,18,35,.55)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl p-6"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        {celebrate ? (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-8">
            <motion.div animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.7 }}>
              <Trophy size={56} style={{ color: "#e8b52c" }} className="mx-auto" />
            </motion.div>
            <p className="font-serif text-2xl mt-3" style={{ color: "var(--text)" }}>
              {after < peak ? "It came down." : "You stayed in it."}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {after < peak
                ? `Peaked at ${peak}, ended at ${after}. That drop is your brain relearning.`
                : "Staying is the win. The drop comes with repetition."}
            </p>
          </motion.div>
        ) : (
          <>
            <h3 className="font-serif text-xl mb-1" style={{ color: "var(--text)" }}>Log it</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{target.label}</p>

            {([["Before you started", before, setBefore], ["At the worst moment", peak, setPeak], ["When you finished", after, setAfter]] as const).map(([label, val, set]) => (
              <div key={label} className="mb-3">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}: {val}</label>
                <input type="range" min={0} max={100} value={val} onChange={e => set(Number(e.target.value))} className="w-full" />
              </div>
            ))}

            <input value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="How many minutes?"
              className="w-full rounded-lg px-3 py-2 text-sm mb-3" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <label className="flex items-center gap-2 text-sm mb-3" style={{ color: "var(--text)" }}>
              <input type="checkbox" checked={panic} onChange={e => setPanic(e.target.checked)} />
              I had a panic surge and stayed anyway
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering?"
              className="w-full rounded-lg px-3 py-2 text-sm mb-4" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: "var(--purple)" }}>Save</button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
