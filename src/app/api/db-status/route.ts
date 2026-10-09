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
    // ep-xxx-pooler.c-3.us-east-1.aws.neon.tech — the segment after the
    // endpoint is Neon's proxy shard, not the region, so take the first part
    // that actually looks like one.
    const host = new URL(url).hostname;
    const parts = host.split(".");
    endpointId = parts[0] || null;
    region = parts.find((p) => /^[a-z]{2}-[a-z]+-\d$/.test(p)) ?? null;
  } catch {
    return NextResponse.json({ configured: true, error: "DATABASE_URL is not a valid URL" });
  }

  // Where this database came from decides where the plan is changed. Vercel's
  // Neon integration provisions a whole family of POSTGRES_* variables and
  // bills through Vercel — paying on neon.tech does nothing for it. A single
  // hand-pasted DATABASE_URL means it's a direct Neon project.
  const vercelIntegrationVars = [
    "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING",
    "POSTGRES_USER", "POSTGRES_HOST", "POSTGRES_DATABASE",
    "NEON_PROJECT_ID", "DATABASE_URL_UNPOOLED", "PGHOST",
  ].filter((k) => Boolean(process.env[k]));

  const provisionedByVercel = vercelIntegrationVars.length >= 2;
  const billedVia = provisionedByVercel
    ? "This database looks like it was created through Vercel (Storage tab). It is billed through Vercel, so upgrading on neon.tech will not affect it — change the plan in Vercel."
    : "Only DATABASE_URL is set, so this looks like a Neon project you connected by hand. Its plan is changed in the Neon console.";

  const started = Date.now();
  try {
    const sql = neonClient(url);
    await sql`SELECT 1`;
    return NextResponse.json({
      configured: true,
      endpointId,
      region,
      provisionedByVercel,
      billedVia,
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
      provisionedByVercel,
      billedVia,
      integrationVarsPresent: vercelIntegrationVars,
      ok: false,
      overQuota,
      message: overQuota
        ? `This app connects to Neon endpoint ${endpointId} in ${region}. That project is over its data transfer quota. If the plan you paid for is on a different project, this is the one that needs it.`
        : "The database is reachable but returned an error.",
      error: raw.slice(0, 300),
    });
  }
}
