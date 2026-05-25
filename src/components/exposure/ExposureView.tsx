"use client";

import { useState } from "react";
import { format, parseISO, subWeeks, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Flame, Car, Plus, Trash2 } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AnxietySlider } from "@/components/ui/Slider";
import { today as todayStr, id } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const blankExposure = () => ({
  description: "", anxietyBefore: 5, peakAnxiety: 7, anxietyAfter: 4, durationMinutes: 15, notes: "", type: "general" as const,
});

const blankDrive = () => ({
  route: "", distanceMiles: 0, anxietyBefore: 6, anxietyAfter: 4, notes: "",
});

export function ExposureView({ data, update }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [form, setForm] = useState(blankExposure());
  const [driveForm, setDriveForm] = useState(blankDrive());

  const today = todayStr();

  // Streak: consecutive days with ≥1 exposure
  const sortedDates = Array.from(new Set(data.exposureLog.map((e) => e.date))).sort().reverse();
  let streak = 0;
  const checkDate = new Date();
  for (const date of sortedDates) {
    const check = format(checkDate, "yyyy-MM-dd");
    if (date === check) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (date < check) break;
  }

  // Weekly averages for chart
  const chartData = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const entries = data.exposureLog.filter((e) => {
      const d = parseISO(e.date);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
    if (entries.length > 0) {
      chartData.push({
        week: format(weekStart, "MMM d"),
        before: Math.round(entries.reduce((s, e) => s + e.anxietyBefore, 0) / entries.length * 10) / 10,
        after: Math.round(entries.reduce((s, e) => s + e.anxietyAfter, 0) / entries.length * 10) / 10,
        peak: Math.round(entries.reduce((s, e) => s + e.peakAnxiety, 0) / entries.length * 10) / 10,
      });
    }
  }

  const saveExposure = () => {
    if (!form.description.trim()) return;
    update((d) => ({ ...d, exposureLog: [...d.exposureLog, { ...form, id: id(), date: today }] }));
    setForm(blankExposure());
    setLogOpen(false);
  };

  const saveDrive = () => {
    if (!driveForm.route.trim()) return;
    update((d) => ({ ...d, drivingLog: [...d.drivingLog, { ...driveForm, id: id(), date: today }] }));
    setDriveForm(blankDrive());
    setDriveOpen(false);
  };

  const deleteExposure = (entryId: string) => {
    update((d) => ({ ...d, exposureLog: d.exposureLog.filter((e) => e.id !== entryId) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Exposure Therapy</h1>
          <p className="text-sand-dark mt-1">Every step forward counts, no matter how small 🌱</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDriveOpen(true)}>
            <Car size={14} className="mr-1.5 inline" /> Log Drive
          </Button>
          <Button onClick={() => setLogOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Log Exposure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Flame className="text-terracotta" size={22} />
            <span className="font-serif text-4xl text-brown">{streak}</span>
          </div>
          <p className="text-sm text-sand-dark">Day streak</p>
          <p className="text-xs text-sand mt-1">Keep showing up 💛</p>
        </Card>
        <Card className="text-center">
          <span className="font-serif text-4xl text-brown">{data.exposureLog.length}</span>
          <p className="text-sm text-sand-dark mt-1">Total exposures logged</p>
        </Card>
        <Card className="text-center">
          <span className="font-serif text-4xl text-brown">{data.drivingLog.length}</span>
          <p className="text-sm text-sand-dark mt-1">Driving sessions</p>
        </Card>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <Card title="Anxiety Trends Over Time" subtitle="Weekly averages — watch it go down 📉">
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DAC9A8" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#A8967E" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#A8967E" }} />
                <Tooltip contentStyle={{ background: "#FAF3E8", border: "1px solid #DAC9A8", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="before" stroke="#C99A5C" name="Before" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="peak" stroke="#DA667B" name="Peak" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="after" stroke="#71816D" name="After" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            {[{ color: "#C99A5C", label: "Before" }, { color: "#DA667B", label: "Peak" }, { color: "#71816D", label: "After" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-sand-dark">
                <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent exposures */}
      <Card title="Exposure Log" subtitle="Your recent bravery record">
        {data.exposureLog.length === 0 ? (
          <p className="text-sand-dark text-sm">No exposures logged yet. Add your first one! 🌸</p>
        ) : (
          <div className="space-y-3">
            {[...data.exposureLog].reverse().slice(0, 20).map((entry) => (
              <div key={entry.id} className="p-3 rounded-xl bg-cream-dark group relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-brown">{entry.description}</p>
                    <p className="text-xs text-sand-dark mt-0.5">{format(parseISO(entry.date), "MMMM d, yyyy")}</p>
                  </div>
                  <button onClick={() => deleteExposure(entry.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex gap-4 mt-2">
                  {[
                    { label: "Before", value: entry.anxietyBefore, color: "#C99A5C" },
                    { label: "Peak", value: entry.peakAnxiety, color: "#DA667B" },
                    { label: "After", value: entry.anxietyAfter, color: "#71816D" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-xs text-sand-dark">{stat.label}</p>
                      <p className="text-sm font-semibold" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                  {entry.durationMinutes > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-sand-dark">Duration</p>
                      <p className="text-sm font-semibold text-brown">{entry.durationMinutes}m</p>
                    </div>
                  )}
                </div>
                {entry.notes && <p className="text-xs text-sand-dark mt-2 italic">&ldquo;{entry.notes}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Driving log */}
      <Card title="Driving Log 🚗" subtitle="Your specific driving phobia work">
        {data.drivingLog.length === 0 ? (
          <p className="text-sand-dark text-sm">No drives logged yet. Every drive is progress.</p>
        ) : (
          <div className="space-y-3">
            {[...data.drivingLog].reverse().slice(0, 15).map((drive) => (
              <div key={drive.id} className="p-3 rounded-xl bg-cream-dark">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-brown">{drive.route}</p>
                  <p className="text-xs text-sand-dark">{format(parseISO(drive.date), "MMM d")}</p>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-sand-dark">Before: <span className="font-semibold text-terracotta">{drive.anxietyBefore}</span></span>
                  <span className="text-xs text-sand-dark">After: <span className="font-semibold text-sage">{drive.anxietyAfter}</span></span>
                  {drive.distanceMiles ? <span className="text-xs text-sand-dark">{drive.distanceMiles} mi</span> : null}
                </div>
                {drive.notes && <p className="text-xs text-sand-dark mt-1 italic">{drive.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Log Exposure Modal */}
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log an Exposure">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">What did you do?</label>
            <input type="text" placeholder="e.g. Made a phone call I'd been avoiding" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <AnxietySlider value={form.anxietyBefore} onChange={(v) => setForm({ ...form, anxietyBefore: v })} label="Anxiety before (1–10)" />
          <AnxietySlider value={form.peakAnxiety} onChange={(v) => setForm({ ...form, peakAnxiety: v })} label="Peak anxiety (1–10)" />
          <AnxietySlider value={form.anxietyAfter} onChange={(v) => setForm({ ...form, anxietyAfter: v })} label="Anxiety after (1–10)" />
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Duration (minutes)</label>
            <input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes (optional)</label>
            <textarea rows={2} placeholder="How did it go? What helped?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={saveExposure}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Log Drive Modal */}
      <Modal open={driveOpen} onClose={() => setDriveOpen(false)} title="Log a Drive 🚗">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Where did you drive?</label>
            <input type="text" placeholder="e.g. Drove to the grocery store on West End" value={driveForm.route} onChange={(e) => setDriveForm({ ...driveForm, route: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Distance (miles, optional)</label>
            <input type="number" min={0} step={0.1} value={driveForm.distanceMiles} onChange={(e) => setDriveForm({ ...driveForm, distanceMiles: Number(e.target.value) })} className="w-24" />
          </div>
          <AnxietySlider value={driveForm.anxietyBefore} onChange={(v) => setDriveForm({ ...driveForm, anxietyBefore: v })} label="Anxiety before" />
          <AnxietySlider value={driveForm.anxietyAfter} onChange={(v) => setDriveForm({ ...driveForm, anxietyAfter: v })} label="Anxiety after" />
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="Road conditions, what helped, etc." value={driveForm.notes} onChange={(e) => setDriveForm({ ...driveForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDriveOpen(false)}>Cancel</Button>
            <Button onClick={saveDrive}>Save Drive</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
