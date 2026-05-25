"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Moon } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const SESSION_TYPES = [
  { value: "gym", label: "Gym 🏋🏾‍♀️", color: "#71816D" },
  { value: "tennis", label: "Tennis 🎾", color: "#DA667B" },
  { value: "walk", label: "Morning Walk 🚶🏾‍♀️", color: "#8A9E87" },
  { value: "other", label: "Other", color: "#C9B79C" },
];

export function FitnessView({ data, update }: Props) {
  const [fitnessOpen, setFitnessOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [fitnessForm, setFitnessForm] = useState({ type: "gym" as const, durationMinutes: 45, notes: "" });
  const [sleepForm, setSleepForm] = useState({ bedtime: "22:00", wakeTime: "06:00", quality: 4, notes: "" });
  const [dateVal, setDateVal] = useState(todayStr());

  const tennisCount = data.fitnessSessions.filter((s) => s.type === "tennis").length;
  const gymCount = data.fitnessSessions.filter((s) => s.type === "gym").length;
  const walkCount = data.fitnessSessions.filter((s) => s.type === "walk").length;

  const avgSleepQuality = data.sleepLogs.length
    ? Math.round(data.sleepLogs.reduce((s, l) => s + l.quality, 0) / data.sleepLogs.length * 10) / 10
    : null;

  const addFitness = () => {
    update((d) => ({ ...d, fitnessSessions: [...d.fitnessSessions, { ...fitnessForm, id: id(), date: dateVal }] }));
    setFitnessForm({ type: "gym", durationMinutes: 45, notes: "" });
    setFitnessOpen(false);
  };

  const addSleep = () => {
    update((d) => ({
      ...d, sleepLogs: [
        ...d.sleepLogs.filter((s) => s.date !== dateVal),
        { ...sleepForm, date: dateVal }
      ]
    }));
    setSleepForm({ bedtime: "22:00", wakeTime: "06:00", quality: 4, notes: "" });
    setSleepOpen(false);
  };

  const deleteFitness = (sid: string) => {
    update((d) => ({ ...d, fitnessSessions: d.fitnessSessions.filter((s) => s.id !== sid) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Fitness & Sleep</h1>
          <p className="text-sand-dark mt-1">Movement that brings you joy, rest that restores you 🎾</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSleepOpen(true)}>
            <Moon size={14} className="mr-1.5 inline" /> Log Sleep
          </Button>
          <Button onClick={() => setFitnessOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Log Session
          </Button>
        </div>
      </div>

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
            {[...data.fitnessSessions].reverse().slice(0, 20).map((s) => {
              const type = SESSION_TYPES.find((t) => t.value === s.type);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: type?.color }} />
                  <div className="flex-1">
                    <p className="text-sm text-brown">{type?.label}</p>
                    <p className="text-xs text-sand-dark">{format(parseISO(s.date), "MMM d")} · {s.durationMinutes}min</p>
                    {s.notes && <p className="text-xs text-brown italic">{s.notes}</p>}
                  </div>
                  <button onClick={() => deleteFitness(s.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose">
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
            {[...data.sleepLogs].reverse().slice(0, 14).map((s) => (
              <div key={s.date} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark">
                <Moon size={14} className="text-brown opacity-40 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-sand-dark">{format(parseISO(s.date), "EEEE, MMM d")}</p>
                  <p className="text-sm text-brown">{s.bedtime} → {s.wakeTime}</p>
                  {s.notes && <p className="text-xs text-brown italic">{s.notes}</p>}
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < s.quality ? "#71816D" : "#DAC9A8" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
                <button key={t.value} onClick={() => setFitnessForm({ ...fitnessForm, type: t.value as typeof fitnessForm.type })}
                  className={`p-2.5 rounded-xl text-sm border transition-all text-left ${fitnessForm.type === t.value ? "border-terracotta bg-terracotta text-white" : "border-sand hover:border-sand-dark text-brown"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Duration (minutes)</label>
            <input type="number" min={5} value={fitnessForm.durationMinutes} onChange={(e) => setFitnessForm({ ...fitnessForm, durationMinutes: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="How'd it feel?" value={fitnessForm.notes} onChange={(e) => setFitnessForm({ ...fitnessForm, notes: e.target.value })} />
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
              <input type="time" value={sleepForm.bedtime} onChange={(e) => setSleepForm({ ...sleepForm, bedtime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Wake time</label>
              <input type="time" value={sleepForm.wakeTime} onChange={(e) => setSleepForm({ ...sleepForm, wakeTime: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-2">Sleep quality</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setSleepForm({ ...sleepForm, quality: n })}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${sleepForm.quality >= n ? "bg-terracotta text-white" : "bg-cream-darker text-sand-dark hover:bg-cream-dark"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="Vivid dreams? Restless?" value={sleepForm.notes} onChange={(e) => setSleepForm({ ...sleepForm, notes: e.target.value })} />
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
