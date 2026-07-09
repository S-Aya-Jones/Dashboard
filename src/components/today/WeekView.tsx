"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { format, addWeeks, subWeeks, startOfWeek, eachDayOfInterval, endOfWeek, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Calendar, X } from "lucide-react";
import { DashboardData, ScheduleBlock } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";
import { TYPE_META, TYPE_ICON, defaultBlocks, toMinutes, blocksForDate, formatRange12 } from "@/lib/schedule";
import { McatPaceCard } from "@/components/today/McatPaceCard";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

interface CalEvent { id?: string; title: string; start?: string; end?: string; allDay: boolean; location?: string | null }

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

export function WeekView({ data, update }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calConnected, setCalConnected] = useState<boolean | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ label: "", startTime: "09:00", endTime: "10:00", type: "other" as ScheduleBlock["type"], days: [...WEEKDAYS] });

  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  const blocks = data.scheduleBlocks ?? defaultBlocks();

  useEffect(() => {
    fetch("/api/google/calendar?days=7")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setCalConnected(false); return; }
        setCalConnected(true);
        setCalEvents(d.events ?? []);
      })
      .catch(() => setCalConnected(false));
  }, []);

  const useDefaults = () => update(d => ({ ...d, scheduleBlocks: defaultBlocks() }));

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

  const addBlock = () => {
    if (!blockForm.label.trim()) return;
    const meta = TYPE_META[blockForm.type];
    update(d => ({
      ...d,
      scheduleBlocks: [...(d.scheduleBlocks ?? defaultBlocks()), {
        id: id(), label: blockForm.label, startTime: blockForm.startTime, endTime: blockForm.endTime,
        days: blockForm.days, type: blockForm.type, color: meta.color,
      }],
    }));
    setBlockForm({ label: "", startTime: "09:00", endTime: "10:00", type: "other", days: [...WEEKDAYS] });
    setShowAddBlock(false);
  };

  const deleteBlock = (blockId: string) => {
    update(d => ({ ...d, scheduleBlocks: (d.scheduleBlocks ?? defaultBlocks()).filter(b => b.id !== blockId) }));
  };

  const eventsForDay = (day: Date) => calEvents.filter(e => {
    if (!e.start) return false;
    const d = new Date(e.start);
    return format(d, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  });

  const blocksForDay = (day: Date) => blocksForDate(blocks, day);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-terracotta mb-1">Week of</p>
          <h1 className="font-serif text-4xl text-brown">
            {format(weekStart, "MMMM d")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "MMMM d, yyyy")}
          </h1>
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

      {/* MCAT pacing */}
      <McatPaceCard data={data} />

      {/* Ideal daily schedule timeline */}
      <Card title="Ideal Schedule" subtitle="Your norms + Google Calendar, day by day">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs text-sand-dark">
            {calConnected === false ? "Google Calendar not connected — schedule shown without calendar overlay" : calConnected === null ? "Loading calendar…" : `${calEvents.length} calendar event(s) this week`}
          </p>
          <div className="flex gap-2">
            {!data.scheduleBlocks && <Button variant="secondary" size="sm" onClick={useDefaults}>Use suggested template</Button>}
            <Button size="sm" onClick={() => setShowAddBlock(true)}><Plus size={13} className="inline mr-1" />Add block</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map(day => {
            const dayBlocks = blocksForDay(day);
            const dayEvents = eventsForDay(day);
            const today = isToday(day);
            // merge & sort by start time
            type Row = { kind: "block"; b: ScheduleBlock } | { kind: "event"; e: CalEvent };
            const rows: { sortKey: number; row: Row }[] = [
              ...dayBlocks.map(b => ({ sortKey: toMinutes(b.startTime), row: { kind: "block" as const, b } })),
              ...dayEvents.map(e => ({ sortKey: e.allDay ? -1 : new Date(e.start!).getHours() * 60 + new Date(e.start!).getMinutes(), row: { kind: "event" as const, e } })),
            ].sort((a, b) => a.sortKey - b.sortKey);

            return (
              <div key={format(day, "yyyy-MM-dd")} className={`rounded-2xl p-3 transition-shadow ${today ? "ring-2 ring-terracotta/40 bg-white shadow-sm" : "bg-cream-dark"}`}>
                <p className={`text-xs font-semibold mb-2.5 pb-2 border-b ${today ? "text-terracotta border-terracotta/20" : "text-brown border-cream-darker"}`}>
                  {format(day, "EEE M/d")}
                </p>
                <div className="space-y-1.5">
                  {rows.length === 0 && <p className="text-[11px] text-sand-dark italic">Nothing scheduled</p>}
                  {rows.map(({ row }, i) => {
                    if (row.kind === "block") {
                      const meta = TYPE_META[row.b.type];
                      const Icon = TYPE_ICON[row.b.type];
                      return (
                        <div key={`b-${i}`} className="group flex items-start gap-2 text-[11px] px-2 py-1.5 rounded-lg border-l-[3px]" style={{ background: `${meta.color}12`, borderColor: meta.color }}>
                          <Icon size={11} className="mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" style={{ color: meta.color }}>{row.b.label}</p>
                            <p className="text-sand-dark">{formatRange12(row.b.startTime, row.b.endTime)}</p>
                          </div>
                          <button onClick={() => deleteBlock(row.b.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={`e-${i}`} className="flex items-start gap-2 text-[11px] px-2 py-1.5 rounded-lg border-l-[3px]" style={{ background: "rgba(124,92,252,0.08)", borderColor: "#7C5CFC" }}>
                        <Calendar size={11} className="mt-0.5 flex-shrink-0" style={{ color: "#7C5CFC" }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" style={{ color: "#7C5CFC" }}>{row.e.title}</p>
                          {!row.e.allDay && row.e.start && <p className="text-sand-dark">{format(new Date(row.e.start), "h:mm a")}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Add block modal (inline) */}
      {showAddBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowAddBlock(false)}>
          <div className="rounded-2xl p-5 w-full max-w-sm bg-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-brown">Add Schedule Block</p>
              <button onClick={() => setShowAddBlock(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Label (e.g. MCAT study)" value={blockForm.label}
                onChange={e => setBlockForm({ ...blockForm, label: e.target.value })}
                className="w-full text-sm px-3 py-2 rounded-lg border" />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={blockForm.startTime} onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })} className="text-sm px-2 py-2 rounded-lg border" />
                <input type="time" value={blockForm.endTime} onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })} className="text-sm px-2 py-2 rounded-lg border" />
              </div>
              <select value={blockForm.type} onChange={e => setBlockForm({ ...blockForm, type: e.target.value as ScheduleBlock["type"] })} className="w-full text-sm px-3 py-2 rounded-lg border">
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div className="flex gap-1.5 flex-wrap">
                {["S","M","T","W","T","F","S"].map((label, i) => (
                  <button key={i} type="button"
                    onClick={() => setBlockForm(f => ({ ...f, days: f.days.includes(i) ? f.days.filter(d => d !== i) : [...f.days, i] }))}
                    className="w-8 h-8 rounded-full text-xs font-semibold"
                    style={blockForm.days.includes(i) ? { background: "#7C5CFC", color: "#fff" } : { background: "#eee", color: "#888" }}>
                    {label}
                  </button>
                ))}
              </div>
              <Button onClick={addBlock} className="w-full">Add Block</Button>
            </div>
          </div>
        </div>
      )}

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
                {today && <span className="ml-1 text-xs bg-terracotta px-1.5 py-0.5 rounded-full">Today</span>}
              </p>

              <ul className="space-y-1.5 mb-2">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleTask(task.id, task.done)}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${task.done ? "bg-sage border-sage" : "border-sand hover:border-terracotta"}`}
                    >
                      {task.done && <Check size={9} />}
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
