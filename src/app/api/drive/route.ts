import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { logSession } from "@/lib/exposure";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Called by an iOS Shortcut automation — "when CarPlay connects" / "when I
// arrive home" — so a drive is captured without touching the phone while
// driving. Two endpoints' worth of behaviour in one route via `action`.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS drive_sessions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      label      TEXT,
      start_lat  DOUBLE PRECISION,
      start_lng  DOUBLE PRECISION,
      end_lat    DOUBLE PRECISION,
      end_lng    DOUBLE PRECISION,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at   TIMESTAMPTZ,
      miles      DOUBLE PRECISION,
      minutes    INTEGER,
      turned_back BOOLEAN NOT NULL DEFAULT false
    )
  `;
}

/** Straight-line miles between two points. */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

function authed(req: NextRequest): boolean {
  const secret = process.env.SHORTCUTS_SECRET;
  if (!secret) return true; // not configured — accept, same as the SMS shortcut
  return req.headers.get("x-shortcuts-secret") === secret;
}

export async function GET() {
  await ensureTable();
  const sql = db();
  const rows = await sql`
    SELECT * FROM drive_sessions ORDER BY started_at DESC LIMIT 30
  `;
  return NextResponse.json({
    drives: rows.map(r => ({
      id: r.id as string,
      label: (r.label as string) ?? "",
      startedAt: String(r.started_at),
      endedAt: r.ended_at ? String(r.ended_at) : null,
      miles: r.miles === null ? null : Number(r.miles),
      minutes: r.minutes === null ? null : Number(r.minutes),
      turnedBack: Boolean(r.turned_back),
      open: !r.ended_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await ensureTable();
    const sql = db();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "start");
    const lat = body.lat === undefined ? null : Number(body.lat);
    const lng = body.lng === undefined ? null : Number(body.lng);

    if (action === "start") {
      // Close any drive left open from a missed arrival trigger
      await sql`
        UPDATE drive_sessions SET ended_at = NOW()
        WHERE ended_at IS NULL AND started_at < NOW() - INTERVAL '6 hours'
      `;
      const rows = await sql`
        INSERT INTO drive_sessions (label, start_lat, start_lng)
        VALUES (${String(body.label ?? "Drive")}, ${lat}, ${lng})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: rows[0].id, started: true });
    }

    if (action === "end" || action === "turnback") {
      const open = await sql`
        SELECT * FROM drive_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1
      `;
      if (!open.length) {
        return NextResponse.json({ ok: false, error: "no drive in progress" }, { status: 409 });
      }
      const d = open[0];
      const startedAt = new Date(String(d.started_at));
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000));
      const miles =
        lat !== null && lng !== null && d.start_lat !== null && d.start_lng !== null
          ? Number(haversine(Number(d.start_lat), Number(d.start_lng), lat, lng).toFixed(2))
          : null;
      const turnedBack = action === "turnback";

      await sql`
        UPDATE drive_sessions
        SET ended_at = NOW(), end_lat = ${lat}, end_lng = ${lng},
            miles = ${miles}, minutes = ${minutes}, turned_back = ${turnedBack}
        WHERE id = ${d.id}
      `;

      // Mirror into the exposure log so it shows on the habituation curve
      await logSession({
        phobia: "driving",
        label: `${d.label ?? "Drive"}${turnedBack ? " (turned back)" : ""}`,
        minutes,
        avoided: turnedBack,
        notes: miles === null ? "" : `${miles} mi point-to-point, logged from phone`,
      }).catch(() => {});

      const summary = turnedBack
        ? `Turned back after ${minutes} min${miles !== null ? `, ${miles} mi out` : ""}. That's data, not failure — open the app and rate it while it's fresh.`
        : `Drive logged: ${minutes} min${miles !== null ? `, ${miles} mi` : ""}. Rate your fear in the app while you still remember the peak.`;
      await sendTelegram(summary).catch(() => {});

      return NextResponse.json({ ok: true, minutes, miles, turnedBack });
    }

    return NextResponse.json({ error: `unknown action '${action}'` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
