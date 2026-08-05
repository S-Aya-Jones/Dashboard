import { getAppKey } from "@/lib/appkeys";

// Real routing via the Google Directions API.
//
// Google has no "avoid bridges" parameter, so instead of pretending, we ask
// for several route alternatives, read the actual turn-by-turn steps, and
// detect bridges and interstates by name. A route she can trust is one where
// the detector found none — and she can still verify before driving it.

export interface RouteStep {
  instruction: string;
  distanceText: string;
  road: string;
}

export interface RouteOption {
  summary: string;
  distanceText: string;
  durationText: string;
  durationMin: number;
  bridges: string[];
  highways: string[];
  clean: boolean;          // no bridges and no interstates detected
  steps: RouteStep[];
  mapsUrl: string;
}

const BRIDGE_RE = /\b(bridge|viaduct|overpass|causeway)\b/i;
const HIGHWAY_RE = /\b(I-\d+|Interstate\s*\d+|US-\d+|Hwy|Freeway|Expressway|Pkwy\s*E?xpress)\b/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function getMapsKey(): Promise<string | null> {
  return getAppKey("GOOGLE_MAPS_API_KEY");
}

export function directionsUrl(origin: string, destination: string, avoidHighways: boolean): string {
  const p = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (avoidHighways) p.set("avoid", "highways|ferries|tolls");
  return `https://www.google.com/maps/dir/?${p}`;
}

export async function planRoutes(
  origin: string,
  destination: string,
  opts: { avoidHighways?: boolean; departAt?: string } = {},
): Promise<{ routes: RouteOption[]; error?: string }> {
  const key = await getMapsKey();
  if (!key) return { routes: [], error: "NO_MAPS_KEY" };

  const params = new URLSearchParams({
    origin, destination, mode: "driving", alternatives: "true", key,
  });
  if (opts.avoidHighways !== false) params.set("avoid", "highways|ferries|tolls");
  if (opts.departAt) {
    const t = Math.floor(new Date(opts.departAt).getTime() / 1000);
    if (!isNaN(t) && t > Date.now() / 1000) params.set("departure_time", String(t));
  }

  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  if (!res.ok) return { routes: [], error: `Google Directions ${res.status}` };
  const data = await res.json();

  if (data.status === "REQUEST_DENIED") {
    return { routes: [], error: data.error_message ?? "Google denied the request — check the key has the Directions API enabled." };
  }
  if (data.status === "ZERO_RESULTS") return { routes: [], error: "No driving route found between those addresses." };
  if (data.status !== "OK") return { routes: [], error: `Google returned ${data.status}` };

  const routes: RouteOption[] = (data.routes ?? []).map((r: Record<string, unknown>) => {
    const leg = (r.legs as Array<Record<string, unknown>>)?.[0] ?? {};
    const rawSteps = (leg.steps as Array<Record<string, unknown>>) ?? [];

    const steps: RouteStep[] = rawSteps.map(s => {
      const instruction = stripTags(String(s.html_instructions ?? ""));
      const road = instruction.replace(/^(Turn|Continue|Head|Merge|Take|Keep|Slight|Exit)\b.*?\bonto\b\s*/i, "");
      return {
        instruction,
        distanceText: String((s.distance as Record<string, unknown>)?.text ?? ""),
        road,
      };
    });

    const haystack = steps.map(s => s.instruction).join(" | ") + " | " + String(r.summary ?? "");

    const bridges = Array.from(new Set(
      steps.filter(s => BRIDGE_RE.test(s.instruction))
        .map(s => (s.instruction.match(/([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)*\s+(?:Bridge|Viaduct|Overpass|Causeway))/) ?? [])[1] ?? "unnamed bridge")
    ));

    const highways = Array.from(new Set(
      (haystack.match(/\b(I-\d+[A-Z]?|Interstate\s*\d+|US-\d+)\b/gi) ?? []).map(h => h.trim())
    ));

    const durationMin = Math.round(Number((leg.duration as Record<string, unknown>)?.value ?? 0) / 60);

    return {
      summary: String(r.summary ?? "route"),
      distanceText: String((leg.distance as Record<string, unknown>)?.text ?? ""),
      durationText: String((leg.duration as Record<string, unknown>)?.text ?? ""),
      durationMin,
      bridges,
      highways,
      clean: bridges.length === 0 && highways.length === 0,
      steps,
      mapsUrl: directionsUrl(origin, destination, opts.avoidHighways !== false),
    };
  });

  // Bridge-free and interstate-free routes first, then shortest
  routes.sort((a, b) =>
    (a.clean === b.clean ? a.durationMin - b.durationMin : a.clean ? -1 : 1));

  return { routes };
}
