import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { buildCreditPlan, type CreditSnapshot } from "@/lib/creditPlan";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const sql = neonClient(url);

    const rows = await sql`
      SELECT * FROM credit_snapshots ORDER BY report_date DESC LIMIT 2
    `;
    if (!rows.length) {
      return NextResponse.json({ plan: null, message: "Upload a report first." });
    }

    const latest = rows[0] as unknown as CreditSnapshot;
    const prior  = rows[1] as unknown as CreditSnapshot | undefined;

    const plan = buildCreditPlan(latest);

    // Movement since the last pull is the thing she actually wants to see.
    const mid = (s?: CreditSnapshot) => {
      if (!s) return null;
      const v = [s.transunion, s.experian, s.equifax].filter((n): n is number => typeof n === "number" && n > 0);
      return v.length === 3 ? [...v].sort((a, b) => a - b)[1] : v[0] ?? null;
    };
    const before = mid(prior);
    const change = plan.score !== null && before !== null ? plan.score - before : null;

    return NextResponse.json({
      plan,
      change,
      priorDate: prior?.report_date ?? null,
      reportDate: latest.report_date,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
