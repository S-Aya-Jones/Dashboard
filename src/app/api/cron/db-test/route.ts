import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";

export const dynamic = "force-dynamic";

// Temporary cache-forensics endpoint. Each call inserts a uniquely-named row,
// then counts rows two ways: a STATIC query string (cacheable by query text)
// and a NONCE-comment query (unique text every call — can never be cached).
// If static and nonce counts diverge across calls, responses are cached.
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "no db" }, { status: 500 });
  const sql = neonClient(url);

  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cron_runs (
        slot    TEXT NOT NULL,
        day     TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        detail  TEXT,
        PRIMARY KEY (slot, day)
      )
    `;

    await sql`INSERT INTO cron_runs (slot, day, detail) VALUES (${"cachetest-" + nonce}, ${nonce}, 'test')`;

    const staticCount = await sql`SELECT COUNT(*) AS c FROM cron_runs WHERE slot LIKE 'cachetest%'`;

    // Nonce as a parameter — the HTTP request body differs every call, so a
    // body-keyed cache can never serve these from a prior execution
    const nonceCount = await sql`
      SELECT COUNT(*) AS c, MAX(sent_at) AS m FROM cron_runs
      WHERE slot LIKE 'cachetest%' AND ${nonce} <> ''
    `;
    const hbNonce = await sql`
      SELECT slot, day, sent_at FROM cron_runs
      WHERE slot = 'heartbeat' AND ${nonce} <> ''
    `;

    return NextResponse.json({
      marker: "v3",
      nonce,
      staticCount: Number(staticCount[0]?.c ?? -1),
      nonceCount: Number(nonceCount[0]?.c ?? -1),
      nonceMax: nonceCount[0]?.m ?? null,
      heartbeatViaNonce: hbNonce,
    });
  } catch (e) {
    return NextResponse.json({ marker: "v3", error: String(e) }, { status: 500 });
  }
}
