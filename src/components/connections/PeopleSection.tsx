"use client";

import { useState } from "react";
import { Plus, Trash2, Cake, Phone, Check, Pencil } from "lucide-react";
import { DashboardData, Person } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { id } from "@/lib/utils";
import { whatIsDue, dueLine, nextDue, daysUntilDue, daysUntilBirthday, turningAge, todayISO } from "@/lib/people";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const CADENCES = [
  { days: 0,  label: "Birthday only" },
  { days: 7,  label: "Weekly" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Every 3 months" },
];

const BLANK = { name: "", relationship: "", birthday: "", cadenceDays: 14, phone: "" };

export function PeopleSection({ data, update }: Props) {
  const people = data.people ?? [];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);

  const today = todayISO();
  const due = whatIsDue(people, today);

  function save() {
    if (!form.name.trim()) return;
    const person: Person = {
      id: editing ?? id(),
      name: form.name.trim(),
      relationship: form.relationship.trim(),
      birthday: form.birthday || undefined,
      cadenceDays: form.cadenceDays > 0 ? form.cadenceDays : undefined,
      phone: form.phone.trim() || undefined,
      lastContact: editing ? people.find(p => p.id === editing)?.lastContact : undefined,
    };
    update(d => ({
      ...d,
      people: editing
        ? (d.people ?? []).map(p => (p.id === editing ? person : p))
        : [...(d.people ?? []), person],
    }));
    setForm(BLANK);
    setAdding(false);
    setEditing(null);
  }

  /** Logging a call is what resets the cadence — the two were never linked before. */
  function markCalled(p: Person) {
    update(d => ({
      ...d,
      people: (d.people ?? []).map(x => (x.id === p.id ? { ...x, lastContact: today } : x)),
      connectionLogs: [
        ...d.connectionLogs,
        { id: id(), date: today, person: p.name, relationship: p.relationship || "family", activity: "Called" },
      ],
    }));
  }

  function remove(pid: string) {
    update(d => ({ ...d, people: (d.people ?? []).filter(p => p.id !== pid) }));
  }

  function startEdit(p: Person) {
    setForm({
      name: p.name,
      relationship: p.relationship ?? "",
      birthday: p.birthday ?? "",
      cadenceDays: p.cadenceDays ?? 0,
      phone: p.phone ?? "",
    });
    setEditing(p.id);
    setAdding(true);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-serif text-xl" style={{ color: "var(--text)" }}>People</h2>
        <button
          onClick={() => { setForm(BLANK); setEditing(null); setAdding(a => !a); }}
          className="text-xs font-semibold px-3 py-2 rounded-xl inline-flex items-center gap-1.5"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          <Plus size={13} /> Add someone
        </button>
      </div>

      {/* What's actually due — the reason this section exists. */}
      {due.length > 0 && (
        <div className="rounded-xl p-3 mb-4 space-y-1.5"
          style={{ background: "rgba(180,85,47,0.06)", border: "1px solid rgba(180,85,47,0.22)" }}>
          {due.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.kind === "birthday"
                ? <Cake size={13} style={{ color: "var(--purple)", flexShrink: 0 }} />
                : <Phone size={13} style={{ color: "var(--purple)", flexShrink: 0 }} />}
              <span className="text-sm flex-1" style={{ color: "var(--text)" }}>{dueLine(item)}</span>
              {item.kind !== "birthday" && (
                <button onClick={() => markCalled(item.person)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                  style={{ background: "var(--text)", color: "var(--surface)" }}>
                  <Check size={11} /> Called
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="grid sm:grid-cols-2 gap-2">
            <input placeholder="Name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input placeholder="Grandma, brother, father…" value={form.relationship}
              onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Birthday
              <input type="date" value={form.birthday}
                onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Check in
              <select value={form.cadenceDays}
                onChange={e => setForm(f => ({ ...f, cadenceDays: Number(e.target.value) }))}>
                {CADENCES.map(c => <option key={c.days} value={c.days}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <input placeholder="Phone (optional)" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={save} className="text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ background: "var(--text)", color: "var(--surface)" }}>
              {editing ? "Save" : "Add"}
            </button>
            <button onClick={() => { setAdding(false); setEditing(null); }}
              className="text-sm px-4 py-2 rounded-xl"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {people.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nobody here yet. Add your grandma, your brother, your dad — anyone you want to be
          reminded to call rather than remember to call.
        </p>
      ) : (
        <div className="space-y-2">
          {people.map(p => {
            const dueIn = daysUntilDue(p, today);
            const bd = daysUntilBirthday(p, today);
            const age = turningAge(p, today);
            return (
              <div key={p.id} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                    {p.name}
                    {p.relationship && (
                      <span className="font-normal" style={{ color: "var(--text-light)" }}> · {p.relationship}</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: dueIn !== null && dueIn <= 0 ? "var(--purple)" : "var(--text-muted)" }}>
                    {dueIn === null
                      ? "no check-in set"
                      : dueIn <= 0
                      ? `call due${dueIn < 0 ? ` — ${-dueIn} days ago` : " today"}`
                      : `next call in ${dueIn} day${dueIn === 1 ? "" : "s"}`}
                    {bd !== null && ` · birthday in ${bd} day${bd === 1 ? "" : "s"}${age ? ` (turning ${age})` : ""}`}
                  </p>
                </div>
                {p.cadenceDays ? (
                  <button onClick={() => markCalled(p)} title={`Resets to ${nextDue({ ...p, lastContact: today })}`}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>
                    Called
                  </button>
                ) : null}
                <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
