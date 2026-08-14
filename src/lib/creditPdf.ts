import Anthropic from "@anthropic-ai/sdk";
import { firstText } from "@/lib/aiError";
import type { Bureau, Parsed } from "@/lib/creditReport";

// Reading a credit report that arrived as a PDF.
//
// The HTML path in lib/creditReport.ts is regex over the stripped text and
// stays that way — it is exact and free. A PDF has no text layer we can reach
// from the browser, so this reads it the way the rest of the app reads a PDF:
// a document block to Haiku, same as slides and shared course material.
//
// The model is used to *find* numbers, never to judge them. It returns the
// figures printed on the page and nothing else; every value is range-checked
// here, and anything that fails the check becomes null rather than a guess.
// The advice built on top of these numbers is still a rules engine.

const client = new Anthropic();

const SYSTEM = `You read consumer credit reports and return the summary figures printed on them.

Return ONLY JSON, no fences, no commentary:
{
  "bureau": "transunion" | "experian" | "equifax" | "tri",
  "reportDate": "YYYY-MM-DD" | null,
  "scores": { "transunion": number|null, "experian": number|null, "equifax": number|null },
  "openAccounts": number|null,
  "closedAccounts": number|null,
  "delinquent": number|null,
  "derogatory": number|null,
  "collections": number|null,
  "inquiries": number|null,
  "publicRecords": number|null,
  "latePayments": number|null,
  "balances": number|null,
  "monthlyPayments": number|null,
  "creditLimit": number|null
}

Rules:
- Copy figures that are printed. Never calculate, estimate or infer one.
- Any figure that is not printed is null. A null is correct; a plausible guess is not.
- "bureau" is "tri" only if the report shows all three bureaus side by side. Otherwise name the single bureau whose report this is — the one that produced it, not one merely mentioned in the fine print.
- For a single-bureau report put its score under that bureau's key and leave the other two null.
- balances is the total owed across accounts. creditLimit is the total credit limit or total high credit.
- Strip currency symbols and commas. Numbers only.`;

function int(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const score = (v: unknown): number | null => {
  const n = int(v);
  return n !== null && n >= 300 && n <= 850 ? n : null;
};

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const BUREAUS: Bureau[] = ["transunion", "experian", "equifax"];

export async function parsePdfReport(base64: string, filename: string): Promise<Parsed> {
  const empty: Parsed = {
    file: filename,
    ok: false,
    covered: [],
    reportDate: new Date().toISOString().slice(0, 10),
    scores: { transunion: null, experian: null, equifax: null },
    open: null, closed: null, delinquent: null, derogatory: null, collections: null,
    inquiries: null, publicRecords: null, latePayments: null,
    balances: null, payments: null, creditLimit: null,
  };

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Filename: ${filename}. Return the JSON.` },
      ],
    }],
  });

  return normalisePdfJson(parseJson(firstText(msg)), filename, empty);
}

/**
 * Everything between the model's answer and the database. Separated so it can
 * be tested without an API key: this is the layer that has to hold when the
 * model returns a string where a number belongs, a score of 9999, or a bureau
 * label that contradicts the scores it just gave.
 */
export function normalisePdfJson(
  parsed: Record<string, unknown> | null,
  filename: string,
  empty: Parsed,
): Parsed {
  if (!parsed) return { ...empty, error: "Couldn't read the figures out of this PDF." };

  const rawScores = (parsed.scores ?? {}) as Record<string, unknown>;
  const scores = {
    transunion: score(rawScores.transunion),
    experian:   score(rawScores.experian),
    equifax:    score(rawScores.equifax),
  };

  // Whichever bureaus actually produced a usable score are the ones this file
  // covers. Trusting the model's own "bureau" field over the scores it
  // returned would let a mislabelled file overwrite a good score with null.
  const covered = BUREAUS.filter(b => scores[b] !== null);
  if (!covered.length) {
    return { ...empty, error: "No credit score found in this PDF — is it the summary page?" };
  }

  const date = typeof parsed.reportDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.reportDate)
    ? parsed.reportDate
    : empty.reportDate;

  return {
    file: filename,
    ok: true,
    covered,
    reportDate: date,
    scores,
    open: int(parsed.openAccounts),
    closed: int(parsed.closedAccounts),
    delinquent: int(parsed.delinquent),
    derogatory: int(parsed.derogatory),
    collections: int(parsed.collections),
    inquiries: int(parsed.inquiries),
    publicRecords: int(parsed.publicRecords),
    latePayments: int(parsed.latePayments),
    balances: money(parsed.balances),
    payments: money(parsed.monthlyPayments),
    creditLimit: money(parsed.creditLimit),
  };
}
