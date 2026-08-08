import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { upsertObligation } from "@/lib/obligations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Tri-bureau credit reports (IdentityIQ / Credit Karma exports) get parsed for
// the handful of numbers that actually move a score, stored as a dated
// snapshot so progress is visible, and a re-pull reminder is scheduled.
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
}

function stripHtml(raw: string): string {
  const noScript = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  return noScript.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

/** Grab the first N numbers following a label — tri-bureau reports list
 *  TransUnion, Experian, Equifax in that order on one line. */
function trio(text: string, label: string): [number, number, number] | null {
  const re = new RegExp(`${label}\\s*:?\\s*\\$?([\\d,]+\\.?\\d*)\\s*\\$?([\\d,]+\\.?\\d*)\\s*\\$?([\\d,]+\\.?\\d*)`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = (s: string) => Number(s.replace(/,/g, ""));
  return [n(m[1]), n(m[2]), n(m[3])];
}

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
    const { html } = await req.json();
    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Paste or upload the report first." }, { status: 400 });
    }

    const t = stripHtml(html);

    const scores = trio(t, "Credit Score");
    const open = trio(t, "Open Accounts");
    const closed = trio(t, "Closed Accounts");
    const delinq = trio(t, "Delinquent");
    const derog = trio(t, "Derogatory");
    const coll = trio(t, "Collection");
    const bal = trio(t, "Balances");
    const pay = trio(t, "Payments");
    const inq = trio(t, "Inquiries\\(2 years\\)");
    const pub = trio(t, "Public Records");
    // Without total limits there is no utilisation, which is 30% of the score.
    const limit = trio(t, "Credit Limit") ?? trio(t, "High Credit") ?? trio(t, "Total Credit Limit");
    const late  = trio(t, "Late Payments") ?? trio(t, "Times Late");

    if (!scores) {
      return NextResponse.json({
        error: "Couldn't find the score table — is this a tri-bureau report export?",
      }, { status: 422 });
    }

    const dateM = t.match(/Report Date:\s*(?:0\s*-->\s*)?(\d{2}\/\d{2}\/\d{4})/);
    const reportDate = dateM
      ? `${dateM[1].slice(6)}-${dateM[1].slice(0, 2)}-${dateM[1].slice(3, 5)}`
      : new Date().toISOString().slice(0, 10);

    // Worst-case across bureaus is the honest number to track
    const worst = (v: [number, number, number] | null) => (v ? Math.max(...v) : null);

    const sql = db();
    // Older snapshots predate these columns.
    await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS credit_limit NUMERIC`;
    await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS late_payments INTEGER`;
    await sql`ALTER TABLE credit_snapshots ADD COLUMN IF NOT EXISTS oldest_account_years NUMERIC`;

    await sql`
      INSERT INTO credit_snapshots
        (report_date, transunion, experian, equifax, open_accounts, closed_accounts,
         delinquent, derogatory, collections, balances, monthly_payments, inquiries,
         public_records, credit_limit, late_payments)
      VALUES (${reportDate}, ${scores[0]}, ${scores[1]}, ${scores[2]},
              ${worst(open)}, ${worst(closed)}, ${worst(delinq)}, ${worst(derog)},
              ${worst(coll)}, ${bal ? Math.max(...bal) : null}, ${pay ? Math.max(...pay) : null},
              ${worst(inq)}, ${worst(pub)},
              ${limit ? Math.max(...limit) : null}, ${worst(late)})
    `;

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

    return NextResponse.json({
      ok: true,
      reportDate,
      scores: { transunion: scores[0], experian: scores[1], equifax: scores[2] },
      derogatory: worst(derog),
      collections: worst(coll),
      delinquent: worst(delinq),
      balances: bal ? Math.max(...bal) : null,
      nextPull: next.toISOString().slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
