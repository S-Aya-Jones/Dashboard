"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Star, Search, Plus, Trash2 } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { today as todayStr, id } from "@/lib/utils";
import { celebrate } from "@/lib/confetti";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function WinsView({ data, update }: Props) {
  const [search, setSearch] = useState("");
  const [newWin, setNewWin] = useState("");
  const today = todayStr();

  const filtered = [...data.wins]
    .reverse()
    .filter((w) => !search || w.text.toLowerCase().includes(search.toLowerCase()) || w.date.includes(search));

  const addWin = async () => {
    if (!newWin.trim()) return;
    update((d) => ({ ...d, wins: [...d.wins, { id: id(), date: today, text: newWin.trim() }] }));
    setNewWin("");
    await celebrate();
  };

  const deleteWin = (wid: string) => {
    update((d) => ({ ...d, wins: d.wins.filter((w) => w.id !== wid) }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-4xl text-brown">Wins Jar ⭐</h1>
        <p className="text-sand-dark mt-1">When anxiety lies to you, scroll here. Evidence of your greatness.</p>
      </div>

      <Card>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Today's win, big or small…"
            value={newWin}
            onChange={(e) => setNewWin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWin(); }}
            className="flex-1"
          />
          <Button onClick={addWin}>
            <Plus size={14} className="mr-1 inline" /> Add Win
          </Button>
        </div>
        <p className="text-xs text-sand-dark mt-2">{data.wins.length} wins logged total ✨</p>
      </Card>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand" />
        <input
          type="text"
          placeholder="Search your wins…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <p className="text-sand-dark text-sm text-center py-4">
              {search ? "No wins match that search." : "No wins yet — add your first! You already have some. 🌟"}
            </p>
          </Card>
        ) : (
          filtered.map((win) => (
            <div key={win.id} className="card p-4 flex items-start gap-3 group hover:shadow-card-hover transition-shadow">
              <Star size={15} className="text-terracotta mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-brown leading-relaxed">{win.text}</p>
                <p className="text-xs text-sand-dark mt-1">{format(parseISO(win.date), "EEEE, MMMM d, yyyy")}</p>
              </div>
              <button onClick={() => deleteWin(win.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
