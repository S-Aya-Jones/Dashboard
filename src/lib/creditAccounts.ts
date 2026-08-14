// The individual accounts on a credit report.
//
// Up to now only the summary totals were stored, which is why the advice could
// only ever be "get utilisation under 10%". You cannot say *pay this card this
// much* without knowing which cards exist and what each one's limit is. This
// is that missing layer.
//
// Names and balances are kept. Account numbers are not — nothing here is
// enough to act on an account, only enough to plan against it.

export type AccountKind = "card" | "loan" | "collection" | "other";
export type AccountStatus = "current" | "late" | "collection" | "chargeoff" | "closed" | "unknown";

export interface CreditAccount {
  /** Creditor name as printed. */
  name: string;
  kind: AccountKind;
  balance: number | null;
  /** Credit limit for a card; null for instalment loans. */
  limit: number | null;
  status: AccountStatus;
  /** Amount currently past due, if the report says. */
  pastDue: number | null;
  openedYear: number | null;
}

/** The account block appended to the extraction prompt for PDFs and HTML alike. */
export const ACCOUNTS_PROMPT = `
Also return every open account listed, as "accounts":

"accounts": [
  {
    "name": "creditor name as printed",
    "kind": "card" | "loan" | "collection" | "other",
    "balance": number|null,
    "limit": number|null,
    "status": "current" | "late" | "collection" | "chargeoff" | "closed" | "unknown",
    "pastDue": number|null,
    "openedYear": number|null
  }
]

Account rules:
- One entry per account. If the three bureaus each list the same account, return it once.
- "limit" is the credit limit or high credit for a revolving card. Instalment loans have no limit — use null, not the original loan amount.
- "kind" is "card" for anything revolving, "collection" for a collection agency account, "loan" for instalment debt, "other" if unclear.
- NEVER include account numbers, even partial ones.
- Omit accounts you cannot name. An account with no creditor name is useless.
- If the document has no account detail, return an empty array.`;

const KINDS: AccountKind[] = ["card", "loan", "collection", "other"];
const STATUSES: AccountStatus[] = ["current", "late", "collection", "chargeoff", "closed", "unknown"];

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A report with 200 accounts is a parsing failure, not a credit history. */
const MAX_ACCOUNTS = 40;

export function normaliseAccounts(raw: unknown): CreditAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: CreditAccount[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
    // An unnamed account can't be acted on, so it isn't worth storing.
    if (!name) continue;

    const kind = KINDS.includes(r.kind as AccountKind) ? (r.kind as AccountKind) : "other";
    const status = STATUSES.includes(r.status as AccountStatus) ? (r.status as AccountStatus) : "unknown";
    const year = money(r.openedYear);

    out.push({
      name,
      kind,
      balance: money(r.balance),
      // A limit is only meaningful on revolving credit. Instalment loans
      // sometimes print the original amount there, which would make
      // utilisation nonsense.
      limit: kind === "card" ? money(r.limit) : null,
      status,
      pastDue: money(r.pastDue),
      openedYear: year !== null && year >= 1950 && year <= new Date().getFullYear() ? Math.round(year) : null,
    });

    if (out.length >= MAX_ACCOUNTS) break;
  }

  // Same creditor twice is the tri-bureau duplicate the prompt asks about;
  // keep the one with the most detail rather than both.
  const byName = new Map<string, CreditAccount>();
  for (const a of out) {
    const key = a.name.toLowerCase();
    const seen = byName.get(key);
    const detail = (x: CreditAccount) => Number(x.balance !== null) + Number(x.limit !== null) + Number(x.status !== "unknown");
    if (!seen || detail(a) > detail(seen)) byName.set(key, a);
  }
  return Array.from(byName.values());
}

/** Utilisation on one card, or null when it can't be computed. */
export function cardUtilisation(a: CreditAccount): number | null {
  if (a.kind !== "card" || !a.limit || a.limit <= 0 || a.balance === null) return null;
  return Math.round((a.balance / a.limit) * 100);
}
