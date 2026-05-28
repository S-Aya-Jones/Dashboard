"use client";

interface Props {
  cashBalance:   number;
  avgDailySpend: number;
}

function state(days: number) {
  if (days >= 60) return { label: "Cozy",   icon: "☀️", color: "#71816D", ring: "#D3DAD2" };
  if (days >= 30) return { label: "Steady", icon: "🌿", color: "#71816D", ring: "#D3DAD2" };
  if (days >= 14) return { label: "Watch",  icon: "🌅", color: "#C99A5C", ring: "#E8D4B0" };
  return            { label: "Tight",  icon: "🔥", color: "#DA667B", ring: "#EDD0D7" };
}

export function RunwayGauge({ cashBalance, avgDailySpend }: Props) {
  if (avgDailySpend <= 0 || cashBalance <= 0) return null;

  const days = Math.min(Math.round(cashBalance / avgDailySpend), 999);
  const s    = state(days);
  const pct  = Math.min((days / 90) * 100, 100);

  return (
    <div className="card p-4" style={{ borderLeft: `3px solid ${s.color}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{s.icon}</span>
          <p className="font-serif text-lg text-brown">Cash Runway</p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: s.ring, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      <p className="font-serif text-3xl text-brown mb-0.5">{days} days</p>
      <p className="text-xs text-sand-dark mb-3">
        ${avgDailySpend.toFixed(0)}/day pace · ${Math.round(cashBalance).toLocaleString()} available
      </p>

      <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: s.color }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-sand-dark mt-1 px-0.5">
        <span>0</span><span>30d</span><span>60d</span><span>90d+</span>
      </div>
    </div>
  );
}
