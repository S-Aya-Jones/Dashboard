import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { upsertObligation } from "@/lib/obligations";
import { loadData } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Plaid is connected and returning balances — it just never said anything.
// This turns account activity into obligations so the engine can speak:
// paycheck landed, bill approaching, unusually large charge.

export async function POST() {
  try {
    const items = await getPlaidItems("aya");
    if (!items.length) return NextResponse.json({ ok: true, created: 0, reason: "no plaid items" });

    const plaid = getPlaidClient();
    const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    let created = 0;
    const seen: string[] = [];

    for (const item of items) {
      let txs: Array<Record<string, unknown>> = [];
      try {
        const token = decryptToken(item.access_token_enc);
        const resp = await plaid.transactionsGet({
          access_token: token,
          start_date: since,
          end_date: today,
          options: { count: 250 },
        });
        txs = resp.data.transactions as unknown as Array<Record<string, unknown>>;
      } catch { continue; }

      for (const tx of txs) {
        const amount = Number(tx.amount ?? 0);
        const name = String(tx.name ?? "");
        const date = String(tx.date ?? today);

        // Plaid uses negative for money IN
        if (amount < -200) {
          const label = /payroll|direct dep|salary|dd |paycheck/i.test(name) ? "Paycheck" : "Deposit";
          await upsertObligation({
            source: "finance",
            kind: "payday",
            title: `${label} — $${Math.abs(amount).toFixed(2)}`,
            detail: name.slice(0, 60),
            dueAt: new Date(`${date}T09:00:00`).toISOString(),
            leadDays: [0],
            externalId: `pay:${date}:${Math.abs(amount).toFixed(2)}`,
          });
          created++; seen.push(`${label} ${date}`);
        }

        // A single unusually large charge is worth knowing about same-day
        if (amount > 250) {
          await upsertObligation({
            source: "finance",
            kind: "bill",
            title: `Large charge — $${amount.toFixed(2)}`,
            detail: name.slice(0, 60),
            dueAt: new Date(`${date}T12:00:00`).toISOString(),
            leadDays: [0],
            externalId: `big:${date}:${name.slice(0, 24)}:${amount.toFixed(2)}`,
          });
          created++; seen.push(`charge ${name.slice(0, 20)}`);
        }
      }
    }

    // Recurring bills she already listed in the dashboard get real lead times
    try {
      const data = await loadData();
      const now = new Date();
      for (const b of (data.recurringBills ?? [])) {
        const day = Number((b as { dayOfMonth?: number }).dayOfMonth ?? 0);
        if (!day) continue;
        const nameRaw = (b as { name?: string }).name ?? "Bill";
        const amt = Number((b as { amount?: number }).amount ?? 0);
        let due = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0);
        if (due.getTime() < Date.now() - 86400000) {
          due = new Date(now.getFullYear(), now.getMonth() + 1, day, 9, 0, 0);
        }
        await upsertObligation({
          source: "finance",
          kind: "bill",
          title: `${nameRaw}${amt ? ` — $${amt.toFixed(2)}` : ""} due`,
          detail: "",
          dueAt: due.toISOString(),
          leadDays: [3, 1, 0],
          repeatDays: 30,
          externalId: `bill:${String(nameRaw).slice(0, 30)}`,
        });
        created++;
      }
    } catch { /* bills list unavailable */ }

    return NextResponse.json({ ok: true, created, seen: seen.slice(0, 10) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
