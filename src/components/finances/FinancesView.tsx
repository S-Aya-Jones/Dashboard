"use client";

import { useState } from "react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function FinancesView({ data, update }: Props) {
  const [cardOpen, setCardOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ name: "", balance: 0, limit: 0, targetPayoff: "" });
  const [savingsForm, setSavingsForm] = useState({ name: "", current: 0, target: 0, deadline: "" });

  const totalDebt = data.creditCards.reduce((s, c) => s + c.balance, 0);
  const totalSavings = data.savingsGoals.reduce((s, g) => s + g.current, 0);

  const addCard = () => {
    if (!cardForm.name.trim()) return;
    update((d) => ({ ...d, creditCards: [...d.creditCards, { ...cardForm, id: id() }] }));
    setCardForm({ name: "", balance: 0, limit: 0, targetPayoff: "" });
    setCardOpen(false);
  };

  const addSavings = () => {
    if (!savingsForm.name.trim()) return;
    update((d) => ({ ...d, savingsGoals: [...d.savingsGoals, { ...savingsForm, id: id() }] }));
    setSavingsForm({ name: "", current: 0, target: 0, deadline: "" });
    setSavingsOpen(false);
  };

  const updateCardBalance = (cid: string, val: number) => {
    update((d) => ({ ...d, creditCards: d.creditCards.map((c) => c.id === cid ? { ...c, balance: val } : c) }));
  };

  const updateSavingsCurrent = (gid: string, val: number) => {
    update((d) => ({ ...d, savingsGoals: d.savingsGoals.map((g) => g.id === gid ? { ...g, current: val } : g) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Finances</h1>
          <p className="text-sand-dark mt-1">Quarterly view — building security, one step at a time 💚</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSavingsOpen(true)}>+ Savings Goal</Button>
          <Button onClick={() => setCardOpen(true)}>+ Credit Card</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="font-serif text-3xl text-brown">${totalDebt.toLocaleString()}</p>
          <p className="text-xs text-sand-dark mt-1">Total credit card debt</p>
        </Card>
        <Card className="text-center">
          <p className="font-serif text-3xl text-sage">${totalSavings.toLocaleString()}</p>
          <p className="text-xs text-sand-dark mt-1">Total saved</p>
        </Card>
      </div>

      {data.creditCards.length > 0 && (
        <Card title="Credit Cards" subtitle="Progress toward payoff">
          <div className="space-y-4 mt-2">
            {data.creditCards.map((card) => {
              const pct = card.limit > 0 ? Math.round((card.balance / card.limit) * 100) : 0;
              return (
                <div key={card.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brown">{card.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sand-dark">{pct}% used</span>
                      <input
                        type="number" min={0} value={card.balance}
                        onChange={(e) => updateCardBalance(card.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6"
                      />
                    </div>
                  </div>
                  <div className="h-2.5 bg-cream-darker rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct > 80 ? "#d68d84" : pct > 50 ? "#c47a5e" : "#7a816c"
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-sand-dark">
                    <span>${card.balance.toLocaleString()} balance</span>
                    <span>${card.limit.toLocaleString()} limit</span>
                  </div>
                  {card.targetPayoff && <p className="text-xs text-terracotta">Target payoff: {card.targetPayoff}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {data.savingsGoals.length > 0 && (
        <Card title="Savings Goals">
          <div className="space-y-4 mt-2">
            {data.savingsGoals.map((goal) => {
              const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brown">{goal.name}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} value={goal.current}
                        onChange={(e) => updateSavingsCurrent(goal.id, Number(e.target.value))}
                        className="w-24 text-right text-xs p-1 h-6"
                      />
                      <span className="text-xs text-sage font-medium">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-cream-darker rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7a816c, #8e967d)" }} />
                  </div>
                  <div className="flex justify-between text-xs text-sand-dark">
                    <span>${goal.current.toLocaleString()} saved</span>
                    <span>Goal: ${goal.target.toLocaleString()}</span>
                  </div>
                  {goal.deadline && <p className="text-xs text-terracotta">By: {goal.deadline}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="Add Credit Card">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Card Name</label>
            <input type="text" placeholder="e.g. Chase Sapphire" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current Balance ($)</label>
              <input type="number" min={0} value={cardForm.balance} onChange={(e) => setCardForm({ ...cardForm, balance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Credit Limit ($)</label>
              <input type="number" min={0} value={cardForm.limit} onChange={(e) => setCardForm({ ...cardForm, limit: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Target payoff date (optional)</label>
            <input type="text" placeholder="e.g. December 2025" value={cardForm.targetPayoff} onChange={(e) => setCardForm({ ...cardForm, targetPayoff: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={addCard}>Add Card</Button>
          </div>
        </div>
      </Modal>

      <Modal open={savingsOpen} onClose={() => setSavingsOpen(false)} title="Add Savings Goal">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Goal Name</label>
            <input type="text" placeholder="e.g. Emergency Fund, Vacation" value={savingsForm.name} onChange={(e) => setSavingsForm({ ...savingsForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Current Amount ($)</label>
              <input type="number" min={0} value={savingsForm.current} onChange={(e) => setSavingsForm({ ...savingsForm, current: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Target Amount ($)</label>
              <input type="number" min={0} value={savingsForm.target} onChange={(e) => setSavingsForm({ ...savingsForm, target: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Deadline (optional)</label>
            <input type="text" placeholder="e.g. Q2 2026" value={savingsForm.deadline} onChange={(e) => setSavingsForm({ ...savingsForm, deadline: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setSavingsOpen(false)}>Cancel</Button>
            <Button onClick={addSavings}>Add Goal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
