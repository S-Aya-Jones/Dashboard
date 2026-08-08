import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";

export const dynamic = "force-dynamic";

// Which Neon project is this app actually talking to, and is it answering?
//
// Comparing a connection string in Vercel against a project in the Neon
// console is fiddly and easy to get wrong. This says it outright. Only the
// endpoint id is returned — the part that identifies the project in the Neon
// console — never the user, password or database name.
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ configured: false, error: "DATABASE_URL is not set in Vercel" });
  }

  let endpointId: string | null = null;
  let region: string | null = null;
  try {
    const host = new URL(url).hostname;              // ep-xxx-yyy-123456.us-east-2.aws.neon.tech
    endpointId = host.split(".")[0] || null;          // ep-xxx-yyy-123456
    region = host.split(".").slice(1, 2)[0] ?? null;  // us-east-2
  } catch {
    return NextResponse.json({ configured: true, error: "DATABASE_URL is not a valid URL" });
  }

  const started = Date.now();
  try {
    const sql = neonClient(url);
    await sql`SELECT 1`;
    return NextResponse.json({
      configured: true,
      endpointId,
      region,
      ok: true,
      ms: Date.now() - started,
      message: "The database answered. Everything should work.",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const overQuota = raw.includes("402") || raw.toLowerCase().includes("quota");
    return NextResponse.json({
      configured: true,
      endpointId,
      region,
      ok: false,
      overQuota,
      message: overQuota
        ? `This app connects to Neon endpoint ${endpointId} in ${region}. That project is over its data transfer quota. If the plan you paid for is on a different project, this is the one that needs it.`
        : "The database is reachable but returned an error.",
      error: raw.slice(0, 300),
    });
  }
}
