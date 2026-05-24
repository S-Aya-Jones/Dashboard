import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken, deletePlaidItem } from "@/lib/plaid";

export async function POST(req: Request) {
  try {
    const { itemId } = await req.json();
    const items = await getPlaidItems("aya");
    const item  = items.find((i) => i.item_id === itemId);

    if (item) {
      try {
        const client = getPlaidClient();
        const token  = decryptToken(item.access_token_enc);
        await client.itemRemove({ access_token: token });
      } catch { /* best-effort Plaid revocation */ }
      await deletePlaidItem(itemId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Plaid disconnect:", (e as Error).message);
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }
}
