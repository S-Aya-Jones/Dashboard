import { NextRequest, NextResponse } from "next/server";
import { planRoutes } from "@/lib/directions";
import { setAppKey, appKeyStatus } from "@/lib/appkeys";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await appKeyStatus("GOOGLE_MAPS_API_KEY"));
}

// Save the Maps key from the app — verified against Google before storing
export async function PUT(req: NextRequest) {
  try {
    const { key } = await req.json();
    const trimmed = typeof key === "string" ? key.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "Paste your key first." }, { status: 400 });

    const test = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=Nashville,TN&destination=Memphis,TN&key=${encodeURIComponent(trimmed)}`
    ).then(r => r.json()).catch(() => null);

    if (!test || test.status === "REQUEST_DENIED") {
      return NextResponse.json(
        { error: test?.error_message ?? "Google rejected that key. Make sure the Directions API is enabled for it." },
        { status: 400 },
      );
    }
    await setAppKey("GOOGLE_MAPS_API_KEY", trimmed);
    return NextResponse.json({ ok: true, ...(await appKeyStatus("GOOGLE_MAPS_API_KEY")) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, avoidHighways, departAt } = await req.json();
    if (!origin || !destination) {
      return NextResponse.json({ error: "origin and destination required" }, { status: 400 });
    }
    const result = await planRoutes(origin, destination, { avoidHighways, departAt });
    if (result.error === "NO_MAPS_KEY") {
      return NextResponse.json({ error: "NO_MAPS_KEY" }, { status: 400 });
    }
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ routes: result.routes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
