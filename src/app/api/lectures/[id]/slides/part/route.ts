import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { ensureLectureTables } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One slice of a base64-encoded deck. Vercel caps a request body at 4.5MB and
// base64 inflates by a third, so anything past a ~3MB PDF has to arrive in
// pieces — the same reason lecture audio is chunked.
function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { idx, data } = await req.json();
    if (typeof idx !== "number" || typeof data !== "string" || !data) {
      return NextResponse.json({ error: "idx and data required" }, { status: 400 });
    }
    await ensureLectureTables();
    const sql = db();
    await sql`
      INSERT INTO lecture_slide_parts (lecture_id, idx, data)
      VALUES (${params.id}, ${idx}, ${data})
      ON CONFLICT (lecture_id, idx) DO UPDATE SET data = EXCLUDED.data
    `;
    return NextResponse.json({ ok: true, idx });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
