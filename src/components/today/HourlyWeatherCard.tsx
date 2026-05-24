"use client";

import { useEffect, useRef, useState } from "react";

interface HourlyData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    uv_index: number[];
    apparent_temperature: number[];
  };
}

function uvInfo(uv: number): { label: string; bg: string; fg: string; icon: string; advice: string } {
  const u = Math.round(uv);
  if (u <= 2)  return { label: `UV ${u}`, bg: "#e6f4ea", fg: "#2d6a4f", icon: "✓",  advice: "Safe to walk" };
  if (u <= 5)  return { label: `UV ${u}`, bg: "#fff8e1", fg: "#b45309", icon: "🧴", advice: "Wear SPF" };
  if (u <= 7)  return { label: `UV ${u}`, bg: "#fff0e0", fg: "#c2410c", icon: "⚠️", advice: "Limit time" };
  return            { label: `UV ${u}`, bg: "#fde8e8", fg: "#b91c1c", icon: "🔥", advice: "Stay inside" };
}

function fmtHour(h: number) {
  if (h === 0)  return "12 AM";
  if (h < 12)   return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export function HourlyWeatherCard() {
  const [data, setData] = useState<HourlyData | null>(null);
  const nowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.hourly) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [data]);

  if (!data) return null;

  const currentHour = new Date().getHours();

  const hours = data.hourly.time
    .map((t, i) => {
      const hour = parseInt(t.slice(11, 13), 10);
      return {
        hour,
        temp: Math.round(data.hourly.temperature_2m[i]),
        feel: Math.round(data.hourly.apparent_temperature[i]),
        uv: data.hourly.uv_index[i],
        isNow: hour === currentHour,
        isPast: hour < currentHour,
      };
    })
    .filter((h) => h.hour >= 6 && h.hour <= 20);

  return (
    <div className="card px-4 py-3">
      <h3 className="text-xs font-medium text-sand-dark uppercase tracking-wide mb-3">
        Today Hour by Hour
      </h3>

      <div className="overflow-x-auto -mx-1">
        <div className="flex gap-1 pb-1 min-w-max px-1">
          {hours.map((h) => {
            const uv = uvInfo(h.uv);
            return (
              <div
                key={h.hour}
                ref={h.isNow ? nowRef : undefined}
                className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl min-w-[62px] transition-colors ${
                  h.isNow
                    ? "bg-terracotta/10 ring-1 ring-terracotta/30"
                    : h.isPast
                    ? "opacity-35"
                    : "hover:bg-cream-darker"
                }`}
              >
                <span
                  className={`text-[11px] font-semibold ${
                    h.isNow ? "text-terracotta" : "text-sand-dark"
                  }`}
                >
                  {h.isNow ? "Now" : fmtHour(h.hour)}
                </span>

                <span className="font-serif text-xl text-brown leading-none">{h.temp}°</span>

                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap"
                  style={{ background: uv.bg, color: uv.fg }}
                >
                  {uv.label}
                </span>

                <span className="text-sm leading-none" title={uv.advice}>
                  {uv.icon}
                </span>

                <span className="text-[10px] text-sand-dark text-center leading-tight">
                  {uv.advice}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-2.5 pt-2 border-t border-sand/30 flex-wrap">
        {[
          { bg: "#e6f4ea", fg: "#2d6a4f", label: "UV 0–2 · safe" },
          { bg: "#fff8e1", fg: "#b45309", label: "UV 3–5 · wear SPF" },
          { bg: "#fff0e0", fg: "#c2410c", label: "UV 6–7 · limit time" },
          { bg: "#fde8e8", fg: "#b91c1c", label: "UV 8+ · stay inside" },
        ].map((l) => (
          <span key={l.label} className="text-[10px] flex items-center gap-1" style={{ color: l.fg }}>
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: l.bg, outline: `1px solid ${l.fg}` }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
