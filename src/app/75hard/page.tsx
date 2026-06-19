"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { Sidebar } from "@/components/nav/Sidebar";
import { SeventyFiveHardDayLog } from "@/types/dashboard";
import { useState, useEffect } from "react";
import { Flame, Footprints, Droplets, Brain, Camera, Shield, Salad, Check, X, Trophy, Zap, Star, AlertTriangle, Utensils } from "lucide-react";
import { PhotoUpload } from "@/components/seventyfivehard/PhotoUpload";
import { PhotoGallery } from "@/components/seventyfivehard/PhotoGallery";
import { FoodLogger } from "@/components/seventyfivehard/FoodLogger";

const DEFAULT_START = "2026-06-15"; // Monday June 15

// Fast food / delivery merchants that trigger restart
const BANNED_MERCHANTS = [
  "mcdonald", "mcdonalds", "mcd", "patty b", "patty bs", "cubey", "cubeys",
  "burger king", "wendy", "wendys", "chick-fil-a", "chickfila", "popeyes",
  "taco bell", "domino", "pizza hut", "papa john", "subway", "chipotle",
  "starbucks", "dunkin", "sonic", "dairy queen", "jack in the box", "whataburger",
  "five guys", "cook out", "cookout", "raising cane", "zaxby",
  "doordash", "uber eats", "ubereats", "grubhub", "instacart", "postmates",
];

const RULES = [
  { key: "workout",         icon: Flame,      label: "Workout",          sub: "45+ min intentional movement",                    color: "#E879F9" },
  { key: "steps",           icon: Footprints, label: "10K Steps",        sub: "Every single day, no exceptions",                 color: "#FB923C" },
  { key: "water",           icon: Droplets,   label: "64oz Water",       sub: "Track & drink all day",                           color: "#38BDF8" },
  { key: "mcat",            icon: Brain,      label: "90 Min MCAT",      sub: "Logged study session",                            color: "#A78BFA" },
  { key: "progressPhoto",   icon: Camera,     label: "Progress Photo",   sub: "Daily — no skipping",                             color: "#F472B6" },
  { key: "diet",            icon: Salad,      label: "Clean Eating",     sub: "Log 1 meal · no fast food/delivery/Starbucks",    color: "#10B981" },
  { key: "exposureTherapy", icon: Shield,     label: "Exposure Therapy", sub: "Log something — won't reset",                    color: "#F59E0B" },
];

const RESET_KEYS = ["workout", "steps", "water", "mcat", "progressPhoto", "diet"];
const MAX_SITDOWN = 5;

function getToday() { return new Date().toISOString().slice(0, 10); }

function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getDayNumber(startDate: string) {
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
}

function isStarted(startDate: string) {
  return getDaysUntil(startDate) <= 0;
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function SeventyFivePage() {
  const { data, update, saving } = useDashboard();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [violation, setViolation] = useState<string | null>(null);
  const [, setCheckingPlaid] = useState(false);

  const hardData = data?.seventyFiveHard ?? {
    startDate: DEFAULT_START, currentDay: 1, active: true, logs: [],
  };
  // If stored start date is in the past with no logs, treat as not yet started
  const effectiveStartDate = hardData.startDate ?? DEFAULT_START;
  const endDate = (() => {
    const d = new Date(effectiveStartDate); d.setDate(d.getDate() + 74);
    return d.toISOString().slice(0, 10);
  })();

  const today = getToday();
  const started = isStarted(effectiveStartDate);
  const daysUntilStart = Math.max(0, getDaysUntil(effectiveStartDate));
  const dayNum = started ? getDayNumber(effectiveStartDate) : 0;
  const daysLeft = Math.max(0, 75 - dayNum);
  const progressPct = Math.min(100, ((dayNum - 1) / 75) * 100);

  const todayLog: SeventyFiveHardDayLog = hardData.logs.find(l => l.date === today) ?? {
    date: today, workout: false, steps: false, water: false,
    mcat: false, progressPhoto: false, exposureTherapy: false, diet: false,
  };

  const completedToday = RESET_KEYS.filter(k => todayLog[k as keyof SeventyFiveHardDayLog]).length;
  const pct = Math.round((completedToday / RESET_KEYS.length) * 100);

  // Sit-down restaurant count from logs
  const sitDownUsed = (hardData as unknown as Record<string, unknown>).sitDownMeals as number ?? 0;

  const streak = (() => {
    let s = 0;
    const sorted = [...hardData.logs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of sorted) {
      if (log.date === today) continue;
      if (RESET_KEYS.every(k => log[k as keyof SeventyFiveHardDayLog])) s++;
      else break;
    }
    return s;
  })();

  // Check Plaid transactions for violations
  useEffect(() => {
    if (!started) return;
    setCheckingPlaid(true);
    fetch("/api/plaid/transactions")
      .then(r => r.json())
      .then(d => {
        const txs = d.transactions ?? [];
        const todayTxs = txs.filter((t: { date: string; name: string; amount: number }) => t.date === today && t.amount > 0);
        for (const tx of todayTxs) {
          const name = tx.name.toLowerCase();
          const banned = BANNED_MERCHANTS.find(m => name.includes(m));
          if (banned) {
            setViolation(`"${tx.name}" detected — this violates 75 Hard. Day 1 restart required.`);
            break;
          }
        }
      })
      .catch(() => {})
      .finally(() => setCheckingPlaid(false));
  }, [started, today]);

  function spawnParticles() {
    const colors = ["#7C5CFC", "#E879F9", "#FB923C", "#10B981", "#38BDF8", "#F59E0B"];
    const newP = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newP);
    setTimeout(() => setParticles([]), 1500);
  }

  function toggleTask(key: string) {
    const newVal = !todayLog[key as keyof SeventyFiveHardDayLog];
    const updated = { ...todayLog, [key]: newVal };
    const newLogs = [...hardData.logs.filter(l => l.date !== today), updated];
    if (newVal) spawnParticles();
    update(prev => ({ ...prev, seventyFiveHard: { ...hardData, logs: newLogs } }));
  }

  function confirmRestart(newStart?: string) {
    update(prev => ({
      ...prev,
      seventyFiveHard: {
        startDate: newStart ?? today,
        currentDay: 1,
        active: true,
        logs: [],
      },
    }));
    setViolation(null);
  }

  function logSitDown() {
    const dataAny = (hardData as unknown) as Record<string, unknown>;
    update(prev => ({
      ...prev,
      seventyFiveHard: {
        ...hardData,
        ...(({ sitDownMeals: (dataAny.sitDownMeals as number ?? 0) + 1 }) as object),
      } as typeof hardData,
    }));
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar saving={saving} />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Hero Banner */}
        <div className="relative overflow-hidden" style={{
          background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 40%, #1a0533 100%)",
          minHeight: started ? "340px" : "280px",
        }}>
          {/* Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute rounded-full animate-pulse" style={{
                width: `${80 + i * 40}px`, height: `${80 + i * 40}px`,
                background: i % 2 === 0
                  ? "radial-gradient(circle, rgba(124,92,252,0.3) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(232,121,249,0.2) 0%, transparent 70%)",
                left: `${(i * 17) % 90}%`, top: `${(i * 23) % 80}%`,
                animationDelay: `${i * 0.4}s`, animationDuration: `${2 + i * 0.5}s`,
              }} />
            ))}
          </div>

          {/* Particles */}
          {particles.map(p => (
            <div key={p.id} className="absolute pointer-events-none animate-bounce" style={{
              left: `${p.x}%`, top: `${p.y}%`, width: "8px", height: "8px",
              borderRadius: "50%", background: p.color, boxShadow: `0 0 8px ${p.color}`,
            }} />
          ))}

          <div className="relative z-10 px-5 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-1">
              <Zap size={26} fill="#F59E0B" color="#F59E0B" className="animate-pulse" />
              <h1 className="font-serif text-4xl font-bold" style={{
                background: "linear-gradient(135deg, #ffffff 0%, #E879F9 50%, #7C5CFC 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>75 Hard</h1>
              <Zap size={26} fill="#F59E0B" color="#F59E0B" className="animate-pulse" />
            </div>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>Aya&apos;s Mental Toughness Challenge</p>

            {!started ? (
              /* PRE-START COUNTDOWN */
              <div>
                <div className="flex gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-5xl font-black" style={{ color: "#E879F9" }}>{daysUntilStart}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>days to start</div>
                  </div>
                  <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <div className="flex-1">
                    <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Starts</div>
                    <div className="text-sm font-semibold text-white">{formatDate(effectiveStartDate)}</div>
                    <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Ends</div>
                    <div className="text-sm font-semibold text-white">{formatDate(endDate)}</div>
                  </div>
                </div>
                <div className="text-xs px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                  75 days · 7 rules · 0 exceptions
                </div>
                <button onClick={() => confirmRestart(today)} className="mt-3 w-full py-3 rounded-2xl text-sm font-bold text-white" type="button"
                  style={{ background: "linear-gradient(135deg, #7C5CFC, #E879F9)" }}>
                  Start Today — Day 1
                </button>
              </div>
            ) : (
              /* ACTIVE */
              <>
                <div className="flex items-end gap-3 mb-4">
                  <div>
                    <div className="text-7xl font-black leading-none" style={{
                      background: "linear-gradient(135deg, #fff 0%, #E879F9 100%)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>{dayNum}</div>
                    <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>OF 75</div>
                  </div>
                  <div className="flex flex-col gap-1 mb-2 ml-2">
                    <div className="flex items-center gap-1.5">
                      <Flame size={13} color="#FB923C" fill="#FB923C" />
                      <span className="text-sm font-bold" style={{ color: "#FB923C" }}>{streak} day streak</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star size={13} color="#F59E0B" fill="#F59E0B" />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{daysLeft} days left · ends {formatDate(endDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #7C5CFC, #E879F9, #FB923C)",
                      boxShadow: "0 0 12px rgba(232,121,249,0.6)",
                    }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{formatDate(effectiveStartDate)}</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{formatDate(endDate)}</span>
                  </div>
                </div>

                {/* Today ring */}
                <div className="flex items-center gap-3 mt-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg viewBox="0 0 56 56" className="w-12 h-12 -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="url(#todayGrad)" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                      <defs>
                        <linearGradient id="todayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7C5CFC" />
                          <stop offset="100%" stopColor="#E879F9" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{pct}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{completedToday}/{RESET_KEYS.length} done today</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {pct === 100 ? "🔥 Day complete! You crushed it!" : `${RESET_KEYS.length - completedToday} remaining`}
                    </div>
                  </div>
                  {pct === 100 && <Trophy size={22} color="#F59E0B" fill="#F59E0B" className="ml-auto" />}
                </div>
                <button onClick={() => { if (confirm("Reset to Day 1 starting today?")) confirmRestart(today); }}
                  className="mt-3 text-xs px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                  Reset to Day 1
                </button>
              </>
            )}
          </div>
        </div>

        {/* Violation Banner */}
        {violation && (
          <div className="mx-4 mt-4 p-4 rounded-2xl" style={{ background: "#EF444415", border: "1.5px solid #EF4444" }}>
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle size={20} color="#EF4444" className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm" style={{ color: "#EF4444" }}>75 Hard Violation Detected</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{violation}</div>
              </div>
            </div>
            <button onClick={() => confirmRestart()} className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "#EF4444" }}>
              Confirm Restart — Back to Day 1
            </button>
            <button onClick={() => setViolation(null)} className="w-full py-2 text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Dismiss (transaction was a mistake)
            </button>
          </div>
        )}

        <div className="px-4 py-5 space-y-3 max-w-2xl mx-auto">

          {/* Sit-down restaurant tracker */}
          <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Utensils size={16} color="#10B981" />
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Sit-Down Restaurants</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Traditional sit-down only · {MAX_SITDOWN - sitDownUsed} remaining</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: MAX_SITDOWN }, (_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{
                    background: i < sitDownUsed ? "#EF4444" : "#10B98130",
                    border: `1.5px solid ${i < sitDownUsed ? "#EF4444" : "#10B98150"}`,
                  }} />
                ))}
              </div>
              {started && sitDownUsed < MAX_SITDOWN && (
                <button onClick={logSitDown} className="text-xs px-2 py-1 rounded-lg font-medium"
                  style={{ background: "#10B98120", color: "#10B981" }}>Use</button>
              )}
            </div>
          </div>

          <h2 className="font-semibold text-xs uppercase tracking-wider pt-2" style={{ color: "var(--text-muted)" }}>
            {started ? "Today's Checklist" : "Your Rules — Preview"}
          </h2>

          {RULES.map(({ key, icon: Icon, label, sub, color }) => {
            const isExposure = key === "exposureTherapy";
            const done = !!todayLog[key as keyof SeventyFiveHardDayLog];
            const isReset = RESET_KEYS.includes(key);

            return (
              <button key={key} onClick={() => toggleTask(key)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 text-left"
                style={{
                  background: done ? `linear-gradient(135deg, ${color}18, ${color}08)` : "var(--surface)",
                  border: done ? `1.5px solid ${color}40` : "1.5px solid var(--border)",
                  boxShadow: done ? `0 4px 20px ${color}20` : "var(--shadow)",
                  transform: done ? "scale(1.01)" : "scale(1)",
                  opacity: !started && !done ? 0.75 : 1,
                }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
                  background: done ? color : `${color}20`,
                  boxShadow: done ? `0 4px 12px ${color}50` : "none",
                  transition: "all 0.3s ease",
                }}>
                  <Icon size={20} color={done ? "#fff" : color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2 flex-wrap" style={{ color: "var(--text)" }}>
                    {label}
                    {isExposure && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F59E0B20", color: "#F59E0B" }}>no reset</span>}
                    {isReset && !isExposure && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EF444420", color: "#EF4444" }}>miss = Day 1</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</div>
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300" style={{
                  background: done ? color : "var(--bg)",
                  boxShadow: done ? `0 2px 8px ${color}60` : "none",
                }}>
                  {done ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="var(--text-muted)" />}
                </div>
              </button>
            );
          })}

          {/* Daily Photos — always visible */}
          <div className="mt-2 space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wider pt-2 mb-2" style={{ color: "var(--text-muted)" }}>
              Today&apos;s Photos
            </h2>
            <PhotoUpload type="progress" onSuccess={() => update(prev => ({
              ...prev, seventyFiveHard: {
                ...hardData,
                logs: [...hardData.logs.filter(l => l.date !== today), { ...todayLog, progressPhoto: true }],
              },
            }))} />
            <PhotoUpload type="weight" onSuccess={(_, weight) => {
              if (weight) update(prev => ({
                ...prev,
                workout: {
                  ...prev.workout!,
                  bodyWeight: [...(prev.workout?.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight }],
                },
              }));
            }} />
            <FoodLogger date={today} onMealAdded={() => update(prev => ({
              ...prev, seventyFiveHard: {
                ...hardData,
                logs: [...hardData.logs.filter(l => l.date !== today), { ...todayLog, diet: true }],
              },
            }))} />
          </div>

          {/* Day grid */}
          {started && dayNum > 0 && (
            <div className="mt-4">
              <h2 className="font-semibold text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Journey So Far</h2>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(dayNum, 75) }, (_, i) => {
                  const d = i + 1;
                  const s = new Date(hardData.startDate); s.setDate(s.getDate() + i);
                  const dateStr = s.toISOString().slice(0, 10);
                  const log = hardData.logs.find(l => l.date === dateStr);
                  const complete = log ? RESET_KEYS.every(k => log[k as keyof SeventyFiveHardDayLog]) : false;
                  const isToday = dateStr === today;
                  return (
                    <div key={d} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        background: isToday ? "linear-gradient(135deg,#7C5CFC,#E879F9)" : complete ? "#10B98125" : "var(--bg2)",
                        color: isToday ? "#fff" : complete ? "#10B981" : "var(--text-muted)",
                        border: isToday ? "2px solid #7C5CFC" : complete ? "1.5px solid #10B98140" : "1.5px solid var(--border)",
                        boxShadow: isToday ? "0 4px 12px rgba(124,92,252,0.4)" : "none",
                      }}>
                      {complete ? "✓" : d}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Photo Timeline */}
          <PhotoGallery hardData={hardData} />

          {/* Footer */}
          <div className="p-4 rounded-2xl text-center" style={{
            background: "linear-gradient(135deg, rgba(124,92,252,0.1), rgba(232,121,249,0.08))",
            border: "1.5px solid rgba(124,92,252,0.2)",
          }}>
            <p className="text-sm font-medium" style={{ color: "var(--purple)" }}>
              {!started
                ? `${daysUntilStart} days until you begin. The decision is already made. 🔥`
                : pct === 100
                ? `Day ${dayNum} complete. ${daysLeft} days left. Unstoppable. 🏆`
                : "Every rep, every step, every choice — it all compounds. 💜"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
