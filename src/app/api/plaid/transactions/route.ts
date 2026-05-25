import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { format, subDays, parseISO } from "date-fns";

const cache = new Map<string, { data: unknown; expiry: number }>();
const TTL   = 5 * 60 * 1000;

interface RawTxn {
  id:              string;
  name:            string;
  amount:          number;
  date:            string;
  category:        string;
  accountId:       string;
  itemId:          string;
  institutionName: string | null;
}

export interface EnrichedTxn extends RawTxn {
  isInternalTransfer: boolean;
  transferPairId:     string | null;
}

// Plaid categories that are always transfers
const PLAID_TRANSFER_CATS = new Set(["TRANSFER_IN", "TRANSFER_OUT", "TRANSFER"]);

const TRANSFER_KW = /\b(transfer|trf|xfer|zelle|wire)\b/i;

function detectTransfers(txns: RawTxn[]): EnrichedTxn[] {
  const pairMap    = new Map<string, string>();
  const pairedSet  = new Set<string>();

  // Only smart-pair transactions that Plaid hasn't already categorized as transfers
  const eligible = txns.filter((t) => !PLAID_TRANSFER_CATS.has(t.category));
  const debits   = eligible.filter((t) => t.amount > 0.5);
  const credits  = eligible.filter((t) => t.amount < -0.5);

  for (const debit of debits) {
    if (pairedSet.has(debit.id)) continue;
    const debitMs = parseISO(debit.date).getTime();

    const match = credits
      .filter(
        (c) =>
          !pairedSet.has(c.id) &&
          c.accountId !== debit.accountId &&
          Math.abs(debit.amount + c.amount) < 0.02 && // amounts cancel
          Math.abs(parseISO(c.date).getTime() - debitMs) <= 5 * 86_400_000,
      )
      .sort((a, b) => {
        // prefer keyword signals
        const score = (t: RawTxn) => (TRANSFER_KW.test(t.name) ? 2 : 0);
        return score(b) + score(debit) - (score(a) + score(debit));
      })[0];

    if (match && (TRANSFER_KW.test(debit.name) || TRANSFER_KW.test(match.name) || debit.amount >= 50)) {
      const pairId = `tr-${debit.id.slice(-6)}-${match.id.slice(-6)}`;
      pairedSet.add(debit.id);
      pairedSet.add(match.id);
      pairMap.set(debit.id, pairId);
      pairMap.set(match.id, pairId);
    }
  }

  return txns.map((t) => ({
    ...t,
    isInternalTransfer: PLAID_TRANSFER_CATS.has(t.category) || pairMap.has(t.id),
    transferPairId:     pairMap.get(t.id) ?? null,
  }));
}

export async function GET(req: Request) {
  const refresh  = new URL(req.url).searchParams.get("refresh") === "1";
  const cacheKey = "transactions:aya:v3";

  if (!refresh) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiry) return NextResponse.json(hit.data);
  }

  try {
    const items = await getPlaidItems("aya");
    if (items.length === 0) return NextResponse.json({ transactions: [], transferCount: 0 });

    const client    = getPlaidClient();
    const endDate   = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
    const raw: RawTxn[] = [];

    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp  = await client.transactionsGet({
          access_token: token,
          start_date:   startDate,
          end_date:     endDate,
          options:      { count: 500 },
        });

        for (const txn of resp.data.transactions) {
          if (txn.pending) continue;
          raw.push({
            id:              txn.transaction_id,
            name:            txn.merchant_name ?? txn.name,
            amount:          txn.amount,
            date:            txn.date,
            category:        txn.personal_finance_category?.primary ?? txn.category?.[0] ?? "OTHER",
            accountId:       txn.account_id,
            itemId:          item.item_id,
            institutionName: item.institution_name,
          });
        }
      } catch { /* skip failed item */ }
    }

    const enriched      = detectTransfers(raw);
    const transferCount = enriched.filter((t) => t.isInternalTransfer).length;

    const result = { transactions: enriched, transferCount };
    cache.set(cacheKey, { data: result, expiry: Date.now() + TTL });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Plaid transactions error:", (e as Error).message);
    return NextResponse.json({ error: "Could not fetch transactions" }, { status: 500 });
  }
}
