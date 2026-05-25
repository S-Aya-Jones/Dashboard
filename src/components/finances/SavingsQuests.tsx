"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Check } from "lucide-react";
import { SavingsGoal } from "@/types/dashboard";
import { id } from "@/lib/utils";

interface Props {
  goals:    SavingsGoal[];
  onUpdate: (goals: SavingsGoal[]) => void;
}

function fmt$(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const RING_R   = 36; // eslint-disable-line @typescript-eslint/no-unused-vars

const RING_COLORS = [
  { track: "#f0dfd5", fill: "#c47a5e" }, // terracotta
  { track: "#d5dbd0", fill: "#7a816c" }, // sage
  { track: "#dde4ea", fill: "#7a9bb5" }, // blue
  { track: "#f5dbd8", fill: "#d68d84" }, // rose
  { track: "#e8e0d5", fill: "#785b4e" }, // brown
];

function Ring({ pct, color, size = 88 }: { pct: number; color: typeof RING_COLORS[0]; size?: number }) {
  const r    = size * 0.41;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, pct / 100);

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.track} strokeWidth={size * 0.1} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color.fill}
        strokeWidth={size * 0.1}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
      />
    </svg>
  );
}

function QuestCard({ goal, colorIdx, onSave, onDelete }: {
  goal:     SavingsGoal;
  colorIdx: number;
  onSave:   (g: SavingsGoal) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [draft,    setDraft]      = useState({ current: goal.current, target: goal.target, name: goal.name, deadline: goal.deadline ?? "" });

  const pct    = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
  const color  = RING_COLORS[colorIdx % RING_COLORS.length];
  const done   = pct >= 100;

  const save = () => {
    onSave({ ...goal, ...draft, current: Number(draft.current), target: Number(draft.target) });
    setExpanded(false);
  };

  return (
    <div className={`relative flex flex-col items-center text-center transition-all ${expanded ? "col-span-2 sm:col-span-1" : ""}`}>
      <button onClick={() => setExpanded((s) => !s)} className="relative focus:outline-none group">
        <Ring pct={pct} color={color} size={88} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {done ? (
            <Check size={18} style={{ color: color.fill }} />
          ) : (
            <span className="font-serif text-sm leading-none" style={{ color: color.fill }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </button>

      <p className="text-xs text-brown font-medium mt-2 leading-tight max-w-[80px] truncate">{goal.name}</p>
      <p className="text-[10px] text-sand-dark mt-0.5">{fmt$(goal.current)} / {fmt$(goal.target)}</p>
      {goal.deadline && <p className="text-[10px] text-terracotta mt-0.5">by {goal.deadline}</p>}

      {expanded && (
        <div className="mt-3 w-full text-left space-y-2 border-t border-sand/15 pt-3">
          <div>
            <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Name</label>
            <input type="text" value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="text-xs w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Saved</label>
              <input type="number" min={0} value={draft.current}
                onChange={(e) => setDraft((d) => ({ ...d, current: Number(e.target.value) }))}
                className="text-xs w-full" />
            </div>
            <div>
              <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Goal</label>
              <input type="number" min={1} value={draft.target}
                onChange={(e) => setDraft((d) => ({ ...d, target: Number(e.target.value) }))}
                className="text-xs w-full" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Deadline</label>
            <input type="text" placeholder="e.g. Q4 2026" value={draft.deadline}
              onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))}
              className="text-xs w-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save}
              className="flex-1 text-xs font-medium text-white py-1.5 rounded-lg transition-colors"
              style={{ background: color.fill }}>
              Save
            </button>
            <button onClick={() => onDelete(goal.id)}
              className="text-xs text-sand-dark hover:text-rose transition-colors px-2">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SavingsQuests({ goals, onUpdate }: Props) {
  const [adding,   setAdding]   = useState(false);
  const [newForm,  setNewForm]  = useState({ name: "", current: 0, target: 0, deadline: "" });

  const saveGoal = (updated: SavingsGoal) =>
    onUpdate(goals.map((g) => (g.id === updated.id ? updated : g)));

  const deleteGoal = (gid: string) =>
    onUpdate(goals.filter((g) => g.id !== gid));

  const addGoal = () => {
    if (!newForm.name.trim() || newForm.target <= 0) return;
    onUpdate([...goals, { ...newForm, id: id(), current: Number(newForm.current), target: Number(newForm.target) }]);
    setNewForm({ name: "", current: 0, target: 0, deadline: "" });
    setAdding(false);
  };

  if (goals.length === 0 && !adding) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl text-brown">Savings Quests</h3>
          <button onClick={() => setAdding(true)}
            className="w-7 h-7 rounded-full bg-cream flex items-center justify-center hover:bg-cream-darker transition-colors">
            <Plus size={13} className="text-sand-dark" />
          </button>
        </div>
        <p className="text-xs text-sand-dark text-center py-4">No quests yet — add a savings goal.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-serif text-xl text-brown">Savings Quests</h3>
          {goals.length > 0 && (
            <p className="text-xs text-sand-dark mt-0.5">
              {goals.filter((g) => g.target > 0 && g.current >= g.target).length} of {goals.length} complete
            </p>
          )}
        </div>
        <button onClick={() => setAdding((s) => !s)}
          className="w-7 h-7 rounded-full bg-cream flex items-center justify-center hover:bg-cream-darker transition-colors">
          <Plus size={13} className="text-sand-dark" />
        </button>
      </div>

      {/* Rings grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-5">
        {goals.map((g, i) => (
          <QuestCard
            key={g.id}
            goal={g}
            colorIdx={i}
            onSave={saveGoal}
            onDelete={deleteGoal}
          />
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mt-5 pt-5 border-t border-sand/15 space-y-3">
          <p className="text-xs font-medium text-sand-dark uppercase tracking-wide">New Quest</p>
          <input type="text" placeholder="Goal name (e.g. Emergency Fund)"
            value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
            className="text-xs w-full" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Saved so far ($)</label>
              <input type="number" min={0} value={newForm.current || ""}
                placeholder="0"
                onChange={(e) => setNewForm((f) => ({ ...f, current: Number(e.target.value) }))}
                className="text-xs w-full" />
            </div>
            <div>
              <label className="text-[10px] text-sand-dark uppercase tracking-wide block mb-0.5">Target ($)</label>
              <input type="number" min={1} value={newForm.target || ""}
                placeholder="e.g. 5000"
                onChange={(e) => setNewForm((f) => ({ ...f, target: Number(e.target.value) }))}
                className="text-xs w-full" />
            </div>
          </div>
          <input type="text" placeholder="Deadline (optional — e.g. Q4 2026)"
            value={newForm.deadline}
            onChange={(e) => setNewForm((f) => ({ ...f, deadline: e.target.value }))}
            className="text-xs w-full" />
          <div className="flex gap-2">
            <button onClick={addGoal}
              className="flex-1 text-xs font-medium text-white py-2 rounded-lg bg-terracotta hover:bg-terracotta/90 transition-colors">
              Add Quest
            </button>
            <button onClick={() => setAdding(false)}
              className="text-xs text-sand-dark hover:text-brown transition-colors px-3">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
