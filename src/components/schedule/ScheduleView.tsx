"use client";

import { useState } from "react";
import { Trash2, Check, GraduationCap, User } from "lucide-react";
import { DashboardData, Milestone, LetterOfRec } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const STATUS_COLORS: Record<LetterOfRec["status"], string> = {
  "not asked": "#A8967E",
  "asked":     "#C99A5C",
  "confirmed": "#71816D",
  "submitted": "#DA667B",
};

export function ScheduleView({ data, update }: Props) {
  const [classOpen, setClassOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [lorOpen, setLorOpen] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", day: "Monday", time: "", location: "", notes: "" });
  const [milestoneForm, setMilestoneForm] = useState({ title: "", deadline: "", category: "meharry" as Milestone["category"], notes: "" });
  const [lorForm, setLorForm] = useState({ recommender: "", institution: "", status: "not asked" as LetterOfRec["status"], dateSent: "", notes: "" });

  const addClass = () => {
    if (!classForm.name.trim()) return;
    update((d) => ({ ...d, classes: [...d.classes, { ...classForm, id: id() }] }));
    setClassForm({ name: "", day: "Monday", time: "", location: "", notes: "" });
    setClassOpen(false);
  };

  const addMilestone = () => {
    if (!milestoneForm.title.trim()) return;
    update((d) => ({ ...d, milestones: [...d.milestones, { ...milestoneForm, id: id(), done: false }] }));
    setMilestoneForm({ title: "", deadline: "", category: "meharry", notes: "" });
    setMilestoneOpen(false);
  };

  const addLOR = () => {
    if (!lorForm.recommender.trim()) return;
    update((d) => ({ ...d, lettersOfRec: [...d.lettersOfRec, { ...lorForm, id: id() }] }));
    setLorForm({ recommender: "", institution: "", status: "not asked", dateSent: "", notes: "" });
    setLorOpen(false);
  };

  const toggleMilestone = async (mid: string) => {
    const m = data.milestones.find((x) => x.id === mid);
    if (!m?.done) await celebrate();
    update((d) => ({ ...d, milestones: d.milestones.map((x) => x.id === mid ? { ...x, done: !x.done } : x) }));
  };

  const updateLORStatus = (lid: string, status: LetterOfRec["status"]) => {
    update((d) => ({ ...d, lettersOfRec: d.lettersOfRec.map((l) => l.id === lid ? { ...l, status } : l) }));
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">School & Schedule</h1>
          <p className="text-sand-dark mt-1">Meharry MHS → Medical School → Dermatology 🩺</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setLorOpen(true)}>+ Letter of Rec</Button>
          <Button variant="secondary" size="sm" onClick={() => setMilestoneOpen(true)}>+ Milestone</Button>
          <Button size="sm" onClick={() => setClassOpen(true)}>+ Class</Button>
        </div>
      </div>

      {/* Classes */}
      {data.classes.length > 0 && (
        <Card title="Class Schedule">
          <div className="space-y-2 mt-2">
            {data.classes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark group">
                <GraduationCap size={14} className="text-terracotta flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brown">{c.name}</p>
                  <p className="text-xs text-sand-dark">{c.day} · {c.time} · {c.location}</p>
                </div>
                <button onClick={() => update((d) => ({ ...d, classes: d.classes.filter((x) => x.id !== c.id) }))} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Milestones */}
      <Card title="Application Milestones" subtitle="Meharry MHS & Medical School path">
        <div className="space-y-2 mt-2">
          {data.milestones.map((m) => (
            <div key={m.id} className="flex items-start gap-3 group">
              <button
                onClick={() => toggleMilestone(m.id)}
                className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${m.done ? "bg-sage border-sage" : "border-sand hover:border-terracotta"}`}
              >
                {m.done && <Check size={11} />}
              </button>
              <div className="flex-1">
                <p className={`text-sm ${m.done ? "line-through text-sand-dark" : "text-brown"}`}>{m.title}</p>
                {m.deadline && <p className="text-xs text-terracotta">Deadline: {m.deadline}</p>}
                {m.notes && <p className="text-xs text-sand-dark italic">{m.notes}</p>}
              </div>
              <button onClick={() => update((d) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== m.id) }))} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {data.milestones.length === 0 && <p className="text-sand-dark text-sm">No milestones yet — add one!</p>}
        </div>
      </Card>

      {/* Letters of Rec */}
      <Card title="Letters of Recommendation">
        {data.lettersOfRec.length === 0 ? (
          <p className="text-sand-dark text-sm">No letters tracked yet. Add them when you start asking! 📬</p>
        ) : (
          <div className="space-y-3 mt-2">
            {data.lettersOfRec.map((lor) => (
              <div key={lor.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-dark">
                <User size={14} className="text-terracotta flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brown">{lor.recommender}</p>
                  <p className="text-xs text-sand-dark">{lor.institution}</p>
                  {lor.notes && <p className="text-xs text-brown italic">{lor.notes}</p>}
                </div>
                <select
                  value={lor.status}
                  onChange={(e) => updateLORStatus(lor.id, e.target.value as LetterOfRec["status"])}
                  className="text-xs px-2 py-1 w-28 h-7"
                  style={{ color: STATUS_COLORS[lor.status] }}
                >
                  <option value="not asked">Not Asked</option>
                  <option value="asked">Asked</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="submitted">Submitted ✓</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal open={classOpen} onClose={() => setClassOpen(false)} title="Add Class">
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-brown block mb-1">Class Name</label><input type="text" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Day</label>
              <select value={classForm.day} onChange={(e) => setClassForm({ ...classForm, day: e.target.value })}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-brown block mb-1">Time</label><input type="text" placeholder="9:00 AM" value={classForm.time} onChange={(e) => setClassForm({ ...classForm, time: e.target.value })} /></div>
          </div>
          <div><label className="text-xs font-medium text-brown block mb-1">Location</label><input type="text" value={classForm.location} onChange={(e) => setClassForm({ ...classForm, location: e.target.value })} /></div>
          <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setClassOpen(false)}>Cancel</Button><Button onClick={addClass}>Add</Button></div>
        </div>
      </Modal>

      <Modal open={milestoneOpen} onClose={() => setMilestoneOpen(false)} title="Add Milestone">
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-brown block mb-1">Milestone</label><input type="text" value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-brown block mb-1">Deadline</label><input type="text" placeholder="e.g. August 2025" value={milestoneForm.deadline} onChange={(e) => setMilestoneForm({ ...milestoneForm, deadline: e.target.value })} /></div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Category</label>
            <select value={milestoneForm.category} onChange={(e) => setMilestoneForm({ ...milestoneForm, category: e.target.value as Milestone["category"] })}>
              <option value="meharry">Meharry MHS</option>
              <option value="application">Application</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div><label className="text-xs font-medium text-brown block mb-1">Notes</label><textarea rows={2} value={milestoneForm.notes} onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })} /></div>
          <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setMilestoneOpen(false)}>Cancel</Button><Button onClick={addMilestone}>Add</Button></div>
        </div>
      </Modal>

      <Modal open={lorOpen} onClose={() => setLorOpen(false)} title="Add Letter of Recommendation">
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-brown block mb-1">Recommender&apos;s Name</label><input type="text" placeholder="Dr. Smith" value={lorForm.recommender} onChange={(e) => setLorForm({ ...lorForm, recommender: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-brown block mb-1">Institution / Title</label><input type="text" placeholder="Nashville General, Dermatology" value={lorForm.institution} onChange={(e) => setLorForm({ ...lorForm, institution: e.target.value })} /></div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Status</label>
            <select value={lorForm.status} onChange={(e) => setLorForm({ ...lorForm, status: e.target.value as LetterOfRec["status"] })}>
              <option value="not asked">Not Asked Yet</option>
              <option value="asked">Asked</option>
              <option value="confirmed">Confirmed</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
          <div><label className="text-xs font-medium text-brown block mb-1">Notes</label><textarea rows={2} value={lorForm.notes} onChange={(e) => setLorForm({ ...lorForm, notes: e.target.value })} /></div>
          <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setLorOpen(false)}>Cancel</Button><Button onClick={addLOR}>Add</Button></div>
        </div>
      </Modal>
    </div>
  );
}
