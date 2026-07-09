"use client";

import { useEffect, useState } from "react";

interface HourlyData {
  hourly: { time: string[]; temperature_2m: number[]; uv_index: number[] };
}

function uvMeta(uv: number) {
  const u = Math.round(uv);
  if (u <= 2) return { color: "#5BD9A0", advice: "Safe" };
  if (u <= 5) return { color: "#F2C879", advice: "Wear SPF" };
  if (u <= 7) return { color: "#F2845B", advice: "Limit time" };
  return { color: "#E8559A", advice: "Stay inside" };
}

function fmtHour(h: number) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export function NextHoursStrip() {
  const [data, setData] = useState<HourlyData | null>(null);

  useEffect(() => {
    fetch("/api/weather").then((r) => r.json()).then((d) => { if (!d.error && d.hourly) setData(d); }).catch(() => {});
  }, []);

  if (!data) return null;
  const currentHour = new Date().getHours();
  const hours = data.hourly.time
    .map((t, i) => ({ hour: parseInt(t.slice(11, 13), 10), temp: Math.round(data.hourly.temperature_2m[i]), uv: data.hourly.uv_index[i] }))
    .filter((h) => h.hour > currentHour)
    .slice(0, 3);

  if (hours.length === 0) return null;

  return (
    <div className="glass p-4">
      <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>NEXT 3 HOURS</p>
      <div className="flex gap-2 mt-2">
        {hours.map((h) => {
          const meta = uvMeta(h.uv);
          return (
            <div key={h.hour} className="flex-1 rounded-xl p-2 text-center" style={{ background: "var(--aya-glass-bg)" }}>
              <p className="text-[10px]" style={{ color: "var(--aya-text-faint)" }}>{fmtHour(h.hour)}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--aya-text)" }}>{h.temp}°</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: meta.color }}>UV {Math.round(h.uv)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HourlyUVChart() {
  const [data, setData] = useState<HourlyData | null>(null);

  useEffect(() => {
    fetch("/api/weather").then((r) => r.json()).then((d) => { if (!d.error && d.hourly) setData(d); }).catch(() => {});
  }, []);

  if (!data) return null;
  const currentHour = new Date().getHours();
  const hours = data.hourly.time
    .map((t, i) => ({ hour: parseInt(t.slice(11, 13), 10), temp: Math.round(data.hourly.temperature_2m[i]), uv: data.hourly.uv_index[i] }))
    .filter((h) => h.hour >= 6 && h.hour <= 20);

  return (
    <div className="glass p-5 mx-1">
      <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>TODAY · HOUR BY HOUR</p>
      <div className="overflow-x-auto -mx-1 mt-3">
        <div className="flex gap-1.5 pb-1 min-w-max px-1">
          {hours.map((h) => {
            const meta = uvMeta(h.uv);
            const isNow = h.hour === currentHour;
            const isPast = h.hour < currentHour;
            return (
              <div key={h.hour} className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl min-w-[58px]"
                style={{ background: isNow ? "rgba(232,85,154,0.14)" : "var(--aya-glass-bg)", opacity: isPast ? 0.4 : 1, border: isNow ? "1px solid rgba(232,85,154,0.4)" : "1px solid transparent" }}>
                <span className="text-[10px] font-semibold" style={{ color: isNow ? "var(--aya-magenta)" : "var(--aya-text-faint)" }}>{isNow ? "Now" : fmtHour(h.hour)}</span>
                <span className="aya-serif text-lg" style={{ color: "var(--aya-text)" }}>{h.temp}°</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${meta.color}26`, color: meta.color }}>UV {Math.round(h.uv)}</span>
                <span className="text-[9px] text-center leading-tight" style={{ color: "var(--aya-text-faint)" }}>{meta.advice}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
