"use client";

import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Plus, Trash2, Users, Heart, AlertCircle } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const RELATIONSHIPS = ["friend", "family", "nephew", "partner", "mentor", "colleague", "other"];

export function ConnectionsView({ data, update }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ person: "", relationship: "family", activity: "", notes: "" });
  const [dateVal, setDateVal] = useState(todayStr());

  const addLog = () => {
    if (!form.person.trim() || !form.activity.trim()) return;
    update((d) => ({ ...d, connectionLogs: [...d.connectionLogs, { ...form, id: id(), date: dateVal }] }));
    setForm({ person: "", relationship: "family", activity: "", notes: "" });
    setLogOpen(false);
  };

  const deleteLog = (lid: string) => {
    update((d) => ({ ...d, connectionLogs: d.connectionLogs.filter((l) => l.id !== lid) }));
  };

  // Nudge: people not seen in 14+ days
  const peopleLastSeen: Record<string, string> = {};
  data.connectionLogs.forEach((l) => {
    if (!peopleLastSeen[l.person] || l.date > peopleLastSeen[l.person]) {
      peopleLastSeen[l.person] = l.date;
    }
  });
  const nudges = Object.entries(peopleLastSeen)
    .filter(([, date]) => differenceInDays(new Date(), parseISO(date)) >= 14)
    .sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Connections</h1>
          <p className="text-sand-dark mt-1">People who fill your cup</p>
        </div>
        <Button onClick={() => setLogOpen(true)}>
          <Plus size={14} className="mr-1.5 inline" /> Log Time Together
        </Button>
      </div>

      {nudges.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-terracotta" />
            <p className="text-sm font-medium text-brown">Gentle nudges</p>
          </div>
          <div className="space-y-2">
            {nudges.slice(0, 3).map(([person, date]) => (
              <div key={person} className="flex items-center gap-2 text-sm">
                <Heart size={12} className="text-rose" />
                <span className="text-brown">{person}</span>
                <span className="text-sand-dark">— {differenceInDays(new Date(), parseISO(date))} days since you connected</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Connection Log">
        {data.connectionLogs.length === 0 ? (
          <p className="text-sand-dark text-sm">No connections logged yet. Life is better with people in it.</p>
        ) : (
          <div className="space-y-3">
            {[...data.connectionLogs].reverse().slice(0, 25).map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-cream-dark group">
                <Users size={14} className="text-terracotta mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-brown">{log.person}</p>
                    <span className="text-xs bg-sand/40 px-2 py-0.5 rounded-full text-brown capitalize">{log.relationship}</span>
                  </div>
                  <p className="text-sm text-brown mt-0.5">{log.activity}</p>
                  <p className="text-xs text-sand-dark">{format(parseISO(log.date), "MMMM d, yyyy")}</p>
                  {log.notes && <p className="text-xs text-brown italic mt-1">{log.notes}</p>}
                </div>
                <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Time Together">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Date</label>
            <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Who?</label>
            <input type="text" placeholder="Name" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Relationship</label>
            <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
              {RELATIONSHIPS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">What did you do?</label>
            <input type="text" placeholder="e.g. Bible study, FaceTime, watched nephews…" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes (optional)</label>
            <textarea rows={2} placeholder="How did it feel? What did you talk about?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={addLog}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
