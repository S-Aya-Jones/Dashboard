import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  try {
    const client = getPlaidClient();
    const resp = await client.linkTokenCreate({
      user:           { client_user_id: "aya" },
      client_name:    "Aya's Dashboard",
      products:       [Products.Transactions],
      country_codes:  [CountryCode.Us],
      language:       "en",
    });
    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (e) {
    console.error("Plaid create-link-token:", (e as Error).message);
    return NextResponse.json({ error: "Could not create link token" }, { status: 500 });
  }
}
