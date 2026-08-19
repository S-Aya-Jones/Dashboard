// Reading a credit report export down to the numbers that move a score.
//
// Split out of the API route so it can be exercised directly against real
// files — the last parser here scored her actual reports at zero because it
// was only ever tried against invented ones.
//
// Two shapes are handled, because both are things she actually has:
//   · one tri-bureau export (IdentityIQ, Credit Karma) — three columns a row
//   · separate TransUnion / Experian / Equifax reports
//
// Only summary figures are read — never account numbers, addresses or
// anything identifying.

import type { CreditAccount } from "@/lib/creditAccounts";

export type Bureau = "transunion" | "experian" | "equifax";

export interface Parsed {
  file: string;
  ok: boolean;
  error?: string;
  covered: Bureau[];
  reportDate: string;
  scores: Record<Bureau, number | null>;
  open: number | null; closed: number | null;
  delinquent: number | null; derogatory: number | null; collections: number | null;
  inquiries: number | null; publicRecords: number | null; latePayments: number | null;
  balances: number | null; payments: number | null; creditLimit: number | null;
  /** Per-account detail. The regex path can't get this; the model path can. */
  accounts: CreditAccount[];
}

export function stripHtml(raw: string): string {
  const noScript = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  return noScript.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

const num = (s: string) => Number(s.replace(/,/g, ""));

// One money-or-count token. The previous pattern was `[\d,]+\.?\d*` with
// `\s*` between the three, which let a single "11,000" satisfy all three
// groups by splitting itself into 11 / 0 / 00 — so every single-bureau report
// looked tri-bureau and came back with garbage numbers. Requiring real
// whitespace between the groups is what stops a number splitting.
const N = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)`;

/** Three numbers after a label — the tri-bureau layout, TU/EX/EQ in order. */
function trio(text: string, label: string): [number, number, number] | null {
  const re = new RegExp(`${label}\\s*:?\\s*${N}\\s+${N}\\s+${N}`, "i");
  const m = text.match(re);
  return m ? [num(m[1]), num(m[2]), num(m[3])] : null;
}

/** One number after a label — the single-bureau layout. */
function single(text: string, label: string): number | null {
  const re = new RegExp(`${label}\\s*:?\\s*${N}`, "i");
  const m = text.match(re);
  return m ? num(m[1]) : null;
}



/**
 * Which bureau a single-bureau report came from. The filename is checked first
 * because it is what she controls; the body is the fallback, counting mentions
 * rather than taking the first, since every report name-drops the other two in
 * boilerplate.
 */
export function whichBureau(text: string, filename: string): Bureau | null {
  const f = filename.toLowerCase();
  if (/trans\s*union|transunion|\btu\b/.test(f)) return "transunion";
  if (/experian|\bexp\b/.test(f)) return "experian";
  if (/equifax|\beqf?\b/.test(f)) return "equifax";

  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const tallies: Array<[Bureau, number]> = [
    ["transunion", count(/trans\s*union/gi)],
    ["experian",   count(/experian/gi)],
    ["equifax",    count(/equifax/gi)],
  ];
  tallies.sort((a, b) => b[1] - a[1]);
  // A clear winner only. A near-tie means it's probably tri-bureau after all.
  if (tallies[0][1] === 0 || tallies[0][1] < tallies[1][1] * 2) return null;
  return tallies[0][0];
}

const plausibleScore = (n: number | null) => (n !== null && n >= 300 && n <= 850 ? n : null);

function reportDateOf(t: string): string {
  const m = t.match(/Report Date:\s*(?:0\s*-->\s*)?(\d{2}\/\d{2}\/\d{4})/);
  return m
    ? `${m[1].slice(6)}-${m[1].slice(0, 2)}-${m[1].slice(3, 5)}`
    : new Date().toISOString().slice(0, 10);
}

export function parseReport(html: string, filename: string): Parsed {
  const t = stripHtml(html);
  const base = {
    file: filename,
    covered: [] as Bureau[],
    reportDate: reportDateOf(t),
    scores: { transunion: null, experian: null, equifax: null } as Record<Bureau, number | null>,
    open: null, closed: null, delinquent: null, derogatory: null, collections: null,
    inquiries: null, publicRecords: null, latePayments: null,
    balances: null, payments: null, creditLimit: null,
    accounts: [],
  };

  const worst = (v: [number, number, number] | null) => (v ? Math.max(...v) : null);

  // ── Tri-bureau: three numbers on the score row ──
  // A label followed by three numbers is only a tri-bureau score row if those
  // numbers are actually scores. Anything else is a single-bureau report whose
  // summary happens to sit on one line.
  const triScores = trio(t, "Credit Score");
  const looksTri = triScores !== null
    && triScores.filter(n => plausibleScore(n) !== null).length >= 2;
  if (triScores && looksTri) {
    return {
      ...base, ok: true,
      covered: ["transunion", "experian", "equifax"],
      scores: {
        transunion: plausibleScore(triScores[0]),
        experian:   plausibleScore(triScores[1]),
        equifax:    plausibleScore(triScores[2]),
      },
      open: worst(trio(t, "Open Accounts")),
      closed: worst(trio(t, "Closed Accounts")),
      delinquent: worst(trio(t, "Delinquent")),
      derogatory: worst(trio(t, "Derogatory")),
      collections: worst(trio(t, "Collection")),
      inquiries: worst(trio(t, "Inquiries\\(2 years\\)")),
      publicRecords: worst(trio(t, "Public Records")),
      latePayments: worst(trio(t, "Late Payments") ?? trio(t, "Times Late")),
      balances: worst(trio(t, "Balances")),
      payments: worst(trio(t, "Payments")),
      creditLimit: worst(trio(t, "Credit Limit") ?? trio(t, "High Credit") ?? trio(t, "Total Credit Limit")),
    };
  }

  // ── Single bureau ──
  const bureau = whichBureau(t, filename);
  const score = plausibleScore(
    single(t, "Credit Score") ?? single(t, "FICO Score") ?? single(t, "Score"),
  );

  if (!bureau && score === null) {
    return { ...base, ok: false, error: "Couldn't find a score table in this file." };
  }
  if (!bureau) {
    return { ...base, ok: false, error: "Found a score but couldn't tell which bureau — rename the file so it contains TransUnion, Experian or Equifax." };
  }

  return {
    ...base, ok: true,
    covered: [bureau],
    scores: { ...base.scores, [bureau]: score },
    open: single(t, "Open Accounts"),
    closed: single(t, "Closed Accounts"),
    delinquent: single(t, "Delinquent"),
    derogatory: single(t, "Derogatory"),
    collections: single(t, "Collection"),
    inquiries: single(t, "Inquiries\\(2 years\\)") ?? single(t, "Inquiries"),
    publicRecords: single(t, "Public Records"),
    latePayments: single(t, "Late Payments") ?? single(t, "Times Late"),
    balances: single(t, "Balances") ?? single(t, "Total Balance"),
    payments: single(t, "Payments") ?? single(t, "Monthly Payment"),
    creditLimit: single(t, "Credit Limit") ?? single(t, "High Credit") ?? single(t, "Total Credit Limit"),
  };
}

