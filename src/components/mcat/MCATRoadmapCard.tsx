"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Flame, Target } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { computeRoadmap } from "@/lib/mcatRoadmap";
import { today as todayStr } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function MCATRoadmapCard({ data, update }: Props) {
  const roadmap = computeRoadmap(data);
  const today = todayStr();
  const todayLog = (data.mcatDailyLogs ?? []).find(l => l.date === today);
  const [uworldForm, setUworldForm] = useState({ passages: "", percent: "" });

  const setTodayLog = (patch: Partial<NonNullable<typeof todayLog>>) => {
    update(d => {
      const logs = d.mcatDailyLogs ?? [];
      const existing = logs.find(l => l.date === today) ?? { date: today, ankiDone: false, carsDone: false };
      return { ...d, mcatDailyLogs: [...logs.filter(l => l.date !== today), { ...existing, ...patch }] };
    });
  };

  const saveUworld = () => {
    const passages = parseFloat(uworldForm.passages);
    const percent = parseFloat(uworldForm.percent);
    if (!passages) return;
    setTodayLog({ uworldPassages: passages, uworldPercent: isNaN(percent) ? undefined : percent });
    setUworldForm({ passages: "", percent: "" });
  };

  if (!roadmap.testDate || !roadmap.phase) {
    return (
      <Card title="MCAT Roadmap" subtitle="Set your test date to unlock a personalized 19-week plan">
        <p className="text-sm text-sand-dark">Set your MCAT test date above to get a phase-based, science-backed study roadmap built around your actual sessions instead of random daily studying.</p>
      </Card>
    );
  }

  const { phase, daysRemaining, weeksRemaining, weeklyHourTarget, hoursLoggedThisWeek, ankiStreak, carsStreak, uworldPassagesTotal, uworldAvgPercent, aamcFlScores, aamcFlTrend } = roadmap;

  return (
    <div className="space-y-4">
      {/* Phase banner */}
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #2B1F4A 0%, #5B3FA8 55%, #9A5CFC 100%)" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{phase.weekRange} · {weeksRemaining}w to go</p>
            <h2 className="font-serif text-2xl mt-0.5">Phase {phase.id}: {phase.name}</h2>
            <p className="text-sm text-white/80 mt-1">{phase.focus}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-serif">{daysRemaining}</p>
            <p className="text-[11px] text-white/70">days to test</p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {phase.actions.map((a, i) => (
            <li key={i} className="text-sm text-white/90 flex gap-2">
              <span className="text-white/50">•</span>{a}
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
            <span>This week&apos;s hours</span>
            <span>{hoursLoggedThisWeek}h / {weeklyHourTarget}h target</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (hoursLoggedThisWeek / (weeklyHourTarget || 1)) * 100)}%`, background: "#A7D4A0" }} />
          </div>
        </div>
      </div>

      {/* Daily checklist */}
      <Card title="Today's Non-Negotiables">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setTodayLog({ ankiDone: !todayLog?.ankiDone })}
            className="flex items-center gap-2 p-3 rounded-xl text-left" style={{ background: todayLog?.ankiDone ? "rgba(16,185,129,0.1)" : "var(--bg)" }}>
            {todayLog?.ankiDone ? <CheckCircle2 size={18} className="text-sage flex-shrink-0" /> : <Circle size={18} className="text-sand flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-brown">Anki done</p>
              <p className="text-xs text-sand-dark flex items-center gap-1"><Flame size={10} /> {ankiStreak} day streak</p>
            </div>
          </button>
          <button onClick={() => setTodayLog({ carsDone: !todayLog?.carsDone })}
            className="flex items-center gap-2 p-3 rounded-xl text-left" style={{ background: todayLog?.carsDone ? "rgba(16,185,129,0.1)" : "var(--bg)" }}>
            {todayLog?.carsDone ? <CheckCircle2 size={18} className="text-sage flex-shrink-0" /> : <Circle size={18} className="text-sand flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-brown">CARS (1–2 passages)</p>
              <p className="text-xs text-sand-dark flex items-center gap-1"><Flame size={10} /> {carsStreak} day streak</p>
            </div>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-cream-darker">
          <p className="text-sm font-medium text-brown mb-2">UWorld today</p>
          <div className="flex gap-2 items-center">
            <input type="number" min={0} step={0.5} placeholder="Passages" value={uworldForm.passages}
              onChange={e => setUworldForm({ ...uworldForm, passages: e.target.value })} className="w-24" />
            <input type="number" min={0} max={100} placeholder="% correct" value={uworldForm.percent}
              onChange={e => setUworldForm({ ...uworldForm, percent: e.target.value })} className="w-24" />
            <button onClick={saveUworld} disabled={!uworldForm.passages}
              className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-40" style={{ background: "var(--grad)", color: "#fff" }}>
              Log
            </button>
          </div>
          {todayLog?.uworldPassages !== undefined && (
            <p className="text-xs text-sand-dark mt-1.5">Logged today: {todayLog.uworldPassages} passages{todayLog.uworldPercent !== undefined ? ` at ${todayLog.uworldPercent}%` : ""}</p>
          )}
          <p className="text-xs text-sand-dark mt-1.5">{uworldPassagesTotal} passages logged total{uworldAvgPercent !== null ? ` · ${uworldAvgPercent}% avg correct` : ""}</p>
        </div>
      </Card>

      {/* AAMC FL trend */}
      <Card title="AAMC Full-Length Trend" subtitle="The single metric that tells the truth — target 518+ before test day">
        {aamcFlScores.length === 0 ? (
          <p className="text-sm text-sand-dark">No AAMC full-lengths logged yet. Save your AAMC FLs and Sample test with source &ldquo;AAMC FL&rdquo; when logging a practice test, and they will show up here against the 518 target line.</p>
        ) : (
          <>
            <div className="h-52 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aamcFlScores.map(t => ({ date: format(new Date(t.date), "M/d"), score: t.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#A8967E" }} />
                  <YAxis domain={[472, 528]} tick={{ fontSize: 11, fill: "#A8967E" }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.1)", borderRadius: "8px", fontSize: "12px" }} />
                  <ReferenceLine y={518} stroke="#DA667B" strokeDasharray="4 2" label={{ value: "518 target", fontSize: 11, fill: "#DA667B" }} />
                  <Line type="monotone" dataKey="score" stroke="#7C5CFC" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {aamcFlTrend !== null && (
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: aamcFlTrend >= 518 ? "#10B981" : "#DA667B" }}>
                <Target size={12} />
                <span>Last {Math.min(3, aamcFlScores.length)}-test average: {aamcFlTrend} — {aamcFlTrend >= 518 ? "on track for the target" : "below the 518 target, recalibrate or push the date"}</span>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
