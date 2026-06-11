"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { Sidebar } from "@/components/nav/Sidebar";
import { SeventyFiveHardDayLog } from "@/types/dashboard";
import { useState } from "react";
import { Flame, Footprints, Droplets, Brain, Camera, Shield, Salad, Check, X, Trophy, Zap, Star } from "lucide-react";

const START_DATE = "2026-06-12"; // Thursday

const RULES = [
  { key: "workout",         icon: Flame,      label: "Workout",          sub: "45+ min intentional movement",  color: "#E879F9" },
  { key: "steps",           icon: Footprints, label: "10K Steps",        sub: "Every single day, no exceptions", color: "#FB923C" },
  { key: "water",           icon: Droplets,   label: "64oz Water",       sub: "Track & drink all day",          color: "#38BDF8" },
  { key: "mcat",            icon: Brain,      label: "90 Min MCAT",      sub: "Logged study session",           color: "#A78BFA" },
  { key: "progressPhoto",   icon: Camera,     label: "Progress Photo",   sub: "Daily — no skipping",            color: "#F472B6" },
  { key: "diet",            icon: Salad,      label: "Clean Eating",     sub: "No fast food, takeout or Uber Eats", color: "#10B981" },
  { key: "exposureTherapy", icon: Shield,     label: "Exposure Therapy", sub: "Log something — won't reset",   color: "#F59E0B" },
];

const RESET_KEYS = ["workout", "steps", "water", "mcat", "progressPhoto", "diet"];

function getDayNumber(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function isStarted(startDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return today >= start;
}

export default function SeventyFivePage() {
  const { data, update, saving } = useDashboard();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  const hardData = data?.seventyFiveHard ?? {
    startDate: START_DATE,
    currentDay: 1,
    active: true,
    logs: [],
  };

  const today = getToday();
  const started = isStarted(hardData.startDate);
  const dayNum = started ? getDayNumber(hardData.startDate) : 0;
  const todayLog: SeventyFiveHardDayLog = hardData.logs.find(l => l.date === today) ?? {
    date: today,
    workout: false,
    steps: false,
    water: false,
    mcat: false,
    progressPhoto: false,
    exposureTherapy: false,
    diet: false,
  };

  const completedToday = RESET_KEYS.filter(k => todayLog[k as keyof SeventyFiveHardDayLog]).length;
  const totalRequired = RESET_KEYS.length;
  const pct = Math.round((completedToday / totalRequired) * 100);

  // Count consecutive completed days
  const streak = (() => {
    let s = 0;
    const sortedLogs = [...hardData.logs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of sortedLogs) {
      if (log.date === today) continue; // don't count today yet
      const allDone = RESET_KEYS.every(k => log[k as keyof SeventyFiveHardDayLog]);
      if (allDone) s++;
      else break;
    }
    return s;
  })();

  function spawnParticles() {
    const colors = ["#7C5CFC", "#E879F9", "#FB923C", "#10B981", "#38BDF8", "#F59E0B"];
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1500);
  }

  function toggleTask(key: string) {
    const newVal = !todayLog[key as keyof SeventyFiveHardDayLog];
    const updated = { ...todayLog, [key]: newVal };
    const otherLogs = hardData.logs.filter(l => l.date !== today);
    const newLogs = [...otherLogs, updated];

    if (newVal) spawnParticles();

    update(prev => ({ ...prev, seventyFiveHard: { ...hardData, logs: newLogs } }));
  }

  const daysLeft = Math.max(0, 75 - dayNum);
  const progressPct = Math.min(100, ((dayNum - 1) / 75) * 100);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar saving={saving} />

      <main className="flex-1 overflow-y-auto">
        {/* Hero Banner */}
        <div className="relative overflow-hidden" style={{
          background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 40%, #1a0533 100%)",
          minHeight: "320px",
        }}>
          {/* Animated orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute rounded-full animate-pulse" style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                background: i % 2 === 0
                  ? "radial-gradient(circle, rgba(124,92,252,0.3) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(232,121,249,0.2) 0%, transparent 70%)",
                left: `${(i * 17) % 90}%`,
                top: `${(i * 23) % 80}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2 + i * 0.5}s`,
              }} />
            ))}
          </div>

          {/* Particles */}
          {particles.map(p => (
            <div key={p.id} className="absolute pointer-events-none animate-bounce" style={{
              left: `${p.x}%`, top: `${p.y}%`,
              width: "8px", height: "8px",
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 8px ${p.color}`,
            }} />
          ))}

          <div className="relative z-10 px-6 pt-8 pb-6">
            {/* Title */}
            <div className="flex items-center gap-3 mb-2">
              <Zap size={28} fill="#F59E0B" color="#F59E0B" className="animate-pulse" />
              <h1 className="font-serif text-4xl font-bold" style={{
                background: "linear-gradient(135deg, #ffffff 0%, #E879F9 50%, #7C5CFC 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>75 Hard</h1>
              <Zap size={28} fill="#F59E0B" color="#F59E0B" className="animate-pulse" />
            </div>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>Aya&apos;s Mental Toughness Challenge</p>

            {!started ? (
              <div className="text-center py-4">
                <div className="text-6xl font-bold mb-2" style={{ color: "#E879F9" }}>
                  {Math.abs(dayNum - 1)}
                </div>
                <p className="text-white text-lg">days until Day 1</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Starting Thursday, June 12</p>
              </div>
            ) : (
              <>
                {/* Day counter */}
                <div className="flex items-end gap-2 mb-4">
                  <div>
                    <div className="text-7xl font-black leading-none" style={{
                      background: "linear-gradient(135deg, #ffffff 0%, #E879F9 100%)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>{dayNum}</div>
                    <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>OF 75</div>
                  </div>
                  <div className="flex flex-col gap-1 mb-2 ml-4">
                    <div className="flex items-center gap-1.5">
                      <Flame size={14} color="#FB923C" fill="#FB923C" />
                      <span className="text-sm font-bold" style={{ color: "#FB923C" }}>{streak} day streak</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{daysLeft} days left</span>
                    </div>
                  </div>
                </div>

                {/* Overall progress bar */}
                <div className="mb-3">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #7C5CFC, #E879F9, #FB923C)",
                      boxShadow: "0 0 12px rgba(232,121,249,0.6)",
                    }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Day 1</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Day 75 — Sep 12</span>
                  </div>
                </div>

                {/* Today's progress ring summary */}
                <div className="flex items-center gap-3 mt-4 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                      <circle cx="28" cy="28" r="24" fill="none"
                        stroke="url(#todayGrad)" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                        style={{ transition: "stroke-dashoffset 0.5s ease" }}
                      />
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
                    <div className="text-white font-bold">{completedToday}/{totalRequired} done today</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {pct === 100 ? "🔥 Day complete! You crushed it!" : `${totalRequired - completedToday} tasks remaining`}
                    </div>
                  </div>
                  {pct === 100 && <Trophy size={24} color="#F59E0B" fill="#F59E0B" className="ml-auto" />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="px-4 py-5 space-y-3 max-w-2xl mx-auto">
          <h2 className="font-semibold text-sm uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            {started ? "Today's Checklist" : "Your Rules"}
          </h2>

          {RULES.map(({ key, icon: Icon, label, sub, color }) => {
            const isExposure = key === "exposureTherapy";
            const done = !!todayLog[key as keyof SeventyFiveHardDayLog];
            const isReset = RESET_KEYS.includes(key);

            return (
              <button key={key} onClick={() => started && toggleTask(key)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 text-left"
                style={{
                  background: done
                    ? `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`
                    : "var(--surface)",
                  border: done ? `1.5px solid ${color}40` : "1.5px solid var(--border)",
                  boxShadow: done ? `0 4px 20px ${color}20` : "var(--shadow)",
                  cursor: started ? "pointer" : "default",
                  transform: done ? "scale(1.01)" : "scale(1)",
                }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
                  background: done ? color : `${color}20`,
                  boxShadow: done ? `0 4px 12px ${color}50` : "none",
                  transition: "all 0.3s ease",
                }}>
                  <Icon size={20} color={done ? "#fff" : color} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--text)" }}>
                    {label}
                    {isExposure && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F59E0B20", color: "#F59E0B" }}>
                        no reset
                      </span>
                    )}
                    {isReset && !isExposure && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EF444420", color: "#EF4444" }}>
                        miss = Day 1
                      </span>
                    )}
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

          {/* Past days grid */}
          {started && hardData.logs.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Journey So Far
              </h2>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.min(dayNum, 75) }, (_, i) => {
                  const d = i + 1;
                  const dateStr = (() => {
                    const s = new Date(hardData.startDate);
                    s.setDate(s.getDate() + i);
                    return s.toISOString().slice(0, 10);
                  })();
                  const log = hardData.logs.find(l => l.date === dateStr);
                  const complete = log ? RESET_KEYS.every(k => log[k as keyof SeventyFiveHardDayLog]) : false;
                  const isToday = dateStr === today;

                  return (
                    <div key={d} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: isToday
                          ? "linear-gradient(135deg, #7C5CFC, #E879F9)"
                          : complete ? "#10B98130" : "var(--bg2)",
                        color: isToday ? "#fff" : complete ? "#10B981" : "var(--text-muted)",
                        border: isToday ? "2px solid #7C5CFC" : complete ? "1.5px solid #10B98150" : "1.5px solid var(--border)",
                        boxShadow: isToday ? "0 4px 12px rgba(124,92,252,0.4)" : "none",
                      }}>
                      {complete ? "✓" : d}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivation footer */}
          <div className="mt-6 p-4 rounded-2xl text-center" style={{
            background: "linear-gradient(135deg, rgba(124,92,252,0.1) 0%, rgba(232,121,249,0.08) 100%)",
            border: "1.5px solid rgba(124,92,252,0.2)",
          }}>
            <p className="text-sm font-medium" style={{ color: "var(--purple)" }}>
              {!started
                ? "The journey of 75 days begins with one decision. You already made it. 🔥"
                : pct === 100
                ? "Day " + dayNum + " complete. You're unstoppable. 🏆"
                : "Every rep, every step, every choice — it all compounds. Keep going. 💜"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
