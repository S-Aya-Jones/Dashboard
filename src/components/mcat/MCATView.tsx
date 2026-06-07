"use client";

import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Plus } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const SECTIONS = [
  { key: "cars" as const, label: "CARS", color: "#DA667B" },
  { key: "bioBiochem" as const, label: "Bio/Biochem", color: "#71816D" },
  { key: "chemPhys" as const, label: "Chem/Phys", color: "#C99A5C" },
  { key: "psychSoc" as const, label: "Psych/Soc", color: "rgba(124,92,252,0.3)" },
];

export function MCATView({ data, update }: Props) {
  const [studyOpen, setStudyOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [studyForm, setStudyForm] = useState({ cars: 0, bioBiochem: 0, chemPhys: 0, psychSoc: 0 });
  const [testForm, setTestForm] = useState({ total: 0, cars: 0, bioBiochem: 0, chemPhys: 0, psychSoc: 0, notes: "" });
  const [testDate, setTestDate] = useState(data.mcatTestDate ?? "");

  const today = todayStr();
  const daysUntilMCAT = data.mcatTestDate ? differenceInDays(parseISO(data.mcatTestDate), new Date()) : null;

  const totalHours = data.studySessions.reduce((s, sess) => s + sess.cars + sess.bioBiochem + sess.chemPhys + sess.psychSoc, 0);

  const sectionTotals = SECTIONS.map((sec) => ({
    ...sec,
    hours: data.studySessions.reduce((s, sess) => s + sess[sec.key], 0),
  }));

  const last8Sessions = [...data.studySessions].reverse().slice(0, 8).reverse();
  const studyChartData = last8Sessions.map((s) => ({
    date: format(parseISO(s.date), "M/d"),
    CARS: s.cars,
    "Bio/Biochem": s.bioBiochem,
    "Chem/Phys": s.chemPhys,
    "Psych/Soc": s.psychSoc,
  }));

  const saveTestDate = () => {
    update((d) => ({ ...d, mcatTestDate: testDate }));
  };

  const addStudy = () => {
    const total = studyForm.cars + studyForm.bioBiochem + studyForm.chemPhys + studyForm.psychSoc;
    if (total === 0) return;
    update((d) => ({ ...d, studySessions: [...d.studySessions, { ...studyForm, id: id(), date: today }] }));
    setStudyForm({ cars: 0, bioBiochem: 0, chemPhys: 0, psychSoc: 0 });
    setStudyOpen(false);
  };

  const addPracticeTest = () => {
    if (testForm.total === 0) return;
    update((d) => ({ ...d, practiceTests: [...d.practiceTests, { ...testForm, id: id(), date: today }] }));
    setTestForm({ total: 0, cars: 0, bioBiochem: 0, chemPhys: 0, psychSoc: 0, notes: "" });
    setTestOpen(false);
  };

  const updateResource = (rid: string, pct: number) => {
    update((d) => ({ ...d, mcatResources: d.mcatResources.map((r) => r.id === rid ? { ...r, completionPercent: pct } : r) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">MCAT Prep</h1>
          <p className="text-sand-dark mt-1">You&apos;re building your future, one session at a time 📚</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTestOpen(true)}>Log Practice Test</Button>
          <Button onClick={() => setStudyOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Log Study Session
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="font-serif text-3xl text-brown">{totalHours}h</p>
          <p className="text-xs text-sand-dark mt-1">Total study hours</p>
        </Card>
        <Card className="text-center">
          <p className="font-serif text-3xl text-brown">{data.studySessions.length}</p>
          <p className="text-xs text-sand-dark mt-1">Study sessions</p>
        </Card>
        <Card className="text-center">
          <p className="font-serif text-3xl text-brown">{data.practiceTests.length}</p>
          <p className="text-xs text-sand-dark mt-1">Practice tests</p>
        </Card>
        <Card className="text-center">
          {daysUntilMCAT !== null ? (
            <>
              <p className="font-serif text-3xl" style={{ color: daysUntilMCAT < 30 ? "#DA667B" : "var(--text)" }}>{daysUntilMCAT}</p>
              <p className="text-xs text-sand-dark mt-1">Days until MCAT</p>
            </>
          ) : (
            <div className="space-y-1">
              <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="text-xs" />
              <button onClick={saveTestDate} className="text-xs text-terracotta hover:underline">Set MCAT date</button>
            </div>
          )}
        </Card>
      </div>

      {/* Hours by section */}
      <Card title="Hours by Section">
        <div className="space-y-3 mt-2">
          {sectionTotals.map((sec) => (
            <div key={sec.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-brown">{sec.label}</span>
                <span className="text-sand-dark">{sec.hours}h</span>
              </div>
              <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: totalHours ? `${(sec.hours / totalHours) * 100}%` : "0", background: sec.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Study chart */}
      {studyChartData.length > 1 && (
        <Card title="Recent Study Sessions">
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,92,252,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#A8967E" }} />
                <YAxis tick={{ fontSize: 11, fill: "#A8967E" }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.1)", borderRadius: "8px", fontSize: "12px" }} />
                {SECTIONS.map((s) => <Bar key={s.key} dataKey={s.label} stackId="a" fill={s.color} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Resources */}
      <Card title="Resources" subtitle="Track your completion">
        <div className="space-y-3 mt-2">
          {data.mcatResources.map((r) => (
            <div key={r.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-brown">{r.name}</span>
                <input
                  type="number" min={0} max={100} value={r.completionPercent}
                  onChange={(e) => updateResource(r.id, Number(e.target.value))}
                  className="w-14 text-right text-xs p-1 h-6"
                />
              </div>
              <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${r.completionPercent}%`, background: "#71816D" }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Practice tests */}
      {data.practiceTests.length > 0 && (
        <Card title="Practice Test Scores">
          <div className="space-y-2 mt-2">
            {[...data.practiceTests].reverse().map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-cream-dark rounded-xl">
                <div className="flex-1">
                  <p className="text-xs text-sand-dark">{format(parseISO(t.date), "MMMM d, yyyy")}</p>
                  {t.notes && <p className="text-xs text-brown italic mt-0.5">{t.notes}</p>}
                </div>
                <p className="font-serif text-2xl text-brown">{t.total}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Log Study Modal */}
      <Modal open={studyOpen} onClose={() => setStudyOpen(false)} title="Log Study Session">
        <div className="space-y-4">
          <p className="text-sm text-sand-dark">Enter hours studied per section today:</p>
          {SECTIONS.map((sec) => (
            <div key={sec.key} className="flex items-center gap-3">
              <label className="text-sm text-brown w-28">{sec.label}</label>
              <input type="number" min={0} step={0.5} value={studyForm[sec.key]}
                onChange={(e) => setStudyForm({ ...studyForm, [sec.key]: Number(e.target.value) })}
                className="w-20" />
              <span className="text-xs text-sand-dark">hours</span>
            </div>
          ))}
          <p className="text-sm text-brown">
            Total: <span className="font-semibold text-terracotta">
              {(studyForm.cars + studyForm.bioBiochem + studyForm.chemPhys + studyForm.psychSoc).toFixed(1)}h
            </span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setStudyOpen(false)}>Cancel</Button>
            <Button onClick={addStudy}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Log Test Modal */}
      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Log Practice Test">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Total Score (472–528)</label>
            <input type="number" min={472} max={528} value={testForm.total} onChange={(e) => setTestForm({ ...testForm, total: Number(e.target.value) })} className="w-28" />
          </div>
          <p className="text-xs text-sand-dark">Section scores (118–132 each, optional):</p>
          {SECTIONS.map((sec) => (
            <div key={sec.key} className="flex items-center gap-3">
              <label className="text-sm text-brown w-28">{sec.label}</label>
              <input type="number" min={118} max={132} value={testForm[sec.key]} onChange={(e) => setTestForm({ ...testForm, [sec.key]: Number(e.target.value) })} className="w-20" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} value={testForm.notes} onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })} placeholder="How did it feel? What to review?" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button onClick={addPracticeTest}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
