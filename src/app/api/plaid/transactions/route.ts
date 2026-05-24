import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { format, subDays } from "date-fns";

const cache = new Map<string, { data: unknown; expiry: number }>();
const TTL   = 5 * 60 * 1000;

export async function GET(req: Request) {
  const refresh  = new URL(req.url).searchParams.get("refresh") === "1";
  const cacheKey = "transactions:aya";

  if (!refresh) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiry) return NextResponse.json(hit.data);
  }

  try {
    const items = await getPlaidItems("aya");
    if (items.length === 0) return NextResponse.json({ transactions: [] });

    const client    = getPlaidClient();
    const endDate   = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const all: unknown[] = [];

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
          all.push({
            id:              txn.transaction_id,
            name:            txn.merchant_name ?? txn.name,
            amount:          txn.amount,        // positive = debit (money out)
            date:            txn.date,
            category:        txn.personal_finance_category?.primary ?? txn.category?.[0] ?? "OTHER",
            accountId:       txn.account_id,
            institutionName: item.institution_name,
          });
        }
      } catch { /* skip failed item silently */ }
    }

    const result = { transactions: all };
    cache.set(cacheKey, { data: result, expiry: Date.now() + TTL });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Plaid transactions error:", (e as Error).message);
    return NextResponse.json({ error: "Could not fetch transactions" }, { status: 500 });
  }
}
