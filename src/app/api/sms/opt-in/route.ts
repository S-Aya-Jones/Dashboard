import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS sms_opt_ins (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      consented_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function POST(req: Request) {
  try {
    const { phone, consent } = await req.json();
    if (!consent) {
      return NextResponse.json({ error: "Consent checkbox must be checked" }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    await ensureTable();
    const sql = getDb();
    await sql`INSERT INTO sms_opt_ins (phone) VALUES (${phone.trim()})`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("sms opt-in error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
