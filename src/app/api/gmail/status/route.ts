import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "no DATABASE_URL" });

  const sql = neon(url);

  try {
    // Check what columns exist and their types
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gmail_tokens' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    // Check how many rows exist
    const rows = await sql`SELECT id, user_email, expires_at, updated_at FROM gmail_tokens`;

    // Test a direct insert + read round-trip
    const testVal = "test_" + Math.floor(Date.now() / 1000);
    await sql`
      INSERT INTO gmail_tokens (id, access_token, expires_at)
      VALUES ('__test__', ${testVal}, 'test')
      ON CONFLICT (id) DO UPDATE SET access_token = ${testVal}
    `;
    const testRead = await sql`SELECT access_token FROM gmail_tokens WHERE id = '__test__'`;
    const roundTripOk = testRead.length > 0 && testRead[0].access_token === testVal;
    // Clean up test row
    await sql`DELETE FROM gmail_tokens WHERE id = '__test__'`;

    return NextResponse.json({
      table_columns: columns.map(c => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable })),
      singleton_rows: rows.length,
      singleton_data: rows.map(r => ({ id: r.id, email: r.user_email, expires: r.expires_at, updated: r.updated_at })),
      round_trip_works: roundTripOk,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
