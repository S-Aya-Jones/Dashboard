"use client";

import { useState, KeyboardEvent } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Flame, Check } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnxietySlider } from "@/components/ui/Slider";
import { today as todayStr, greetingByTime, id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";
import { WeatherWidget } from "./WeatherWidget";
import { HourlyWeatherCard } from "./HourlyWeatherCard";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function TodayView({ data, update }: Props) {
  const t = todayStr();
  const [newTask, setNewTask] = useState("");
  const [exposureNote, setExposureNote] = useState("");
  const [anxietyLevel, setAnxietyLevel] = useState(5);
  const [anxietyNote, setAnxietyNote] = useState("");
  const [winText, setWinText] = useState("");

  const todayCheckIn = data.anxietyCheckIns.find((c) => c.date === t);
  const todayTasks = data.tasks.filter((task) => task.date === t);
  const todayHabits = data.habits;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = format(yesterday, "yyyy-MM-dd");
  const yesterdayWin = data.wins.find((w) => w.date === yStr);

  const saveCheckIn = () => {
    update((d) => ({
      ...d,
      anxietyCheckIns: [
        ...d.anxietyCheckIns.filter((c) => c.date !== t),
        { date: t, level: anxietyLevel, note: anxietyNote },
      ],
    }));
  };

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

  const toggleHabit = (habitId: string) => {
    const existing = data.habitLogs.find((l) => l.habitId === habitId && l.date === t);
    if (existing) {
      update((d) => ({ ...d, habitLogs: d.habitLogs.map((l) => l.habitId === habitId && l.date === t ? { ...l, done: !l.done } : l) }));
    } else {
      update((d) => ({ ...d, habitLogs: [...d.habitLogs, { habitId, date: t, done: true }] }));
    }
  };

  const addWin = () => {
    if (!winText.trim()) return;
    update((d) => ({ ...d, wins: [...d.wins, { id: id(), date: t, text: winText.trim() }] }));
    setWinText("");
    celebrate();
  };

  const addExposure = () => {
    if (!exposureNote.trim()) return;
    update((d) => ({ ...d, exposureLog: [...d.exposureLog, { id: id(), date: t, description: exposureNote.trim(), anxietyBefore: 5, peakAnxiety: 5, anxietyAfter: 5, durationMinutes: 0, type: "general" }] }));
    setExposureNote("");
  };

  const handleTaskKey = (e: KeyboardEvent) => { if (e.key === "Enter") addTask(); };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-brown">
            {greetingByTime()}, Aya 🌿
          </h1>
          <p className="text-sand-dark text-lg mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <WeatherWidget />
      </div>

      <HourlyWeatherCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Anxiety check-in */}
        <Card title="How are you feeling?" subtitle="Your anxiety check-in for today">
          {todayCheckIn ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-sage">
                <Check size={15} />
                <span>Checked in — level {todayCheckIn.level}</span>
              </div>
              {todayCheckIn.note && <p className="text-sm text-brown italic">&ldquo;{todayCheckIn.note}&rdquo;</p>}
              <button onClick={() => update((d) => ({ ...d, anxietyCheckIns: d.anxietyCheckIns.filter((c) => c.date !== t) }))} className="text-xs text-sand-dark hover:text-terracotta transition-colors">
                Update check-in
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <AnxietySlider value={anxietyLevel} onChange={setAnxietyLevel} />
              <input
                type="text"
                placeholder="Any thoughts? (optional)"
                value={anxietyNote}
                onChange={(e) => setAnxietyNote(e.target.value)}
              />
              <Button onClick={saveCheckIn} size="sm">Save Check-in</Button>
            </div>
          )}
        </Card>

        {/* Yesterday's win reminder */}
        <Card title="Yesterday's Win 🌟" subtitle="A reminder of something good">
          {yesterdayWin ? (
            <p className="text-brown italic text-sm leading-relaxed">&ldquo;{yesterdayWin.text}&rdquo;</p>
          ) : (
            <p className="text-sand-dark text-sm">No win logged for yesterday. Add one for today below!</p>
          )}
          <div className="mt-4 space-y-2">
            <input
              type="text"
              placeholder="Today's win (big or small)…"
              value={winText}
              onChange={(e) => setWinText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addWin(); }}
            />
            <Button onClick={addWin} size="sm" variant="secondary">
              Add to Wins Jar ✨
            </Button>
          </div>
        </Card>
      </div>

      {/* Tasks */}
      <Card title="Today's Tasks" action={
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a task…"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={handleTaskKey}
            className="w-44"
          />
          <Button size="sm" onClick={addTask}><Plus size={14} /></Button>
        </div>
      }>
        {todayTasks.length === 0 ? (
          <p className="text-sand-dark text-sm">No tasks yet — add one above ☁️</p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 group">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${task.done
                      ? "bg-sage border-sage text-white checkbox-checked"
                      : "border-sand hover:border-terracotta"}
                  `}
                >
                  {task.done && <Check size={11} />}
                </button>
                <span className={`flex-1 text-sm ${task.done ? "line-through text-sand-dark" : "text-brown"}`}>
                  {task.text}
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-xs text-sand-dark">
          {todayTasks.filter((t) => t.done).length}/{todayTasks.length} done
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today's Habits */}
        <Card title="Today's Habits">
          <div className="space-y-2">
            {todayHabits.map((habit) => {
              const log = data.habitLogs.find((l) => l.habitId === habit.id && l.date === t);
              const done = log?.done ?? false;
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  className={`
                    w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left
                    ${done
                      ? "border-transparent bg-opacity-10"
                      : "border-sand-light hover:border-sand"}
                  `}
                  style={done ? { background: `${habit.color}15`, borderColor: `${habit.color}40` } : {}}
                >
                  <span className="text-lg">{habit.icon}</span>
                  <span className={`text-sm flex-1 ${done ? "line-through" : ""}`} style={done ? { color: habit.color } : { color: "#785b4e" }}>
                    {habit.name}
                  </span>
                  {done && <Check size={14} style={{ color: habit.color }} />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Exposure prompt */}
        <Card
          title="Today's Brave Thing 🌱"
          subtitle="Exposure therapy — one step at a time"
        >
          {data.exposureLog.filter((e) => e.date === t).length > 0 ? (
            <div className="space-y-2">
              {data.exposureLog.filter((e) => e.date === t).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <Flame size={14} className="text-terracotta" />
                  <span className="text-brown">{e.description}</span>
                </div>
              ))}
              <p className="text-xs text-sage mt-2">You showed up today. That matters. 💛</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-sand-dark leading-relaxed">
                What&apos;s one brave thing you did or will do today? It doesn&apos;t have to be big.
              </p>
              <input
                type="text"
                placeholder="e.g. Made a phone call I'd been avoiding…"
                value={exposureNote}
                onChange={(e) => setExposureNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExposure(); }}
              />
              <Button onClick={addExposure} size="sm" variant="secondary">Log It 🌱</Button>
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-cream-darker">
            <p className="text-xs text-sand-dark">
              For detailed exposure logs with anxiety ratings, visit{" "}
              <a href="/exposure" className="text-terracotta hover:underline">Exposure Therapy</a>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
