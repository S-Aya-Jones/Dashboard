import { NextRequest, NextResponse } from "next/server";
import { getMapsKey } from "@/lib/directions";

export const dynamic = "force-dynamic";

// Address suggestions as you type, using the same Maps key.
// Needs the "Places API" enabled alongside Directions.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const key = await getMapsKey();
  if (!key) return NextResponse.json({ suggestions: [], error: "NO_MAPS_KEY" });

  const params = new URLSearchParams({
    input: q,
    key,
    components: "country:us",
    // Bias toward Nashville so local results come first
    location: "36.1627,-86.7816",
    radius: "60000",
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { cache: "no-store" },
    );
    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      return NextResponse.json({
        suggestions: [],
        error: "PLACES_NOT_ENABLED",
        detail: data.error_message ?? "",
      });
    }
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ suggestions: [], error: data.status });
    }

    const suggestions = (data.predictions ?? []).slice(0, 6).map((p: Record<string, unknown>) => {
      const f = (p.structured_formatting ?? {}) as Record<string, string>;
      return {
        description: String(p.description ?? ""),
        main: f.main_text ?? String(p.description ?? ""),
        secondary: f.secondary_text ?? "",
      };
    });
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json({ suggestions: [], error: String(e) });
  }
}
