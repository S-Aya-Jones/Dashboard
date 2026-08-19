import { NextRequest, NextResponse } from "next/server";
import {
  seedLadderIfEmpty, getLadder, addStep, updateStep, deleteStep,
  getRoutes, addRoute, deleteRoute, markRouteDriven,
  logSession, getSessions, saveCheckin, getCheckins, exposureStats,
  getPlaces, addPlace, deletePlace,
} from "@/lib/exposure";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await seedLadderIfEmpty();
    const [ladder, routes, sessions, checkins, stats, places] = await Promise.all([
      getLadder(), getRoutes(), getSessions(), getCheckins(), exposureStats(), getPlaces(),
    ]);
    return NextResponse.json({ ladder, routes, sessions, checkins, stats, places });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "addStep":
        await addStep(body.phobia, body.title, body.detail ?? "", Number(body.sud ?? 50));
        break;
      case "updateStep":
        await updateStep(body.id, body);
        break;
      case "deleteStep":
        await deleteStep(body.id);
        break;
      case "addRoute":
        await addRoute(body);
        break;
      case "deleteRoute":
        await deleteRoute(body.id);
        break;
      case "drove":
        await markRouteDriven(body.id, new Date().toISOString().slice(0, 10));
        break;
      case "logSession":
        await logSession(body);
        break;
      case "addPlace":
        await addPlace(body.label, body.address, body.kind ?? "other");
        break;
      case "deletePlace":
        await deletePlace(body.id);
        break;
      case "checkin":
        await saveCheckin(body);
        break;
      default:
        return NextResponse.json({ error: `unknown action '${action}'` }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
