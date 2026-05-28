"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Moon, Activity, HeartPulse, Footprints, Flame, Zap } from "lucide-react";
import { DashboardData, HealthData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const SESSION_TYPES = [
  { value: "gym",    label: "Gym 🏋🏾‍♀️",          color: "#71816D" },
  { value: "tennis", label: "Tennis 🎾",           color: "#DA667B" },
  { value: "walk",   label: "Morning Walk 🚶🏾‍♀️",   color: "#8A9E87" },
  { value: "other",  label: "Other",               color: "#C9B79C" },
];

// ── Apple Health helpers ───────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return dateStr(d);
  });
}

const WORKOUT_COLORS: [string, string][] = [
  ["tennis",     "#DA667B"],
  ["ladder",     "#71816D"],
  ["strength",   "#71816D"],
  ["functional", "#71816D"],
  ["gym",        "#71816D"],
  ["yoga",       "#8A9E87"],
  ["swim",       "#8A9E87"],
  ["walk",       "#C99A5C"],
  ["hik",        "#C99A5C"],
  ["run",        "#C99A5C"],
];

function workoutColor(type: string): string {
  const t = type.toLowerCase();
  for (const [key, color] of WORKOUT_COLORS) {
    if (t.includes(key)) return color;
  }
  return "#C9B79C";
}

function dayColor(date: string, health: HealthData | undefined): string {
  const workouts = (health?.workouts ?? []).filter((w) => w.startedAt.startsWith(date));
  if (workouts.length > 0) return workoutColor(workouts[0].type);
  const snap = health?.daily?.[date];
  if ((snap?.exerciseMinutes ?? 0) > 0) return "#8A9E87";
  if ((snap?.steps ?? 0) > 3000) return "#C99A5C";
  return "#F1E0C5";
}

function calcStreak(health: HealthData | undefined): number {
  if (!health) return 0;
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = dateStr(d);
    const snap = health.daily?.[ds];
    const hasActivity =
      health.workouts.some((w) => w.startedAt.startsWith(ds)) ||
      (snap?.steps ?? 0) > 1000 ||
      (snap?.exerciseMinutes ?? 0) > 0;
    if (!hasActivity) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function timeAgo(iso: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Mini bar chart ─────────────────────────────────────────────────────────

interface BarChartProps {
  values: (number | null)[];
  maxVal: number;
  color: string;
  height?: number;
}

function BarChart({ values, maxVal, color, height = 48 }: BarChartProps) {
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          {v !== null && v > 0 ? (
            <div
              className="rounded-t-sm"
              style={{
                height: `${Math.max(Math.min(v / maxVal, 1) * height, 2)}px`,
                background: color,
                opacity: 0.85,
              }}
            />
          ) : (
            <div style={{ height: 2, background: "rgba(201,183,156,0.2)" }} className="rounded-t-sm" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Apple Health tab ───────────────────────────────────────────────────────

function AppleHealthTab({ data }: { data: DashboardData }) {
  const health = data.health;
  const today = todayStr();

  if (!health?.lastImportAt) {
    return (
      <div
        className="rounded-2xl p-8 text-center space-y-4"
        style={{ background: "rgba(201,183,156,0.12)", border: "1.5px dashed rgba(201,183,156,0.5)" }}
      >
        <div className="text-4xl">📱</div>
        <h3 className="font-serif text-xl" style={{ color: "#342A21" }}>Connect Apple Health</h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(52,42,33,0.55)" }}>
          Use the <strong>Health Auto Export</strong> app to sync your Apple Health data here automatically.
        </p>
        <div
          className="rounded-xl p-4 text-left text-sm space-y-2 max-w-md mx-auto"
          style={{ background: "#FAF3E8" }}
        >
          <p className="font-medium" style={{ color: "#342A21" }}>Setup steps:</p>
          <ol className="space-y-1.5 list-decimal list-inside" style={{ color: "rgba(52,42,33,0.7)" }}>
            <li>Download <strong>Health Auto Export</strong> from the App Store</li>
            <li>Open the app → <strong>Automations</strong> tab → <strong>+</strong></li>
            <li>Choose <strong>REST API</strong> as the export type</li>
            <li>Set URL to your webhook endpoint (see below)</li>
            <li>Add Authorization header with your secret</li>
            <li>Select metrics: Steps, Active Energy, Exercise Time, Resting HR, Sleep Analysis, Body Mass</li>
            <li>Set schedule (e.g. daily at 8 AM)</li>
          </ol>
        </div>
        <div
          className="rounded-xl p-3 text-left max-w-md mx-auto font-mono text-xs space-y-1.5"
          style={{ background: "rgba(52,42,33,0.06)", color: "#342A21" }}
        >
          <p><span style={{ color: "#71816D" }}>URL:</span> https://your-app.vercel.app/api/health/import</p>
          <p><span style={{ color: "#71816D" }}>Method:</span> POST</p>
          <p><span style={{ color: "#71816D" }}>Header:</span> Authorization: Bearer {"<HEALTH_IMPORT_SECRET>"}</p>
        </div>
      </div>
    );
  }

  const todaySnap = health.daily?.[today] ?? {};
  const todayWorkouts = health.workouts.filter((w) => w.startedAt.startsWith(today));

  const week = pastDays(7);
  const streak = calcStreak(health);

  const sleep30 = pastDays(30).map((d) => health.daily?.[d]?.sleepHours ?? null);
  const hr30 = pastDays(30).map((d) => health.daily?.[d]?.restingHR ?? null);

  const recentWorkouts = health.workouts.slice(0, 12);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-5">
      {/* Today's Movement */}
      <div>
        <h2
          className="font-serif text-xl mb-3"
          style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Today&apos;s Movement
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: <Footprints size={16} />,
              value: todaySnap.steps?.toLocaleString() ?? "—",
              label: "Steps",
              goal: 10000,
              current: todaySnap.steps ?? 0,
              color: "#C99A5C",
            },
            {
              icon: <Zap size={16} />,
              value: todaySnap.exerciseMinutes ? `${todaySnap.exerciseMinutes} min` : "—",
              label: "Exercise",
              goal: 30,
              current: todaySnap.exerciseMinutes ?? 0,
              color: "#71816D",
            },
            {
              icon: <Flame size={16} />,
              value: todaySnap.activeEnergy ? `${todaySnap.activeEnergy} kcal` : "—",
              label: "Active Cal",
              goal: 500,
              current: todaySnap.activeEnergy ?? 0,
              color: "#DA667B",
            },
            {
              icon: <Activity size={16} />,
              value: todayWorkouts.length > 0 ? String(todayWorkouts.length) : "—",
              label: "Workouts",
              goal: 1,
              current: todayWorkouts.length,
              color: "#8A9E87",
            },
          ].map((item) => {
            const pct = Math.min(item.current / item.goal, 1);
            return (
              <div
                key={item.label}
                className="rounded-2xl p-4 flex flex-col gap-2"
                style={{ background: "#FAF3E8" }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <div
                    className="h-1.5 flex-1 mx-3 rounded-full overflow-hidden"
                    style={{ background: "rgba(201,183,156,0.3)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct * 100}%`, background: item.color }}
                    />
                  </div>
                </div>
                <p className="font-serif text-2xl leading-none" style={{ color: "#342A21" }}>
                  {item.value}
                </p>
                <p className="text-xs" style={{ color: "rgba(52,42,33,0.5)" }}>{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak + Weekly Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Streak */}
        <div
          className="rounded-2xl p-5 flex flex-col items-center justify-center text-center"
          style={{ background: "#FAF3E8" }}
        >
          <p className="font-serif text-5xl" style={{ color: "#342A21" }}>{streak}</p>
          <p className="text-sm mt-1" style={{ color: "rgba(52,42,33,0.55)" }}>day streak 🔥</p>
          {streak > 0 && (
            <p className="text-xs mt-2" style={{ color: "rgba(52,42,33,0.4)" }}>keep it going!</p>
          )}
        </div>

        {/* Weekly grid */}
        <div
          className="rounded-2xl p-5 col-span-1 sm:col-span-2"
          style={{ background: "#FAF3E8" }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: "rgba(52,42,33,0.5)" }}>This Week</p>
          <div className="grid grid-cols-7 gap-2">
            {week.map((d) => {
              const date = new Date(d + "T12:00:00");
              const color = dayColor(d, health);
              const isToday = d === today;
              return (
                <div key={d} className="flex flex-col items-center gap-1.5">
                  <p className="text-[10px]" style={{ color: "rgba(52,42,33,0.45)" }}>
                    {DAYS[date.getDay()]}
                  </p>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      background: color,
                      color: color === "#F1E0C5" ? "rgba(52,42,33,0.35)" : "#fff",
                      boxShadow: isToday ? "0 0 0 2px #342A21" : "none",
                    }}
                  >
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {[
              ["#DA667B", "Tennis"],
              ["#71816D", "Strength"],
              ["#C99A5C", "Walking"],
              ["#8A9E87", "Other"],
              ["#F1E0C5", "Rest"],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: "rgba(52,42,33,0.5)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Workouts */}
      {recentWorkouts.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "#FAF3E8" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "rgba(52,42,33,0.5)" }}>Recent Workouts</p>
          <div className="space-y-2">
            {recentWorkouts.map((w) => {
              const color = workoutColor(w.type);
              const dateLabel = format(parseISO(w.startedAt), "EEE, MMM d");
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                  style={{ borderColor: "rgba(201,183,156,0.2)" }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#342A21" }}>{w.type}</p>
                    <p className="text-xs" style={{ color: "rgba(52,42,33,0.5)" }}>{dateLabel}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm" style={{ color: "#342A21" }}>{w.durationMin} min</p>
                    {w.calories && (
                      <p className="text-xs" style={{ color: "rgba(52,42,33,0.5)" }}>{w.calories} kcal</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trends row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sleep trend */}
        <div className="rounded-2xl p-5" style={{ background: "#FAF3E8" }}>
          <div className="flex items-center gap-2 mb-3">
            <Moon size={13} style={{ color: "#71816D" }} />
            <p className="text-xs font-medium" style={{ color: "rgba(52,42,33,0.5)" }}>Sleep — 30 days</p>
          </div>
          <BarChart values={sleep30} maxVal={10} color="#71816D" height={56} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: "rgba(52,42,33,0.35)" }}>30 days ago</span>
            <span className="text-[10px]" style={{ color: "rgba(52,42,33,0.35)" }}>today</span>
          </div>
          {sleep30.some((v) => v !== null) && (
            <p className="text-xs mt-2" style={{ color: "rgba(52,42,33,0.5)" }}>
              Avg{" "}
              <span style={{ color: "#342A21" }}>
                {(
                  sleep30.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) /
                  sleep30.filter((v) => v !== null).length
                ).toFixed(1)}
                h
              </span>{" "}
              per night
            </p>
          )}
        </div>

        {/* Resting HR trend */}
        <div className="rounded-2xl p-5" style={{ background: "#FAF3E8" }}>
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse size={13} style={{ color: "#DA667B" }} />
            <p className="text-xs font-medium" style={{ color: "rgba(52,42,33,0.5)" }}>Resting HR — 30 days</p>
          </div>
          <BarChart values={hr30} maxVal={100} color="#DA667B" height={56} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: "rgba(52,42,33,0.35)" }}>30 days ago</span>
            <span className="text-[10px]" style={{ color: "rgba(52,42,33,0.35)" }}>today</span>
          </div>
          {hr30.some((v) => v !== null) && (
            <p className="text-xs mt-2" style={{ color: "rgba(52,42,33,0.5)" }}>
              Avg{" "}
              <span style={{ color: "#342A21" }}>
                {Math.round(
                  hr30.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) /
                    hr30.filter((v) => v !== null).length
                )}{" "}
                bpm
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Last sync */}
      <p className="text-center text-xs" style={{ color: "rgba(52,42,33,0.35)" }}>
        Last sync: {timeAgo(health.lastImportAt)}
      </p>
    </div>
  );
}

// ── Main FitnessView ──────────────────────────────────────────────────────

const TABS = [
  { id: "log",    label: "My Log" },
  { id: "health", label: "Apple Health" },
] as const;
type TabId = typeof TABS[number]["id"];

export function FitnessView({ data, update }: Props) {
  const [tab, setTab] = useState<TabId>("log");
  const [fitnessOpen, setFitnessOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [fitnessForm, setFitnessForm] = useState({
    type: "gym" as "gym" | "tennis" | "walk" | "other",
    durationMinutes: 45,
    notes: "",
  });
  const [sleepForm, setSleepForm] = useState({ bedtime: "22:00", wakeTime: "06:00", quality: 4, notes: "" });
  const [dateVal, setDateVal] = useState(todayStr());

  const tennisCount = data.fitnessSessions.filter((s) => s.type === "tennis").length;
  const gymCount    = data.fitnessSessions.filter((s) => s.type === "gym").length;
  const walkCount   = data.fitnessSessions.filter((s) => s.type === "walk").length;

  const avgSleepQuality = data.sleepLogs.length
    ? Math.round((data.sleepLogs.reduce((s, l) => s + l.quality, 0) / data.sleepLogs.length) * 10) / 10
    : null;

  const addFitness = () => {
    update((d) => ({
      ...d,
      fitnessSessions: [...d.fitnessSessions, { ...fitnessForm, id: id(), date: dateVal }],
    }));
    setFitnessForm({ type: "gym", durationMinutes: 45, notes: "" });
    setFitnessOpen(false);
  };

  const addSleep = () => {
    update((d) => ({
      ...d,
      sleepLogs: [...d.sleepLogs.filter((s) => s.date !== dateVal), { ...sleepForm, date: dateVal }],
    }));
    setSleepForm({ bedtime: "22:00", wakeTime: "06:00", quality: 4, notes: "" });
    setSleepOpen(false);
  };

  const deleteFitness = (sid: string) => {
    update((d) => ({ ...d, fitnessSessions: d.fitnessSessions.filter((s) => s.id !== sid) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="font-serif text-4xl"
            style={{ color: "#342A21", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Fitness & Sleep
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(52,42,33,0.5)" }}>
            Movement that brings you joy, rest that restores you 🎾
          </p>
        </div>
        {tab === "log" && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSleepOpen(true)}>
              <Moon size={14} className="mr-1.5 inline" /> Log Sleep
            </Button>
            <Button onClick={() => setFitnessOpen(true)}>
              <Plus size={14} className="mr-1.5 inline" /> Log Session
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl"
        style={{ background: "rgba(201,183,156,0.18)" }}
      >
        {TABS.map(({ id: tid, label }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: tab === tid ? "#FAF3E8" : "transparent",
              color: tab === tid ? "#342A21" : "rgba(52,42,33,0.5)",
              boxShadow: tab === tid ? "0 2px 8px rgba(52,42,33,0.08)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* My Log tab */}
      {tab === "log" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              <p className="font-serif text-3xl text-brown">{tennisCount}</p>
              <p className="text-xs text-sand-dark mt-1">Tennis sessions 🎾</p>
              <p className="text-xs text-terracotta mt-0.5">joy, not exercise</p>
            </Card>
            <Card className="text-center">
              <p className="font-serif text-3xl text-brown">{gymCount}</p>
              <p className="text-xs text-sand-dark mt-1">Gym sessions</p>
            </Card>
            <Card className="text-center">
              <p className="font-serif text-3xl text-brown">{walkCount}</p>
              <p className="text-xs text-sand-dark mt-1">Morning walks</p>
            </Card>
            <Card className="text-center">
              <p className="font-serif text-3xl text-brown">{avgSleepQuality ?? "—"}</p>
              <p className="text-xs text-sand-dark mt-1">Avg sleep quality</p>
            </Card>
          </div>

          <Card title="Recent Activity">
            {data.fitnessSessions.length === 0 ? (
              <p className="text-sand-dark text-sm">No sessions logged yet. Move your body! 🌿</p>
            ) : (
              <div className="space-y-2">
                {[...data.fitnessSessions]
                  .reverse()
                  .slice(0, 20)
                  .map((s) => {
                    const type = SESSION_TYPES.find((t) => t.value === s.type);
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark group">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: type?.color }} />
                        <div className="flex-1">
                          <p className="text-sm text-brown">{type?.label}</p>
                          <p className="text-xs text-sand-dark">
                            {format(parseISO(s.date), "MMM d")} · {s.durationMinutes}min
                          </p>
                          {s.notes && <p className="text-xs text-brown italic">{s.notes}</p>}
                        </div>
                        <button
                          onClick={() => deleteFitness(s.id)}
                          className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>

          <Card title="Sleep Log">
            {data.sleepLogs.length === 0 ? (
              <p className="text-sand-dark text-sm">No sleep logs yet. Rest is productivity too 🌙</p>
            ) : (
              <div className="space-y-2">
                {[...data.sleepLogs]
                  .reverse()
                  .slice(0, 14)
                  .map((s) => (
                    <div key={s.date} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark">
                      <Moon size={14} className="text-brown opacity-40 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-sand-dark">{format(parseISO(s.date), "EEEE, MMM d")}</p>
                        <p className="text-sm text-brown">
                          {s.bedtime} → {s.wakeTime}
                        </p>
                        {s.notes && <p className="text-xs text-brown italic">{s.notes}</p>}
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{ background: i < s.quality ? "#71816D" : "#DAC9A8" }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Apple Health tab */}
      {tab === "health" && <AppleHealthTab data={data} />}

      {/* Modals */}
      <Modal open={fitnessOpen} onClose={() => setFitnessOpen(false)} title="Log Activity">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Date</label>
            <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-2">Activity Type</label>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setFitnessForm({ ...fitnessForm, type: t.value as typeof fitnessForm.type })}
                  className={`p-2.5 rounded-xl text-sm border transition-all text-left ${
                    fitnessForm.type === t.value
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-sand hover:border-sand-dark text-brown"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              value={fitnessForm.durationMinutes}
              onChange={(e) => setFitnessForm({ ...fitnessForm, durationMinutes: Number(e.target.value) })}
              className="w-24"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="How'd it feel?"
              value={fitnessForm.notes}
              onChange={(e) => setFitnessForm({ ...fitnessForm, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setFitnessOpen(false)}>Cancel</Button>
            <Button onClick={addFitness}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={sleepOpen} onClose={() => setSleepOpen(false)} title="Log Sleep">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Date</label>
            <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Bedtime</label>
              <input
                type="time"
                value={sleepForm.bedtime}
                onChange={(e) => setSleepForm({ ...sleepForm, bedtime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Wake time</label>
              <input
                type="time"
                value={sleepForm.wakeTime}
                onChange={(e) => setSleepForm({ ...sleepForm, wakeTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-2">Sleep quality</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSleepForm({ ...sleepForm, quality: n })}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                    sleepForm.quality >= n
                      ? "bg-terracotta text-white"
                      : "bg-cream-darker text-sand-dark hover:bg-cream-dark"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Vivid dreams? Restless?"
              value={sleepForm.notes}
              onChange={(e) => setSleepForm({ ...sleepForm, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setSleepOpen(false)}>Cancel</Button>
            <Button onClick={addSleep}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
