"use client";

import { dateAfter, dateLabel } from "@/lib/whenText";

interface Props {
  cashBalance:   number;
  avgDailySpend: number;
}

function state(days: number) {
  if (days >= 60) return { label: "Cozy",   color: "#71816D", ring: "#D3DAD2" };
  if (days >= 30) return { label: "Steady", color: "#71816D", ring: "#D3DAD2" };
  if (days >= 14) return { label: "Watch",  color: "#C99A5C", ring: "#E8D4B0" };
  return            { label: "Tight",  color: "#DA667B", ring: "#EDD0D7" };
}

export function RunwayGauge({ cashBalance, avgDailySpend }: Props) {
  if (avgDailySpend <= 0 || cashBalance <= 0) return null;

  const days = Math.min(Math.round(cashBalance / avgDailySpend), 999);
  const s    = state(days);
  const pct  = Math.min((days / 90) * 100, 100);

  // The date the money runs out answers the question directly; a day count
  // just makes you find a calendar.
  const through = days >= 999 ? null : dateLabel(dateAfter(days));

  return (
    <div className="card p-4" style={{ borderLeft: `3px solid ${s.color}` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-serif text-lg text-brown">Cash Runway</p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: s.ring, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      <p className="font-serif text-3xl text-brown mb-0.5">
        {through ? `Covered through ${through}` : "Covered well past 90 days"}
      </p>
      <p className="text-xs text-sand-dark mb-3">
        ${avgDailySpend.toFixed(0)}/day pace · ${Math.round(cashBalance).toLocaleString()} available
      </p>

      <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: s.color }}
        />
      </div>
    </div>
  );
}
