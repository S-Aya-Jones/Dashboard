"use client";

import { useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { Settings, Plus, Trash2, GripVertical, Check } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const ICON_OPTIONS = ["🙏", "📖", "🚶🏾‍♀️", "✨", "🌙", "📚", "💧", "📵", "🍎", "🏃🏾‍♀️", "🧘🏾‍♀️", "💊", "✍️", "🎾", "🌿", "🌸", "⭐", "🌅", "💤", "🫀"];
const COLOR_OPTIONS = ["#71816D", "#DA667B", "#7C5CFC", "#E879F9", "#8A9E87", "#5A6E58", "#A8967E", "#C99A5C"];

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }
  return days;
}

export function HabitsView({ data, update }: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newHabit, setNewHabit] = useState<{ name: string; icon: string; color: string; section: "daily" | "devotional"; weeklyGoal: number }>({ name: "", icon: "⭐", color: "#71816D", section: "daily", weeklyGoal: 5 });

  const days = getLast14Days();
  const today = todayStr();

  const isLogged = (habitId: string, date: string) =>
    data.habitLogs.find((l) => l.habitId === habitId && l.date === date)?.done ?? false;

  const toggle = (habitId: string, date: string) => {
    const existing = data.habitLogs.find((l) => l.habitId === habitId && l.date === date);
    if (existing) {
      update((d) => ({ ...d, habitLogs: d.habitLogs.map((l) => l.habitId === habitId && l.date === date ? { ...l, done: !l.done } : l) }));
    } else {
      update((d) => ({ ...d, habitLogs: [...d.habitLogs, { habitId, date, done: true }] }));
    }
  };

  const weekDays = days.slice(-7);
  const allLogs = data.habits.flatMap((h) => weekDays.map((d) => ({ done: isLogged(h.id, d) })));
  const completionPct = allLogs.length ? Math.round((allLogs.filter((l) => l.done).length / allLogs.length) * 100) : 0;

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    update((d) => ({
      ...d,
      habits: [...d.habits, { ...newHabit, id: id(), order: d.habits.length }],
    }));
    setNewHabit({ name: "", icon: "⭐", color: "#71816D", section: "daily", weeklyGoal: 5 });
  };

  const deleteHabit = (habitId: string) => {
    update((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== habitId) }));
  };

  const sections: Array<{ key: "daily" | "devotional"; label: string }> = [
    { key: "daily", label: "Daily Habits" },
    { key: "devotional", label: "Devotional" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl text-brown">Habit Tracker</h1>
          <p className="text-sand-dark mt-1">Small consistent steps</p>
        </div>
        <Button variant="secondary" onClick={() => setManageOpen(true)}>
          <Settings size={14} className="mr-1.5 inline" />
          Manage Habits
        </Button>
      </div>

      {/* Completion */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-brown">This week&apos;s completion</p>
          <span className="text-2xl font-serif text-terracotta">{completionPct}%</span>
        </div>
        <div className="h-2.5 bg-cream-darker rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%`, background: "linear-gradient(90deg, #71816D, #DA667B)" }}
          />
        </div>
        <p className="text-xs text-sand-dark mt-2">Based on your last 7 days</p>
      </Card>

      {/* Grid */}
      {sections.map(({ key, label }) => {
        const sectionHabits = data.habits.filter((h) => h.section === key).sort((a, b) => a.order - b.order);
        if (sectionHabits.length === 0) return null;
        return (
          <Card key={key} title={label}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left pr-3 pb-2 text-sand-dark font-medium w-32">Habit</th>
                    {days.map((d) => (
                      <th key={d} className={`pb-2 px-1 text-center font-medium w-8 ${d === today ? "text-terracotta" : "text-sand-dark"}`}>
                        {format(parseISO(d), "d")}
                        <br />
                        <span className="text-[10px]">{format(parseISO(d), "EEE")}</span>
                      </th>
                    ))}
                    <th className="pb-2 px-2 text-center text-sand-dark font-medium">Wk Goal</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionHabits.map((habit) => {
                    const weekDone = weekDays.filter((d) => isLogged(habit.id, d)).length;
                    return (
                      <tr key={habit.id} className="border-t border-cream-darker">
                        <td className="pr-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{habit.icon}</span>
                            <span className="text-brown font-medium truncate max-w-[90px]">{habit.name}</span>
                          </div>
                        </td>
                        {days.map((d) => {
                          const done = isLogged(habit.id, d);
                          const isTodayCol = d === today;
                          return (
                            <td key={d} className="px-1 py-2 text-center">
                              <button
                                onClick={() => toggle(habit.id, d)}
                                className={`
                                  w-6 h-6 rounded-full border transition-all mx-auto flex items-center justify-center
                                  ${done ? "border-transparent" : isTodayCol ? "border-sand-dark" : "border-sand hover:border-sand-dark"}
                                `}
                                style={done ? { background: habit.color } : {}}
                              >
                                {done && <Check size={10} />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center">
                          <span
                            className={`text-xs font-medium ${weekDone >= habit.weeklyGoal ? "text-sage" : "text-sand-dark"}`}
                          >
                            {weekDone}/{habit.weeklyGoal}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {/* Manage Modal */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage Habits" width="max-w-xl">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-brown">Add New Habit</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Habit name" value={newHabit.name} onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })} />
              <select value={newHabit.section} onChange={(e) => setNewHabit({ ...newHabit, section: e.target.value as "daily" | "devotional" })}>
                <option value="daily">Daily</option>
                <option value="devotional">Devotional</option>
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <p className="text-xs text-sand-dark mb-1">Icon</p>
                <div className="flex flex-wrap gap-1">
                  {ICON_OPTIONS.map((icon) => (
                    <button key={icon} onClick={() => setNewHabit({ ...newHabit, icon })}
                      className={`w-8 h-8 rounded-lg text-base transition-all ${newHabit.icon === icon ? "bg-cream-darker ring-2 ring-terracotta" : "hover:bg-cream-dark"}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-sand-dark mb-1">Color</p>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button key={color} onClick={() => setNewHabit({ ...newHabit, color })}
                    className={`w-7 h-7 rounded-full transition-all ${newHabit.color === color ? "ring-2 ring-offset-1 ring-brown" : ""}`}
                    style={{ background: color }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-sand-dark">Weekly goal:</label>
              <input type="number" min={1} max={7} value={newHabit.weeklyGoal} onChange={(e) => setNewHabit({ ...newHabit, weeklyGoal: Number(e.target.value) })} className="w-16" />
              <span className="text-xs text-sand-dark">/ 7 days</span>
            </div>
            <Button onClick={addHabit} size="sm">
              <Plus size={13} className="mr-1 inline" /> Add Habit
            </Button>
          </div>

          <div className="border-t border-cream-darker pt-4">
            <p className="text-sm font-medium text-brown mb-3">Current Habits</p>
            <div className="space-y-2">
              {data.habits.sort((a, b) => a.order - b.order).map((habit) => (
                <div key={habit.id} className="flex items-center gap-3 p-2 rounded-xl bg-cream-dark">
                  <GripVertical size={14} className="text-sand cursor-grab" />
                  <span className="text-base">{habit.icon}</span>
                  <span className="flex-1 text-sm text-brown">{habit.name}</span>
                  <span className="text-xs text-sand-dark">{habit.section}</span>
                  <button onClick={() => deleteHabit(habit.id)} className="text-sand hover:text-rose transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
