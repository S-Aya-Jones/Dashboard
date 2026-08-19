import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "no DATABASE_URL" }, { status: 500 });

  const sql = neonClient(url);

  // 1. Ensure table exists
  let createError: string | null = null;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS inbound_logs (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        raw_text    TEXT NOT NULL,
        parsed_type TEXT,
        received_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE inbound_logs DROP COLUMN IF EXISTS parsed_payload`;
  } catch (e) {
    createError = String(e);
  }

  // 2. Try inserting a test row
  let insertError: string | null = null;
  let insertedId: string | null = null;
  try {
    const rows = await sql`
      INSERT INTO inbound_logs (raw_text, parsed_type)
      VALUES ('__debug_test__', 'debug')
      RETURNING id
    `;
    insertedId = rows[0]?.id ?? null;
  } catch (e) {
    insertError = String(e);
  }

  // 3. Read all rows
  let rows: unknown[] = [];
  let selectError: string | null = null;
  try {
    rows = await sql`SELECT id, raw_text, parsed_type, received_at FROM inbound_logs ORDER BY received_at DESC LIMIT 20`;
  } catch (e) {
    selectError = String(e);
  }

  return NextResponse.json({
    createError,
    insertedId,
    insertError,
    selectError,
    rowCount: rows.length,
    rows,
  });
}
