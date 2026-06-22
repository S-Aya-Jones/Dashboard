"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { format, differenceInDays, parseISO, startOfDay, subDays } from "date-fns";
import { Plus, Trash2, Check, Brain, Clock, Dumbbell, Stethoscope, Calendar, Sun, Moon } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Button } from "@/components/ui/Button";
import { today as todayStr, greetingByTime, id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";
import { DarkWeatherCard } from "./DarkWeatherCard";
import { UVArcCard } from "./UVArcCard";
import { NextHoursStrip, HourlyUVChart } from "./HourlyUVStrip";
import { TYPE_META, TYPE_ICON, defaultBlocks, blocksForDate, formatRange12 } from "@/lib/schedule";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function TodayView({ data, update }: Props) {
  const t = todayStr();
  const [newTask, setNewTask] = useState("");
  const [calEvents, setCalEvents] = useState<{ title: string; start?: string; allDay: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/google/calendar?days=1")
      .then(r => r.json())
      .then(d => setCalEvents(d.events ?? []))
      .catch(() => {});
  }, []);

  const todayTasks = data.tasks.filter((task) => task.date === t);

  const todayBlocks = blocksForDate(data.scheduleBlocks ?? defaultBlocks(), new Date());
  const timelineRows: { sortKey: number; kind: "block" | "event"; label: string; time: string; color: string; type?: import("@/types/dashboard").ScheduleBlock["type"] }[] = [
    ...todayBlocks.map(b => ({ sortKey: parseInt(b.startTime.replace(":", "")), kind: "block" as const, label: b.label, time: formatRange12(b.startTime, b.endTime), color: TYPE_META[b.type].color, type: b.type })),
    ...calEvents.map(e => ({
      sortKey: e.allDay || !e.start ? -1 : new Date(e.start).getHours() * 100 + new Date(e.start).getMinutes(),
      kind: "event" as const, label: e.title,
      time: e.allDay || !e.start ? "All day" : format(new Date(e.start), "h:mm a"),
      color: "#7C5CFC",
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  const addTask = () => {
    if (!newTask.trim()) return;
    update((d) => ({
      ...d,
      tasks: [...d.tasks, { id: id(), text: newTask.trim(), done: false, date: t, createdAt: new Date().toISOString() }],
    }));
    setNewTask("");
  };

  const toggleTask = async (taskId: string) => {
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task?.done) await celebrate();
    update((d) => ({
      ...d,
      tasks: d.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
  };

  const handleTaskKey = (e: KeyboardEvent) => { if (e.key === "Enter") addTask(); };

  // Figure out "now", "next up" and progress through the day's timeline
  const nowMinutes = new Date().getHours() * 100 + new Date().getMinutes();
  const minutesOf = (sortKey: number) => sortKey; // already HHMM-ish for blocks; events use H*100+M too
  let nowIdx = -1;
  for (let i = 0; i < timelineRows.length; i++) {
    if (minutesOf(timelineRows[i].sortKey) <= nowMinutes) nowIdx = i;
  }
  const nowRow = nowIdx >= 0 ? timelineRows[nowIdx] : null;
  const nextRow = timelineRows[nowIdx + 1] ?? null;
  const dayEnd = 22 * 100; // 10pm reference for "daylight/day left"
  const minutesLeftInDay = Math.max(0, dayEnd - nowMinutes);
  const hoursLeftInDay = Math.floor(minutesLeftInDay / 100);

  const remaining = timelineRows.length - (nowIdx + 1);
  const narrative = nowRow
    ? `${remaining > 0 ? `${remaining} thing${remaining === 1 ? "" : "s"} left today` : "Nothing else on the books today"} — right now it's ${nowRow.label.toLowerCase()}${nextRow ? `, then ${nextRow.label.toLowerCase()}` : ""}.`
    : "Nothing scheduled yet — add blocks on the Week page to fill in your day.";

  return (
    <div className="aya-dark space-y-6 animate-fade-in -mx-1">
      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start px-1">
        <div>
          <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>
            {format(new Date(), "EEEE · MMMM d · yyyy").toUpperCase()}
          </p>
          <h1 className="aya-serif text-4xl md:text-5xl mt-1 leading-tight">
            <span style={{ color: "var(--aya-text)" }}>{greetingByTime()},</span>{" "}
            <span style={{ color: "var(--aya-magenta)" }}>Aya</span>
          </h1>
          <p className="text-sm mt-2 max-w-md" style={{ color: "var(--aya-text-muted)" }}>{narrative}</p>
        </div>
        <DarkWeatherCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 px-1">
        <UVArcCard />

        <div className="grid grid-cols-1 gap-3">
          <div className="glass glass-glow p-4">
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>RIGHT NOW</p>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${nowRow ? nowRow.color : "#F2C879"}22` }}>
                <Sun size={16} style={{ color: nowRow ? nowRow.color : "var(--aya-gold)" }} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold truncate" style={{ color: nowRow ? nowRow.color : "var(--aya-text)" }}>{nowRow ? nowRow.label : "Free time"}</p>
                {nowRow && <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>{nowRow.time}</p>}
              </div>
            </div>
          </div>
          <div className="glass p-4">
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>NEXT UP</p>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${nextRow ? nextRow.color : "#94A3B8"}22` }}>
                <Calendar size={16} style={{ color: nextRow ? nextRow.color : "var(--aya-text-faint)" }} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold truncate" style={{ color: nextRow ? nextRow.color : "var(--aya-text)" }}>{nextRow ? nextRow.label : "Nothing scheduled"}</p>
                {nextRow && <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>{nextRow.time}</p>}
              </div>
            </div>
          </div>
          <div className="glass p-4">
            <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>DAYLIGHT LEFT</p>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(91,201,217,0.18)" }}>
                <Moon size={16} style={{ color: "var(--aya-cyan)" }} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: "var(--aya-text)" }}>{hoursLeftInDay > 0 ? `~${hoursLeftInDay}h` : "Wrapping up"}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>until 10pm wind-down</p>
              </div>
            </div>
          </div>
          <NextHoursStrip />
        </div>
      </div>

      {/* Today's Timeline */}
      <div className="glass p-5 mx-1">
        <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>TODAY&apos;S SCHEDULE</p>
        <h3 className="aya-serif text-xl mt-1" style={{ color: "var(--aya-text)" }}>Your norms + calendar, merged</h3>

        {timelineRows.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--aya-text-muted)" }}>No schedule set — add blocks on the Week page</p>
        ) : (
          <div className="relative mt-3 ml-2">
            <div className="aya-line" />
            {timelineRows.map((row, i) => {
              const Icon = row.kind === "event" ? Calendar : TYPE_ICON[row.type!];
              const state = i < nowIdx ? "done" : i === nowIdx ? "now" : "upcoming";
              return (
                <div key={i}>
                  {i === nowIdx && (
                    <div className="relative flex items-center gap-3 py-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 z-10 ml-[6.5px]" style={{ background: "var(--aya-gold)" }} />
                      <span className="pill" style={{ background: "rgba(232,85,154,0.18)", color: "var(--aya-magenta)" }}>
                        Now · {format(new Date(), "h:mm a")}
                      </span>
                    </div>
                  )}
                  <div className="relative flex items-center gap-3 py-2">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all"
                      style={{
                        background: state === "done" ? "var(--aya-green)" : state === "upcoming" ? "var(--aya-glass-bg)" : `${row.color}26`,
                        border: state === "now" ? `2px solid ${row.color}` : `1.5px solid ${state === "done" ? "var(--aya-green)" : "var(--aya-border)"}`,
                      }}
                    >
                      {state === "done" ? (
                        <Check size={14} color="#170B2E" />
                      ) : (
                        <Icon size={15} style={{ color: state === "upcoming" ? "var(--aya-text-faint)" : row.color }} />
                      )}
                    </div>
                    <div
                      className="flex items-center gap-3 flex-1 px-3 py-2 rounded-xl transition-shadow"
                      style={{ background: state === "now" ? `${row.color}1a` : "transparent", opacity: state === "done" ? 0.45 : 1 }}
                    >
                      <span className="font-medium flex-1 text-sm truncate" style={{ color: state === "upcoming" ? "var(--aya-text)" : row.color }}>{row.label}</span>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--aya-text-faint)" }}>{row.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="glass p-5 mx-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="aya-serif text-xl" style={{ color: "var(--aya-text)" }}>Today&apos;s Tasks</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={handleTaskKey}
              className="w-44"
              style={{ background: "var(--aya-glass-bg)", borderColor: "var(--aya-border)", color: "var(--aya-text)" }}
            />
            <Button size="sm" onClick={addTask}><Plus size={14} /></Button>
          </div>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--aya-text-muted)" }}>No tasks yet — add one above</p>
        ) : (
          <ul className="space-y-2 mt-3">
            {todayTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 group">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: task.done ? "var(--aya-green)" : "transparent",
                    borderColor: task.done ? "var(--aya-green)" : "var(--aya-border)",
                    color: "#1A0F2E",
                  }}
                >
                  {task.done && <Check size={11} />}
                </button>
                <span className="flex-1 text-sm" style={{ color: task.done ? "var(--aya-text-faint)" : "var(--aya-text)", textDecoration: task.done ? "line-through" : "none" }}>
                  {task.text}
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: "var(--aya-coral)" }}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-xs" style={{ color: "var(--aya-text-faint)" }}>
          {todayTasks.filter((t) => t.done).length}/{todayTasks.length} done
        </div>
      </div>

      <SmartInsights data={data} />

      <HourlyUVChart />
    </div>
  );
}

// ── Smart Insights ────────────────────────────────────────────────────────────
function InsightTrendPill({ good, label }: { good: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: good ? "rgba(91,217,160,0.15)" : "rgba(242,200,121,0.15)", color: good ? "var(--aya-green)" : "var(--aya-gold)" }}>
      {good ? "↗" : "↗"} {label}
    </span>
  );
}

function SmartInsights({ data }: { data: DashboardData }) {
  const widgets: { key: string; node: React.ReactNode }[] = [];

  // 1. Shadowing countdown
  const shadowingHours = (data.shadowingSessions ?? []).reduce((s, sess) => s + sess.hours, 0);
  const shadowingTarget = 200;
  const shadowingPct = Math.min(100, Math.round((shadowingHours / shadowingTarget) * 100));
  const shadowingLeft = Math.max(0, shadowingTarget - shadowingHours);
  if (data.shadowingSessions?.length > 0 || shadowingHours > 0) {
    widgets.push({
      key: "shadowing",
      node: (
        <div className="glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,108,242,0.2)" }}>
              <Stethoscope size={14} style={{ color: "var(--aya-violet)" }} />
            </span>
            <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>SHADOWING</span>
          </div>
          <p className="aya-serif text-xl mt-1" style={{ color: "var(--aya-text)" }}>{shadowingHours.toFixed(1)} hrs logged</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>
            {shadowingLeft > 0 ? `${shadowingLeft.toFixed(1)} hrs to 200-hr goal` : "Goal reached! 🎉"}
          </p>
          <div className="h-1.5 rounded-full mt-2" style={{ background: "var(--aya-glass-bg)" }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${shadowingPct}%`, background: "var(--aya-violet)" }} />
          </div>
          <InsightTrendPill good={shadowingPct >= 50} label={`${shadowingPct}% of goal`} />
        </div>
      ),
    });
  }

  // 2. MCAT pace tracker
  if (data.mcatTestDate) {
    const daysLeft = differenceInDays(parseISO(data.mcatTestDate), startOfDay(new Date()));
    const totalStudyHours = (data.studySessions ?? []).reduce((s, sess) => {
      return s + sess.cars + sess.bioBiochem + sess.chemPhys + sess.psychSoc;
    }, 0);
    const latestTest = [...(data.practiceTests ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const targetScore = 511;
    const currentScore = latestTest?.total ?? null;
    const gap = currentScore ? Math.max(0, targetScore - currentScore) : null;
    const hoursPerPoint = 40;
    const hoursNeeded = gap ? gap * hoursPerPoint : null;
    const dailyGoal = daysLeft > 0 && hoursNeeded ? Math.ceil((hoursNeeded - totalStudyHours) / daysLeft * 10) / 10 : null;

    widgets.push({
      key: "mcat",
      node: (
        <div className="glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,108,242,0.2)" }}>
              <Brain size={14} style={{ color: "var(--aya-violet)" }} />
            </span>
            <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>MCAT PACE</span>
          </div>
          <p className="aya-serif text-xl mt-1" style={{ color: "var(--aya-text)" }}>{daysLeft > 0 ? `${daysLeft}d to go` : "Test day!"}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>
            until {format(parseISO(data.mcatTestDate), "MMM d, yyyy")}
          </p>
          {currentScore && <p className="text-xs mt-1" style={{ color: "var(--aya-violet)" }}>Last score: {currentScore} · Target: {targetScore}</p>}
          {dailyGoal && dailyGoal > 0 ? (
            <InsightTrendPill good={false} label={`${dailyGoal} hrs/day to hit ${targetScore}`} />
          ) : daysLeft > 0 ? (
            <InsightTrendPill good={true} label={`${totalStudyHours}h logged total`} />
          ) : null}
        </div>
      ),
    });
  }

  // 3. Mood pattern from last 14 check-ins
  const checkIns = [...(data.anxietyCheckIns ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  if (checkIns.length >= 5) {
    const avg = checkIns.reduce((s, c) => s + c.level, 0) / checkIns.length;
    const recent3 = checkIns.slice(0, 3).reduce((s, c) => s + c.level, 0) / 3;
    const older3  = checkIns.slice(-3).reduce((s, c) => s + c.level, 0) / 3;
    const trend = recent3 < older3 - 0.5 ? "improving" : recent3 > older3 + 0.5 ? "rising" : "steady";
    const trendEmoji = trend === "improving" ? "📉" : trend === "rising" ? "📈" : "〰️";
    const trendGood = trend !== "rising";
    widgets.push({
      key: "mood",
      node: (
        <div className="glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,108,242,0.2)" }}>
              <Brain size={14} style={{ color: "var(--aya-violet)" }} />
            </span>
            <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>MOOD PATTERN</span>
          </div>
          <p className="aya-serif text-xl mt-1" style={{ color: "var(--aya-text)" }}>{avg.toFixed(1)}<span className="text-xs font-normal ml-1" style={{ color: "var(--aya-text-muted)" }}>/10 avg</span></p>
          <p className="text-xs mt-0.5" style={{ color: "var(--aya-text-muted)" }}>{trendEmoji} Anxiety {trend} over last {checkIns.length} days</p>
          <div className="mt-2 flex gap-0.5 items-end" style={{ height: 28 }}>
            {checkIns.slice(0, 7).reverse().map((c, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{
                height: `${Math.max(4, c.level * 2.8)}px`,
                background: c.level <= 3 ? "var(--aya-green)" : c.level <= 6 ? "var(--aya-gold)" : "var(--aya-coral)",
                opacity: 0.85,
              }} />
            ))}
          </div>
          <InsightTrendPill good={trendGood} label="7-day trend" />
        </div>
      ),
    });
  }

  // 4. Rest day suggestion (3+ consecutive workout days)
  const workoutLogs = (data.workout?.sessionLogs ?? []);
  if (workoutLogs.length >= 3) {
    const uniqueDates = workoutLogs.map(l => l.date).filter((d, i, a) => a.indexOf(d) === i);
    const sortedDates = uniqueDates.sort().reverse();
    let streak = 0;
    let checkDate = startOfDay(new Date());
    for (const d of sortedDates) {
      const logDate = startOfDay(parseISO(d));
      const diff = differenceInDays(checkDate, logDate);
      if (diff <= 1) { streak++; checkDate = logDate; }
      else break;
    }
    if (streak >= 3) {
      widgets.push({
        key: "rest",
        node: (
          <div className="glass p-4" style={{ boxShadow: "inset 3px 0 0 var(--aya-gold)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(242,200,121,0.2)" }}>
                <Dumbbell size={14} style={{ color: "var(--aya-gold)" }} />
              </span>
              <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>REST DAY CHECK</span>
            </div>
            <p className="aya-serif text-xl mt-1" style={{ color: "var(--aya-gold)" }}>{streak} days straight</p>
            <p className="text-xs mt-2" style={{ color: "var(--aya-text-muted)" }}>
              You&apos;ve trained {streak} days in a row — a rest day today could actually help your gains.
            </p>
            <InsightTrendPill good={false} label="Consider a rest day" />
          </div>
        ),
      });
    }
  }

  // 5. Next self-care appointment
  const selfCare = (data.selfCareItems ?? []).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  if (selfCare.length > 0) {
    const now = new Date();
    const upcoming = selfCare
      .map(item => {
        const last = item.lastDone ? parseISO(item.lastDone) : subDays(now, item.frequencyWeeks * 7 + 1);
        const next = new Date(last);
        next.setDate(next.getDate() + item.frequencyWeeks * 7);
        return { item, next, daysLeft: differenceInDays(next, startOfDay(now)) };
      })
      .filter(x => x.daysLeft <= 14)
      .sort((a, b) => a.daysLeft - b.daysLeft)[0];
    if (upcoming) {
      widgets.push({
        key: "selfcare",
        node: (
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,108,242,0.2)" }}>
                <Clock size={14} style={{ color: "var(--aya-violet)" }} />
              </span>
              <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>COMING UP</span>
            </div>
            <p className="text-2xl mt-1">{upcoming.item.emoji}</p>
            <p className="aya-serif text-lg mt-1" style={{ color: "var(--aya-text)" }}>{upcoming.item.name}</p>
            <p className="text-xs mt-0.5" style={{ color: upcoming.daysLeft <= 3 ? "var(--aya-coral)" : "var(--aya-text-muted)" }}>
              {upcoming.daysLeft <= 0 ? "Due now!" : upcoming.daysLeft === 1 ? "Tomorrow" : `In ${upcoming.daysLeft} days`}
            </p>
            <p className="text-xs" style={{ color: "var(--aya-text-faint)" }}>${upcoming.item.cost} · {upcoming.item.frequencyLabel ?? `every ${upcoming.item.frequencyWeeks} wks`}</p>
          </div>
        ),
      });
    }
  }

  if (widgets.length === 0) return null;

  return (
    <div className="px-1">
      <p className="text-xs font-semibold mb-3 tracking-wider" style={{ color: "var(--aya-text-faint)" }}>LAST 7 DAYS · PATTERNS WORTH NOTICING</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {widgets.map(w => (
          <div key={w.key}>{w.node}</div>
        ))}
      </div>
    </div>
  );
}
