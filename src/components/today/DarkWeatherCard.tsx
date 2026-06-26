"use client";

import { useEffect, useState } from "react";
import { Droplet, Sun, Cloud, CloudRain, CloudSnow, CloudFog } from "lucide-react";

interface WeatherData {
  current: { temperature_2m: number; weather_code: number };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
}

function wx(code: number) {
  if (code === 0) return { label: "Clear skies", Icon: Sun };
  if (code <= 2) return { label: "Partly cloudy", Icon: Cloud };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if (code <= 48) return { label: "Foggy", Icon: CloudFog };
  if (code <= 65) return { label: "Rain today", Icon: CloudRain };
  if (code <= 77) return { label: "Snow expected", Icon: CloudSnow };
  return { label: "Showers", Icon: CloudRain };
}

export function DarkWeatherCard() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const temp = Math.round(data.current.temperature_2m);
  const daily = wx(data.daily.weather_code[0]);
  const high = Math.round(data.daily.temperature_2m_max[0]);
  const low = Math.round(data.daily.temperature_2m_min[0]);
  const rainy = data.daily.weather_code[0] >= 51;
  const tip = rainy ? "Bring an umbrella" : temp > 85 ? "Hydrate" : temp < 50 ? "Layer up" : null;

  return (
    <div className="glass p-5 min-w-[200px]">
      <div className="flex items-center gap-2.5">
        <span className="aya-serif text-5xl" style={{ color: "var(--aya-text)" }}>{temp}°</span>
        <daily.Icon size={28} style={{ color: "var(--aya-gold)" }} />
      </div>
      <p className="text-sm mt-1.5" style={{ color: "var(--aya-text-muted)" }}>{daily.label}</p>
      <p className="text-sm" style={{ color: "var(--aya-text-faint)" }}>
        High <span style={{ color: "var(--aya-coral)" }}>{high}°</span> · Low <span style={{ color: "var(--aya-cyan)" }}>{low}°</span>
      </p>
      {tip && (
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(91,201,217,0.15)", color: "var(--aya-cyan)" }}>
          <Droplet size={12} /> {tip}
        </div>
      )}
    </div>
  );
}
