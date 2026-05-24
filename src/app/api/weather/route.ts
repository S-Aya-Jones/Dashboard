import { NextResponse } from "next/server";

const OPEN_METEO =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=36.1627&longitude=-86.7816" +
  "&current=temperature_2m,weather_code" +
  "&daily=temperature_2m_max,temperature_2m_min,weather_code" +
  "&temperature_unit=fahrenheit&timezone=America/Chicago";

// Cache at the Next.js layer for 15 minutes
export const revalidate = 900;

export async function GET() {
  try {
    const res = await fetch(OPEN_METEO, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error("upstream error");
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: true }, { status: 503 });
  }
}
