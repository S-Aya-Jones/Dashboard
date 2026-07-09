"use client";

import { useEffect, useState } from "react";

interface HourlyData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    uv_index: number[];
    apparent_temperature: number[];
  };
}

function uvColor(uv: number): string {
  if (uv <= 2) return "#5BD9A0";
  if (uv <= 5) return "#F2C879";
  if (uv <= 7) return "#F2845B";
  return "#E8559A";
}

export function UVArcCard() {
  const [data, setData] = useState<HourlyData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.hourly) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const currentHour = new Date().getHours();
  const points = data.hourly.time
    .map((t, i) => ({ hour: parseInt(t.slice(11, 13), 10), uv: data.hourly.uv_index[i] }))
    .filter((p) => p.hour >= 8 && p.hour <= 20);

  if (points.length === 0) return null;

  const w = 560, h = 180, padX = 24, padY = 28;
  const maxUv = Math.max(8, ...points.map((p) => p.uv));
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - padX * 2);
  const y = (uv: number) => h - padY - (uv / maxUv) * (h - padY * 2);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.uv)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${h - padY} L ${x(0)} ${h - padY} Z`;

  const peak = points.reduce((m, p) => (p.uv > m.uv ? p : m), points[0]);
  const peakIdx = points.indexOf(peak);
  const nowIdx = points.findIndex((p) => p.hour === currentHour);
  const nowPoint = nowIdx >= 0 ? points[nowIdx] : null;

  const fmtHour = (hour: number) => (hour === 12 ? "12p" : hour > 12 ? `${hour - 12}p` : `${hour}a`);

  return (
    <div className="glass p-5">
      <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--aya-text-faint)" }}>TODAY · SUN &amp; SKIN</p>
      <h3 className="aya-serif text-2xl mt-1" style={{ color: "var(--aya-text)" }}>The day&apos;s UV arc</h3>
      <p className="text-sm mt-1" style={{ color: "var(--aya-text-muted)" }}>
        How high the sun climbs is how hard the UV hits.{" "}
        {nowPoint && nowIdx > peakIdx ? "You're past the peak." : nowPoint && nowIdx < peakIdx ? "You're heading toward the peak." : ""}
      </p>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full mt-3" style={{ maxHeight: 200 }}>
        <defs>
          <linearGradient id="uvAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8559A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E8559A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="uvLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5BD9A0" />
            <stop offset="40%" stopColor="#F2C879" />
            <stop offset="70%" stopColor="#F2845B" />
            <stop offset="100%" stopColor="#E8559A" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#uvAreaGrad)" />
        <path d={linePath} fill="none" stroke="url(#uvLineGrad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* peak label */}
        <line x1={x(peakIdx)} y1={y(peak.uv)} x2={x(peakIdx)} y2={h - padY} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
        <text x={x(peakIdx)} y={y(peak.uv) - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#F2845B">
          PEAK · UV {Math.round(peak.uv)} · {fmtHour(peak.hour)}
        </text>

        {/* now marker */}
        {nowPoint && (
          <g>
            <line x1={x(nowIdx)} y1={y(nowPoint.uv)} x2={x(nowIdx)} y2={h - padY} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            <text x={x(nowIdx)} y={y(nowPoint.uv) - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#F2C879">
              NOW · UV {Math.round(nowPoint.uv)}
            </text>
            <circle cx={x(nowIdx)} cy={y(nowPoint.uv)} r={5} fill={uvColor(nowPoint.uv)} className="sun-core" />
          </g>
        )}

        {points.filter((_, i) => i % 3 === 0).map((p, i) => (
          <text key={i} x={x(points.indexOf(p))} y={h - 6} textAnchor="middle" fontSize="10" fill="rgba(245,241,251,0.4)">
            {fmtHour(p.hour)}
          </text>
        ))}
      </svg>
    </div>
  );
}
