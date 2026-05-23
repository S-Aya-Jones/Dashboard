"use client";

import { useState, KeyboardEvent } from "react";
import { format, addWeeks, subWeeks, startOfWeek, eachDayOfInterval, endOfWeek, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Check, Trash2 } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function WeekView({ data, update }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [newTask, setNewTask] = useState<Record<string, string>>({});

  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  const weekKey = format(weekStart, "yyyy-MM-dd");

  const intention = data.weeklyIntentions.find((w) => w.weekStart === weekKey);

  const setIntention = (val: string) => {
    update((d) => ({
      ...d,
      weeklyIntentions: [
        ...d.weeklyIntentions.filter((w) => w.weekStart !== weekKey),
        { weekStart: weekKey, intention: val, focus: intention?.focus ?? "" },
      ],
    }));
  };

  const setFocus = (val: string) => {
    update((d) => ({
      ...d,
      weeklyIntentions: [
        ...d.weeklyIntentions.filter((w) => w.weekStart !== weekKey),
        { weekStart: weekKey, intention: intention?.intention ?? "", focus: val },
      ],
    }));
  };

  const dayTasks = (dateStr: string) => data.tasks.filter((t) => t.date === dateStr);

  const addTask = (dateStr: string) => {
    const text = newTask[dateStr]?.trim();
    if (!text) return;
    update((d) => ({ ...d, tasks: [...d.tasks, { id: id(), text, done: false, date: dateStr, createdAt: new Date().toISOString() }] }));
    setNewTask((prev) => ({ ...prev, [dateStr]: "" }));
  };

  const toggleTask = async (taskId: string, currentDone: boolean) => {
    if (!currentDone) await celebrate();
    update((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === taskId ? { ...t, done: !t.done } : t) }));
  };

  const deleteTask = (taskId: string) => {
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
  };

  const isLogged = (habitId: string, dateStr: string) =>
    data.habitLogs.find((l) => l.habitId === habitId && l.date === dateStr)?.done ?? false;

  const toggleHabit = (habitId: string, dateStr: string) => {
    const existing = data.habitLogs.find((l) => l.habitId === habitId && l.date === dateStr);
    if (existing) {
      update((d) => ({ ...d, habitLogs: d.habitLogs.map((l) => l.habitId === habitId && l.date === dateStr ? { ...l, done: !l.done } : l) }));
    } else {
      update((d) => ({ ...d, habitLogs: [...d.habitLogs, { habitId, date: dateStr, done: true }] }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl text-brown">This Week</h1>
          <p className="text-sand-dark mt-1">
            {format(weekStart, "MMMM d")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft size={15} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>

      {/* Weekly intention */}
      <Card title="Weekly Intention & Focus">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="text-xs font-medium text-sand-dark block mb-1">This week&apos;s intention</label>
            <textarea
              rows={3}
              placeholder="What matters most this week? What do you want to feel?"
              value={intention?.intention ?? ""}
              onChange={(e) => setIntention(e.target.value)}
              className="font-serif text-base"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-sand-dark block mb-1">One focus word</label>
            <input
              type="text"
              placeholder="e.g. Steady, Present, Bold"
              value={intention?.focus ?? ""}
              onChange={(e) => setFocus(e.target.value)}
              className="font-serif text-xl"
            />
          </div>
        </div>
      </Card>

      {/* Habit grid for the week */}
      <Card title="This Week's Habits">
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pr-3 pb-2 text-sand-dark font-medium">Habit</th>
                {days.map((day) => {
                  const d = format(day, "yyyy-MM-dd");
                  const today = isToday(day);
                  return (
                    <th key={d} className={`pb-2 px-1 text-center font-medium ${today ? "text-terracotta" : "text-sand-dark"}`}>
                      {format(day, "EEE")}
                      <br />
                      <span className="text-[10px]">{format(day, "d")}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.habits.map((habit) => (
                <tr key={habit.id} className="border-t border-cream-darker">
                  <td className="pr-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{habit.icon}</span>
                      <span className="text-brown font-medium">{habit.name}</span>
                    </div>
                  </td>
                  {days.map((day) => {
                    const d = format(day, "yyyy-MM-dd");
                    const done = isLogged(habit.id, d);
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        <button
                          onClick={() => toggleHabit(habit.id, d)}
                          className={`w-6 h-6 rounded-full border transition-all mx-auto flex items-center justify-center ${done ? "border-transparent" : "border-sand hover:border-sand-dark"}`}
                          style={done ? { background: habit.color } : {}}
                        >
                          {done && <Check size={10} className="text-white" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tasks by day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {days.map((day) => {
          const d = format(day, "yyyy-MM-dd");
          const tasks = dayTasks(d);
          const today = isToday(day);
          return (
            <div key={d} className={`card p-4 ${today ? "ring-2 ring-terracotta/30" : ""}`}>
              <p className={`text-sm font-semibold mb-2 ${today ? "text-terracotta" : "text-brown"}`}>
                {format(day, "EEEE")}
                <span className="ml-1 font-normal text-sand-dark text-xs">{format(day, "M/d")}</span>
                {today && <span className="ml-1 text-xs bg-terracotta text-white px-1.5 py-0.5 rounded-full">Today</span>}
              </p>

              <ul className="space-y-1.5 mb-2">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleTask(task.id, task.done)}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${task.done ? "bg-sage border-sage" : "border-sand hover:border-terracotta"}`}
                    >
                      {task.done && <Check size={9} className="text-white" />}
                    </button>
                    <span className={`text-xs flex-1 ${task.done ? "line-through text-sand-dark" : "text-brown"}`}>{task.text}</span>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose">
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Add task…"
                  value={newTask[d] ?? ""}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, [d]: e.target.value }))}
                  onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") addTask(d); }}
                  className="text-xs flex-1"
                />
                <button onClick={() => addTask(d)} className="text-sand hover:text-terracotta transition-colors p-1">
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
