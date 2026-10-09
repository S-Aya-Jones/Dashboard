import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import { listObligations } from "@/lib/obligations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The three questions she actually opens this page with:
//   can I spend right now · what's about to come out · am I okay
// Everything else on the page is detail. This is the answer.

export async function GET() {
  try {
    const items = await getPlaidItems("aya");
    const plaid = getPlaidClient();

    let checking = 0, savings = 0, creditOwed = 0, creditLimit = 0;
    let connected = false;

    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp = await plaid.accountsGet({ access_token: token });
        connected = true;
        for (const a of resp.data.accounts) {
          const bal = a.balances.available ?? a.balances.current ?? 0;
          if (a.type === "depository" && a.subtype === "checking") checking += bal;
          else if (a.type === "depository" && a.subtype === "savings") savings += a.balances.current ?? 0;
          else if (a.type === "credit") {
            creditOwed += Math.abs(a.balances.current ?? 0);
            creditLimit += a.balances.limit ?? 0;
          }
        }
      } catch { /* skip this item */ }
    }

    // Bills and paydays already live in the obligation engine
    const obligations = await listObligations().catch(() => []);
    const now = Date.now();
    const in14 = now + 14 * 86400000;

    const upcomingBills = obligations
      .filter(o => o.source === "finance" && o.kind === "bill")
      .filter(o => {
        const t = new Date(o.dueAt).getTime();
        return t >= now - 86400000 && t <= in14;
      })
      .map(o => {
        const amt = Number(o.title.match(/\$([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, "") ?? 0);
        return {
          title: o.title.replace(/\s*—\s*\$[\d,.]+/, "").replace(/\s+due$/, ""),
          amount: amt,
          dueAt: o.dueAt,
          days: Math.ceil((new Date(o.dueAt).getTime() - now) / 86400000),
        };
      })
      .sort((a, b) => a.days - b.days);

    const billTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);
    const safeToSpend = checking - billTotal;

    const lastPayday = obligations
      .filter(o => o.source === "finance" && o.kind === "payday")
      .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime())[0];

    const utilization = creditLimit > 0 ? Math.round((creditOwed / creditLimit) * 100) : null;

    // One honest read, no cheerleading
    let verdict: "good" | "tight" | "watch" = "good";
    let line = "";
    if (!connected) {
      verdict = "watch";
      line = "No bank connected right now, so these numbers aren't live.";
    } else if (safeToSpend < 0) {
      verdict = "watch";
      line = `Bills over the next two weeks come to more than what's in checking — short by $${Math.abs(safeToSpend).toFixed(0)}.`;
    } else if (safeToSpend < 200) {
      verdict = "tight";
      line = `After the next two weeks of bills you have $${safeToSpend.toFixed(0)} of room. Tight, not broken.`;
    } else {
      verdict = "good";
      line = `$${safeToSpend.toFixed(0)} clear after everything due in the next two weeks.`;
    }
    if (utilization !== null && utilization > 30 && verdict === "good") {
      line += ` Card utilization is ${utilization}% — under 30% is where it stops costing you score.`;
    }

    return NextResponse.json({
      connected,
      checking, savings, creditOwed, creditLimit, utilization,
      safeToSpend, billTotal,
      bills: upcomingBills.slice(0, 6),
      lastPayday: lastPayday ? { title: lastPayday.title, at: lastPayday.dueAt } : null,
      verdict, line,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
