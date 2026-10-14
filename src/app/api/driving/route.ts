import { NextRequest, NextResponse } from "next/server";
import { places, setPlace, removePlace, progressRows, logRep, buildTracks, routePair } from "@/lib/driving";

export const dynamic = "force-dynamic";

// The three ladders, their progress, and her two saved addresses.
//
// Addresses are stored here rather than in the repository, which is public. A
// home address is not a thing to commit.

/**
 * Each saved destination with both routes from home.
 *
 * Returned together so the page can show the pair side by side: the same trip
 * avoiding interstates, and the same trip not avoiding them. That difference is
 * the ladder.
 */
function destinationRoutes(placeList: Awaited<ReturnType<typeof places>>) {
  const home = placeList.find(p => p.key === "home");
  if (!home) return [];
  return placeList
    .filter(p => p.kind === "destination")
    .map(p => ({ key: p.key, label: p.label, ...routePair(home.address, p.address) }));
}

export async function GET() {
  try {
    const [placeList, state] = await Promise.all([places(), progressRows()]);
    return NextResponse.json({
      places: placeList,
      destinations: destinationRoutes(placeList),
      tracks: buildTracks(state, placeList),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.place) {
      const { key, label, address, kind } = body.place;
      if (typeof key !== "string" || typeof address !== "string" || !address.trim()) {
        return NextResponse.json({ error: "key and address are required" }, { status: 400 });
      }
      await setPlace(key, String(label ?? key), address.trim(), kind === "destination" ? "destination" : "anchor");
    }

    if (typeof body.removeKey === "string") await removePlace(body.removeKey);

    if (typeof body.rung === "string") {
      const peak = typeof body.peak === "number" ? body.peak : null;
      await logRep(body.rung, peak);
    }

    const [placeList, state] = await Promise.all([places(), progressRows()]);
    return NextResponse.json({
      ok: true,
      places: placeList,
      destinations: destinationRoutes(placeList),
      tracks: buildTracks(state, placeList),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
