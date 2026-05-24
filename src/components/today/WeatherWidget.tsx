"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

// WMO weather interpretation codes → icon + label
function wx(code: number): { icon: string; label: string } {
  if (code === 0)  return { icon: "☀️",  label: "Clear skies" };
  if (code <= 2)   return { icon: "⛅",  label: "Partly cloudy" };
  if (code === 3)  return { icon: "☁️",  label: "Overcast" };
  if (code <= 48)  return { icon: "🌫️", label: "Foggy" };
  if (code <= 55)  return { icon: "🌦️", label: "Light drizzle" };
  if (code <= 65)  return { icon: "🌧️", label: "Rain today" };
  if (code <= 77)  return { icon: "❄️",  label: "Snow expected" };
  if (code <= 82)  return { icon: "🌦️", label: "Rain showers" };
  return               { icon: "⛈️",  label: "Thunderstorms" };
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
  const cur   = wx(data.current.weather_code);
  const daily = wx(data.daily.weather_code[0]);
  const high  = Math.round(data.daily.temperature_2m_max[0]);
  const low   = Math.round(data.daily.temperature_2m_min[0]);
  const rainy = data.daily.weather_code[0] >= 51;

  const tip = rainy        ? "🌂 Bring an umbrella"
            : temp < 50    ? "🧥 Layer up"
            : temp > 85    ? "💧 Hydrate"
            : null;

  return (
    <div
      className="card px-4 py-3 flex-shrink-0 text-right"
      style={{ minWidth: "155px" }}
    >
      <div className="flex items-center justify-end gap-2 mb-0.5">
        <span className="font-serif text-3xl text-brown leading-none">{temp}°</span>
        <span className="text-2xl leading-none">{cur.icon}</span>
      </div>
      <p className="text-xs text-brown">{daily.label}</p>
      <p className="text-xs text-sand-dark">↑{high}° &nbsp;↓{low}°</p>
      {tip && (
        <p className="text-xs text-terracotta font-medium mt-1.5">{tip}</p>
      )}
    </div>
  );
}
