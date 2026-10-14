import { NextRequest, NextResponse } from "next/server";
import { places, setPlace, progressRows, logRep, buildTracks } from "@/lib/driving";

export const dynamic = "force-dynamic";

// The three ladders, their progress, and her two saved addresses.
//
// Addresses are stored here rather than in the repository, which is public. A
// home address is not a thing to commit.

export async function GET() {
  try {
    const [placeList, state] = await Promise.all([places(), progressRows()]);
    return NextResponse.json({
      places: placeList,
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
      const { key, label, address } = body.place;
      if (typeof key !== "string" || typeof address !== "string" || !address.trim()) {
        return NextResponse.json({ error: "key and address are required" }, { status: 400 });
      }
      await setPlace(key, String(label ?? key), address.trim());
    }

    if (typeof body.rung === "string") {
      const peak = typeof body.peak === "number" ? body.peak : null;
      await logRep(body.rung, peak);
    }

    const [placeList, state] = await Promise.all([places(), progressRows()]);
    return NextResponse.json({ ok: true, places: placeList, tracks: buildTracks(state, placeList) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
