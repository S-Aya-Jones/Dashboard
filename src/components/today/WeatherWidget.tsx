"use client";

import { useEffect, useState } from "react";
import { WeatherIcon, wxFromCode } from "@/components/ui/WeatherIcon";

interface WeatherData {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const temp  = Math.round(data.current.temperature_2m);
  const cur   = wxFromCode(data.current.weather_code);
  const daily = wxFromCode(data.daily.weather_code[0]);
  const high  = Math.round(data.daily.temperature_2m_max[0]);
  const low   = Math.round(data.daily.temperature_2m_min[0]);
  const rainy = data.daily.weather_code[0] >= 51;

  const tip = rainy     ? "Bring an umbrella"
            : temp < 50 ? "Layer up"
            : temp > 85 ? "Hydrate"
            : null;

  return (
    <div
      className="card px-4 py-3 flex-shrink-0 text-right"
      style={{ minWidth: "155px" }}
    >
      <div className="flex items-center justify-end gap-2 mb-0.5">
        <span className="font-serif text-3xl text-brown leading-none">{temp}°</span>
        <WeatherIcon kind={cur.kind} size={26} className="text-sand-dark" />
      </div>
      <p className="text-xs text-brown">{daily.label}</p>
      <p className="text-xs text-sand-dark">↑{high}° &nbsp;↓{low}°</p>
      {tip && (
        <p className="text-xs text-terracotta font-medium mt-1.5">{tip}</p>
      )}
    </div>
  );
}
