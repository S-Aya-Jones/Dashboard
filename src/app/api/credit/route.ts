import { NextRequest, NextResponse } from "next/server";
import { neonClient } from "@/lib/neon";
import { upsertObligation } from "@/lib/obligations";
import { parseReport, type Bureau, type Parsed } from "@/lib/creditReport";
import { parsePdfReport, extractAccountsFromText } from "@/lib/creditPdf";
import { stripHtml } from "@/lib/creditReport";
import type { CreditAccount } from "@/lib/creditAccounts";
import { assembleParts, clearParts } from "@/lib/courseMaterial";
import { describeAiError } from "@/lib/aiError";

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

  // Per-account detail, so the plan can name the card instead of saying
  // "your cards". Keyed on report_date rather than snapshot id so a second
  // upload for the same pull replaces its own rows cleanly.
  await sql`
    CREATE TABLE IF NOT EXISTS credit_accounts (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      report_date TEXT NOT NULL,
      name        TEXT NOT NULL,
      kind        TEXT NOT NULL,
      status      TEXT NOT NULL,
      balance     NUMERIC, credit_limit NUMERIC, past_due NUMERIC,
      opened_year INTEGER,
      address     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS credit_accounts_date ON credit_accounts (report_date)`;
  await sql`ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS address TEXT`;
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

    // One file or many, HTML or PDF. The single-file `html` shape is what the
    // old client sent and still works.
    const incoming: Array<{ name: string; html: string }> =
      Array.isArray(body.reports) ? body.reports
      : typeof body.html === "string" ? [{ name: body.name ?? "report", html: body.html }]
      : [];
    // A PDF arrives either inline (small) or staged in pieces under a key.
    // Vercel caps a request body at 4.5MB and base64 inflates by a third, so
    // a real credit report — routinely 3–8MB — cannot be sent inline at all.
    const pdfs: Array<{ name: string; data?: string; partKey?: string }> =
      Array.isArray(body.pdfs) ? body.pdfs : [];

    if (!incoming.length && !pdfs.length) {
      return NextResponse.json({ error: "Pick at least one report to upload." }, { status: 400 });
    }

    const htmlFiles = incoming.filter(r => typeof r.html === "string" && r.html.length);
    const parsed: Parsed[] = htmlFiles.map(r => parseReport(r.html, r.name ?? "report"));

    // The regex path gets the totals exactly; account tables vary too much
    // between exports for a pattern to hold, so those come from the reader.
    // A failure here costs detail, never the upload.
    await Promise.all(
      htmlFiles.map(async (r, i) => {
        if (!parsed[i]?.ok) return;
        parsed[i].accounts = await extractAccountsFromText(stripHtml(r.html), r.name ?? "report");
      }),
    );

    // A PDF has no text layer to regex, so it goes through the same document
    // reader the rest of the app uses. One failing PDF must not lose the
    // files that parsed.
    for (const f of pdfs) {
      const label = f?.name ?? "report.pdf";
      try {
        const data = f.partKey ? await assembleParts(f.partKey) : f.data;
        if (typeof data !== "string" || !data.length) {
          throw new Error("The upload arrived empty — try picking the file again.");
        }
        parsed.push(await parsePdfReport(data, label));
        if (f.partKey) await clearParts(f.partKey).catch(() => {});
      } catch (e) {
        const d = describeAiError(e);
        parsed.push({
          file: label, ok: false, error: d.message,
          covered: [], reportDate: new Date().toISOString().slice(0, 10),
          scores: { transunion: null, experian: null, equifax: null },
          open: null, closed: null, delinquent: null, derogatory: null, collections: null,
          inquiries: null, publicRecords: null, latePayments: null,
          balances: null, payments: null, creditLimit: null, accounts: [],
        });
      }
    }

    const good = parsed.filter(p => p.ok);
    if (!good.length) {
      return NextResponse.json({
        error: parsed[0]?.error ?? "Couldn't read any of those files.",
        files: parsed.map(p => ({ file: p.file, ok: p.ok, error: p.error })),
      }, { status: 422 });
    }

    // The batch is one pull, so it is one snapshot. Newest date in the batch
    // wins — the three bureaus are rarely stamped the same minute. A client
    // uploading files one request at a time passes groupDate so the whole
    // selection still lands in a single snapshot.
    const groupDate = typeof body.groupDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.groupDate)
      ? body.groupDate
      : null;
    const reportDate = groupDate ?? good.map(p => p.reportDate).sort().slice(-1)[0];

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

    // Accounts for this pull. Merged by name across the batch — the same card
    // appears on all three bureau reports — then written as the set for this
    // date, replacing only the names this upload actually covered so a
    // later single-bureau upload can't wipe the rest.
    const byName = new Map<string, CreditAccount>();
    for (const p of good) {
      for (const a of p.accounts) {
        const key = a.name.toLowerCase();
        const seen = byName.get(key);
        const detail = (x: CreditAccount) =>
          Number(x.balance !== null) + Number(x.limit !== null) +
          Number(x.status !== "unknown") + Number(x.address !== null);
        if (!seen || detail(a) > detail(seen)) byName.set(key, a);
      }
    }
    const accounts = Array.from(byName.values());

    for (const a of accounts) {
      await sql`DELETE FROM credit_accounts WHERE report_date = ${reportDate} AND lower(name) = ${a.name.toLowerCase()}`;
      await sql`
        INSERT INTO credit_accounts (report_date, name, kind, status, balance, credit_limit, past_due, opened_year, address)
        VALUES (${reportDate}, ${a.name}, ${a.kind}, ${a.status},
                ${a.balance}, ${a.limit}, ${a.pastDue}, ${a.openedYear}, ${a.address})
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
      accounts: accounts.length,
      files: parsed.map(p => ({ file: p.file, ok: p.ok, error: p.error, covered: p.covered })),
      nextPull: next.toISOString().slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
