import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";

// 5-min server-side cache
const cache = new Map<string, { data: unknown; expiry: number }>();
const TTL   = 5 * 60 * 1000;

export async function GET(req: Request) {
  const refresh  = new URL(req.url).searchParams.get("refresh") === "1";
  const cacheKey = "accounts:aya";

  if (!refresh) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiry) return NextResponse.json(hit.data);
  }

  try {
    const items = await getPlaidItems("aya");
    if (items.length === 0) {
      return NextResponse.json({ accounts: [], refreshedAt: new Date().toISOString() });
    }

    const client      = getPlaidClient();
    const allAccounts: unknown[] = [];

    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp  = await client.accountsGet({ access_token: token });

        for (const acc of resp.data.accounts) {
          allAccounts.push({
            accountId:       acc.account_id,
            name:            acc.name,
            officialName:    acc.official_name ?? null,
            mask:            acc.mask ?? null,
            type:            acc.type,
            subtype:         acc.subtype ?? null,
            balances: {
              current:   acc.balances.current  ?? null,
              available: acc.balances.available ?? null,
              limit:     acc.balances.limit     ?? null,
            },
            institutionName: item.institution_name,
            institutionId:   item.institution_id,
            itemId:          item.item_id,
          });
        }
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = (e as any)?.response?.data?.error_code;
        if (code === "ITEM_LOGIN_REQUIRED") {
          allAccounts.push({
            itemId:          item.item_id,
            institutionName: item.institution_name,
            loginRequired:   true,
          });
        }
      }
    }

    const result = { accounts: allAccounts, refreshedAt: new Date().toISOString() };
    cache.set(cacheKey, { data: result, expiry: Date.now() + TTL });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Plaid accounts error:", (e as Error).message);
    return NextResponse.json({ error: "Could not fetch accounts" }, { status: 500 });
  }
}
