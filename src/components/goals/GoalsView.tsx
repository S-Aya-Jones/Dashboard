"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { DashboardData, Goal } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const CATEGORIES = [
  { key: "medical-school" as const, label: "Medical School", icon: "🩺", color: "#c47a5e" },
  { key: "health-mental" as const, label: "Health & Mental Health", icon: "🧠", color: "#d68d84" },
  { key: "career" as const, label: "Career", icon: "💼", color: "#7a816c" },
  { key: "personal" as const, label: "Personal", icon: "🌸", color: "#8e967d" },
  { key: "financial" as const, label: "Financial", icon: "💚", color: "#785b4e" },
  { key: "spiritual" as const, label: "Spiritual", icon: "🙏", color: "#cfbb9f" },
];

const CURRENT_QUARTER = "Q2-2026";
const CURRENT_YEAR = "2026";

export function GoalsView({ data, update }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"quarterly" | "yearly">("quarterly");
  const [form, setForm] = useState({ text: "", category: "medical-school" as Goal["category"], notes: "" });

  const goals = data.goals.filter((g) => {
    if (activeTab === "quarterly") return g.timeframe === "quarterly" && g.quarter === CURRENT_QUARTER;
    return g.timeframe === "yearly" && g.year === CURRENT_YEAR;
  });

  const toggleGoal = async (gid: string) => {
    const goal = data.goals.find((g) => g.id === gid);
    if (!goal?.done) await celebrate();
    update((d) => ({ ...d, goals: d.goals.map((g) => g.id === gid ? { ...g, done: !g.done } : g) }));
  };

  const addGoal = () => {
    if (!form.text.trim()) return;
    const newGoal: Goal = {
      ...form,
      id: id(),
      done: false,
      timeframe: activeTab,
      quarter: activeTab === "quarterly" ? CURRENT_QUARTER : undefined,
      year: activeTab === "yearly" ? CURRENT_YEAR : undefined,
    };
    update((d) => ({ ...d, goals: [...d.goals, newGoal] }));
    setForm({ text: "", category: "medical-school", notes: "" });
    setAddOpen(false);
  };

  const deleteGoal = (gid: string) => {
    update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== gid) }));
  };

  const completedCount = goals.filter((g) => g.done).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Goals</h1>
          <p className="text-sand-dark mt-1">Quarterly & yearly vision — your future is being built right now 🌟</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5 inline" /> Add Goal
        </Button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 p-1 bg-cream-darker rounded-xl w-fit">
        {(["quarterly", "yearly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-white text-brown shadow-soft" : "text-sand-dark hover:text-brown"}`}
          >
            {tab === "quarterly" ? `Q2 2026` : "2026"}
          </button>
        ))}
      </div>

      {goals.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brown">Progress</p>
            <span className="text-sm text-terracotta font-semibold">{completedCount}/{goals.length}</span>
          </div>
          <div className="h-2 bg-cream-darker rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${goals.length ? (completedCount / goals.length) * 100 : 0}%`, background: "linear-gradient(90deg, #c47a5e, #d68d84)" }} />
          </div>
        </Card>
      )}

      {CATEGORIES.map(({ key, label, icon, color }) => {
        const catGoals = goals.filter((g) => g.category === key);
        if (catGoals.length === 0) return null;
        return (
          <Card key={key}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{icon}</span>
              <h3 className="font-serif text-lg text-brown">{label}</h3>
            </div>
            <div className="space-y-2">
              {catGoals.map((goal) => (
                <div key={goal.id} className="flex items-start gap-3 group">
                  <button
                    onClick={() => toggleGoal(goal.id)}
                    className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${goal.done ? "border-transparent" : "border-sand hover:border-terracotta"}`}
                    style={goal.done ? { background: color, borderColor: color } : {}}
                  >
                    {goal.done && <Check size={11} className="text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${goal.done ? "line-through text-sand-dark" : "text-brown"}`}>{goal.text}</p>
                    {goal.notes && <p className="text-xs text-sand-dark italic">{goal.notes}</p>}
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {goals.length === 0 && (
        <Card>
          <p className="text-sand-dark text-sm text-center py-6">No goals set for {activeTab === "quarterly" ? "this quarter" : "this year"} yet. What do you want to create? 🌱</p>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a Goal">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Goal</label>
            <textarea rows={2} placeholder="What do you want to achieve?" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setForm({ ...form, category: cat.key })}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-sm border transition-all text-left ${form.category === cat.key ? "border-terracotta bg-terracotta/10" : "border-sand hover:border-sand-dark"}`}
                >
                  <span>{cat.icon}</span>
                  <span className="text-brown text-xs">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes (optional)</label>
            <input type="text" placeholder="Why does this matter?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addGoal}>Add Goal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
