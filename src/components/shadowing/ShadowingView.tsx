"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Stethoscope } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const blank = () => ({ location: "Nashville General", physician: "", specialty: "Dermatology", hours: 4, notes: "" });

export function ShadowingView({ data, update }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [dateVal, setDateVal] = useState(todayStr());

  const totalHours = data.shadowingSessions.reduce((s, sess) => s + sess.hours, 0);

  // Hours by specialty
  const specialtyMap: Record<string, number> = {};
  data.shadowingSessions.forEach((s) => {
    specialtyMap[s.specialty] = (specialtyMap[s.specialty] ?? 0) + s.hours;
  });
  const specialties = Object.entries(specialtyMap).sort((a, b) => b[1] - a[1]);

  const addSession = () => {
    if (!form.physician.trim()) return;
    update((d) => ({ ...d, shadowingSessions: [...d.shadowingSessions, { ...form, id: id(), date: dateVal }] }));
    setForm(blank());
    setLogOpen(false);
  };

  const deleteSession = (sid: string) => {
    update((d) => ({ ...d, shadowingSessions: d.shadowingSessions.filter((s) => s.id !== sid) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Shadowing & Clinical Hours</h1>
          <p className="text-sand-dark mt-1">Building your foundation for dermatology</p>
        </div>
        <Button onClick={() => setLogOpen(true)}>
          <Plus size={14} className="mr-1.5 inline" /> Log Session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="font-serif text-4xl text-brown">{totalHours}</p>
          <p className="text-sm text-sand-dark mt-1">Total clinical hours</p>
        </Card>
        <Card className="text-center">
          <p className="font-serif text-4xl text-brown">{data.shadowingSessions.length}</p>
          <p className="text-sm text-sand-dark mt-1">Sessions logged</p>
        </Card>
        <Card className="text-center">
          <p className="font-serif text-4xl text-brown">{specialtyMap["Dermatology"] ?? 0}</p>
          <p className="text-sm text-sand-dark mt-1">Dermatology hours</p>
        </Card>
      </div>

      {specialties.length > 0 && (
        <Card title="Hours by Specialty">
          <div className="space-y-3 mt-2">
            {specialties.map(([spec, hrs]) => (
              <div key={spec}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-brown">{spec}</span>
                  <span className="text-sand-dark">{hrs}h</span>
                </div>
                <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(hrs / totalHours) * 100}%`, background: spec === "Dermatology" ? "#DA667B" : "#71816D" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Session Log">
        {data.shadowingSessions.length === 0 ? (
          <p className="text-sand-dark text-sm">No sessions logged yet. Add your first.</p>
        ) : (
          <div className="space-y-3">
            {[...data.shadowingSessions].reverse().map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-cream-dark group flex items-start gap-3">
                <Stethoscope size={16} className="text-terracotta mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brown">{s.physician} — {s.specialty}</p>
                  <p className="text-xs text-sand-dark">{s.location} · {format(parseISO(s.date), "MMMM d, yyyy")} · {s.hours}h</p>
                  {s.notes && <p className="text-xs text-brown italic mt-1">{s.notes}</p>}
                </div>
                <button onClick={() => deleteSession(s.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Shadowing Session">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Date</label>
            <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Location</label>
            <input type="text" placeholder="Nashville General Hospital" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Physician / Attending</label>
            <input type="text" placeholder="Dr. Smith" value={form.physician} onChange={(e) => setForm({ ...form, physician: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Specialty</label>
            <input type="text" placeholder="Dermatology" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Hours</label>
            <input type="number" min={0.5} step={0.5} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className="w-20" />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="What did you observe? What stood out?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={addSession}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
