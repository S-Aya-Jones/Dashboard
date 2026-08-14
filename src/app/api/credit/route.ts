import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { upsertObligation } from "@/lib/obligations";
import { parseReport, type Bureau } from "@/lib/creditReport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Credit reports get parsed for the handful of numbers that actually move a
// score, stored as a dated snapshot so progress is visible, and a re-pull
// reminder is scheduled.
//
// Two shapes are accepted, because both are things she actually has:
//   · one tri-bureau export (IdentityIQ, Credit Karma) — three columns a row
//   · separate TransUnion / Experian / Equifax reports, uploaded together
//
// A batch merges into a single dated snapshot rather than three rows, since
// three rows each holding one score would make every trend line wrong. A file
// that fails to parse doesn't lose the ones that succeeded.
//
// Only the summary figures are kept — never account numbers, addresses or
// anything identifying.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS credit_snapshots (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      report_date  TEXT NOT NULL,
      transunion   INTEGER, experian INTEGER, equifax INTEGER,
      open_accounts INTEGER, closed_accounts INTEGER,
      delinquent   INTEGER, derogatory INTEGER, collections INTEGER,
      balances     NUMERIC, monthly_payments NUMERIC,
      inquiries    INTEGER, public_records INTEGER,
      credit_limit NUMERIC, late_payments INTEGER,
      oldest_account_years NUMERIC,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Older snapshots predate these columns.
  await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS credit_limit NUMERIC`;
  await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS late_payments INTEGER`;
  await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS oldest_account_years NUMERIC`;
}

/** Worst case across whatever reported it — the honest number to track. */
const worstOf = (vals: Array<number | null>) => {
  const v = vals.filter((n): n is number => typeof n === "number");
  return v.length ? Math.max(...v) : null;
};

export async function GET() {
  try {
    await ensureTable();
    const sql = db();
    const rows = await sql`SELECT * FROM credit_snapshots ORDER BY report_date DESC LIMIT 12`;
    return NextResponse.json({ snapshots: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();

    // One file or many. The single-file shape is what the old client sent.
    const incoming: Array<{ name: string; html: string }> =
      Array.isArray(body.reports) ? body.reports
      : typeof body.html === "string" ? [{ name: body.name ?? "report", html: body.html }]
      : [];

    if (!incoming.length) {
      return NextResponse.json({ error: "Pick at least one report to upload." }, { status: 400 });
    }

    const parsed = incoming
      .filter(r => typeof r.html === "string" && r.html.length)
      .map(r => parseReport(r.html, r.name ?? "report"));

    const good = parsed.filter(p => p.ok);
    if (!good.length) {
      return NextResponse.json({
        error: parsed[0]?.error ?? "Couldn't read any of those files.",
        files: parsed.map(p => ({ file: p.file, ok: p.ok, error: p.error })),
      }, { status: 422 });
    }

    // The batch is one pull, so it is one snapshot. Newest date in the batch
    // wins — the three bureaus are rarely stamped the same minute.
    const reportDate = good.map(p => p.reportDate).sort().slice(-1)[0];

    const merged = {
      transunion: good.map(p => p.scores.transunion).find(n => n !== null) ?? null,
      experian:   good.map(p => p.scores.experian).find(n => n !== null) ?? null,
      equifax:    good.map(p => p.scores.equifax).find(n => n !== null) ?? null,
      open:          worstOf(good.map(p => p.open)),
      closed:        worstOf(good.map(p => p.closed)),
      delinquent:    worstOf(good.map(p => p.delinquent)),
      derogatory:    worstOf(good.map(p => p.derogatory)),
      collections:   worstOf(good.map(p => p.collections)),
      inquiries:     worstOf(good.map(p => p.inquiries)),
      publicRecords: worstOf(good.map(p => p.publicRecords)),
      latePayments:  worstOf(good.map(p => p.latePayments)),
      balances:      worstOf(good.map(p => p.balances)),
      payments:      worstOf(good.map(p => p.payments)),
      creditLimit:   worstOf(good.map(p => p.creditLimit)),
    };

    const sql = db();

    // Uploading Equifax an hour after TransUnion should fill the gap in the
    // same snapshot, not create a second one with two thirds of it missing.
    // COALESCE keeps whatever is already there and only fills the holes; the
    // count fields take the worse of the two.
    const existing = await sql`
      SELECT id FROM credit_snapshots WHERE report_date = ${reportDate} LIMIT 1
    `;

    if (existing.length) {
      await sql`
        UPDATE credit_snapshots SET
          transunion       = COALESCE(${merged.transunion}, transunion),
          experian         = COALESCE(${merged.experian}, experian),
          equifax          = COALESCE(${merged.equifax}, equifax),
          open_accounts    = GREATEST(COALESCE(${merged.open}, open_accounts), COALESCE(open_accounts, ${merged.open})),
          closed_accounts  = GREATEST(COALESCE(${merged.closed}, closed_accounts), COALESCE(closed_accounts, ${merged.closed})),
          delinquent       = GREATEST(COALESCE(${merged.delinquent}, delinquent), COALESCE(delinquent, ${merged.delinquent})),
          derogatory       = GREATEST(COALESCE(${merged.derogatory}, derogatory), COALESCE(derogatory, ${merged.derogatory})),
          collections      = GREATEST(COALESCE(${merged.collections}, collections), COALESCE(collections, ${merged.collections})),
          inquiries        = GREATEST(COALESCE(${merged.inquiries}, inquiries), COALESCE(inquiries, ${merged.inquiries})),
          public_records   = GREATEST(COALESCE(${merged.publicRecords}, public_records), COALESCE(public_records, ${merged.publicRecords})),
          late_payments    = GREATEST(COALESCE(${merged.latePayments}, late_payments), COALESCE(late_payments, ${merged.latePayments})),
          balances         = GREATEST(COALESCE(${merged.balances}, balances), COALESCE(balances, ${merged.balances})),
          monthly_payments = GREATEST(COALESCE(${merged.payments}, monthly_payments), COALESCE(monthly_payments, ${merged.payments})),
          credit_limit     = GREATEST(COALESCE(${merged.creditLimit}, credit_limit), COALESCE(credit_limit, ${merged.creditLimit}))
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO credit_snapshots
          (report_date, transunion, experian, equifax, open_accounts, closed_accounts,
           delinquent, derogatory, collections, balances, monthly_payments, inquiries,
           public_records, credit_limit, late_payments)
        VALUES (${reportDate}, ${merged.transunion}, ${merged.experian}, ${merged.equifax},
                ${merged.open}, ${merged.closed}, ${merged.delinquent}, ${merged.derogatory},
                ${merged.collections}, ${merged.balances}, ${merged.payments},
                ${merged.inquiries}, ${merged.publicRecords},
                ${merged.creditLimit}, ${merged.latePayments})
      `;
    }

    // Re-pull in 90 days — long enough for disputes and paydowns to land
    const next = new Date(Date.now() + 90 * 86400000);
    next.setHours(9, 0, 0, 0);
    await upsertObligation({
      source: "finance",
      kind: "appointment",
      title: "Pull a fresh credit report",
      detail: "90 days since the last one — check whether the plan moved the number",
      dueAt: next.toISOString(),
      leadDays: [3, 0],
      repeatDays: 90,
      externalId: "credit:repull",
    });

    const covered = Array.from(new Set(good.flatMap(p => p.covered)));
    const missing = (["transunion", "experian", "equifax"] as Bureau[]).filter(b => !covered.includes(b));

    return NextResponse.json({
      ok: true,
      reportDate,
      merged: existing.length > 0,
      scores: { transunion: merged.transunion, experian: merged.experian, equifax: merged.equifax },
      derogatory: merged.derogatory,
      collections: merged.collections,
      delinquent: merged.delinquent,
      balances: merged.balances,
      covered,
      missing,
      files: parsed.map(p => ({ file: p.file, ok: p.ok, error: p.error, covered: p.covered })),
      nextPull: next.toISOString().slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
