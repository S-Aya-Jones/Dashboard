import { NextResponse } from "next/server";
import { getPlaidClient, upsertPlaidItem } from "@/lib/plaid";

export async function POST(req: Request) {
  try {
    const { publicToken, metadata } = await req.json();
    const client   = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchange.data;

    await upsertPlaidItem(
      item_id,
      access_token,
      metadata?.institution?.institution_id ?? null,
      metadata?.institution?.name           ?? null,
    );

    return NextResponse.json({ success: true, itemId: item_id });
  } catch (e) {
    console.error("Plaid exchange-token:", (e as Error).message);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }
}
