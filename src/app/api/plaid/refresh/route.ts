import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";

// 5-minute cooldown — prevents spamming Plaid with refresh requests
const cooldown = new Map<string, { refreshedAt: number }>();
const COOLDOWN  = 5 * 60 * 1000;

// Also invalidate the sibling route caches so the next ?refresh=1 fetch
// skips the stale window and goes straight to Plaid.
// We accomplish this by re-exporting a shared bust flag that the other routes
// check — simpler: just let the client call with ?refresh=1 after a non-skipped
// refresh, which already bypasses those caches.

interface ItemStatus {
  itemId:          string;
  institutionName: string | null;
  healthy:         boolean;
  errorCode:       string | null;
}

export async function POST() {
  const key = "refresh:aya";
  const now  = Date.now();
  const last = cooldown.get(key);

  // Within cooldown window → return cached timestamp, skip Plaid calls
  if (last && now - last.refreshedAt < COOLDOWN) {
    return NextResponse.json({
      skipped:     true,
      refreshedAt: new Date(last.refreshedAt).toISOString(),
    });
  }

  try {
    const items  = await getPlaidItems("aya");
    const client = getPlaidClient();
    const statuses: ItemStatus[] = [];

    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);

        // Check item health
        const itemResp = await client.itemGet({ access_token: token });
        const err      = itemResp.data.item.error;

        // Ask Plaid to pull the latest transactions from the bank
        await client.transactionsRefresh({ access_token: token });

        statuses.push({
          itemId:          item.item_id,
          institutionName: item.institution_name,
          healthy:         err == null,
          errorCode:       err?.error_code ?? null,
        });
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = (e as any)?.response?.data?.error_code ?? "unknown";
        statuses.push({
          itemId:          item.item_id,
          institutionName: item.institution_name,
          healthy:         false,
          errorCode:       code,
        });
      }
    }

    cooldown.set(key, { refreshedAt: now });

    return NextResponse.json({
      ok:          true,
      refreshedAt: new Date(now).toISOString(),
      statuses,
    });
  } catch (e) {
    console.error("Plaid refresh error:", (e as Error).message);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
