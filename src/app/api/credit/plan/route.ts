import { NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { buildCreditPlan, type CreditSnapshot } from "@/lib/creditPlan";
import { buildActionPlan } from "@/lib/creditActionPlan";
import type { CreditAccount } from "@/lib/creditAccounts";

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

    // Account detail is what lets the plan name the card. Missing rows are
    // normal for a report we couldn't read accounts out of — the plan falls
    // back to totals rather than failing.
    let accounts: CreditAccount[] = [];
    try {
      const rows = await sql`
        SELECT name, kind, status, balance, credit_limit, past_due, opened_year
        FROM credit_accounts WHERE report_date = ${latest.report_date}
      `;
      accounts = rows.map(r => ({
        name: String(r.name),
        kind: r.kind as CreditAccount["kind"],
        status: r.status as CreditAccount["status"],
        balance: r.balance === null ? null : Number(r.balance),
        limit: r.credit_limit === null ? null : Number(r.credit_limit),
        pastDue: r.past_due === null ? null : Number(r.past_due),
        openedYear: r.opened_year === null ? null : Number(r.opened_year),
      }));
    } catch { /* table may not exist on an older database */ }

    const actionPlan = buildActionPlan(latest, accounts);

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
      // The raw row as well, so the loan-readiness rules can run client-side
      // against her stored answers without a second round trip.
      snapshot: latest,
      accounts,
      actionPlan,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
