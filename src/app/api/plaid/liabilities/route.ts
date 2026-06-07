import { NextResponse } from "next/server";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";

const cache = new Map<string, { data: unknown; expiry: number }>();

export async function GET() {
  const hit = cache.get("liabilities:aya");
  if (hit && Date.now() < hit.expiry) return NextResponse.json(hit.data);

  try {
    const items = await getPlaidItems("aya");
    if (items.length === 0) return NextResponse.json({ hasData: false, creditCards: [], studentLoans: [], totalDebt: 0, totalMinPayments: 0 });

    const client = getPlaidClient();
    const creditCards: unknown[] = [];
    const studentLoans: unknown[] = [];

    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp  = await client.liabilitiesGet({ access_token: token });

        const accountMap = new Map(resp.data.accounts.map(a => [a.account_id, a]));
        const { credit, student } = resp.data.liabilities;

        if (credit) {
          for (const cc of credit) {
            const acct  = cc.account_id ? accountMap.get(cc.account_id) : undefined;
            const limit = acct?.balances?.limit ?? null;
            const bal   = acct?.balances?.current ?? cc.last_statement_balance ?? 0;
            const purchaseApr = cc.aprs?.find(a => a.apr_type === "purchase_apr")?.apr_percentage ?? null;

            creditCards.push({
              accountId:           cc.account_id,
              name:                acct?.name ?? "Credit Card",
              balance:             Math.round((bal ?? 0) * 100) / 100,
              creditLimit:         limit,
              utilization:         limit && bal ? Math.round((bal / limit) * 100) : null,
              minimumPayment:      cc.minimum_payment_amount ?? null,
              nextDueDate:         cc.next_payment_due_date ?? null,
              lastStatementBalance: cc.last_statement_balance ?? null,
              purchaseApr,
              isOverdue:           cc.is_overdue ?? false,
            });
          }
        }

        if (student) {
          for (const loan of student) {
            const acct = loan.account_id ? accountMap.get(loan.account_id) : undefined;
            const loanBal = loan.last_statement_balance ?? acct?.balances?.current ?? 0;
            studentLoans.push({
              accountId:          loan.account_id,
              name:               loan.loan_name ?? acct?.name ?? "Student Loan",
              outstandingBalance: Math.round((loanBal ?? 0) * 100) / 100,
              interestRate:       loan.interest_rate_percentage ?? null,
              minimumPayment:     loan.minimum_payment_amount ?? null,
              nextDueDate:        loan.next_payment_due_date ?? null,
              originationDate:    loan.origination_date ?? null,
              originationAmount:  loan.origination_principal_amount ?? null,
              expectedPayoffDate: loan.expected_payoff_date ?? null,
              isOverdue:          loan.is_overdue ?? false,
            });
          }
        }
      } catch {
        // Item may not support liabilities — skip silently
      }
    }

    const totalDebt = [
      ...(creditCards as { balance: number }[]).map(c => c.balance),
      ...(studentLoans as { outstandingBalance: number }[]).map(l => l.outstandingBalance),
    ].reduce((s, n) => s + n, 0);

    const totalMinPayments = [
      ...(creditCards as { minimumPayment: number | null }[]).map(c => c.minimumPayment ?? 0),
      ...(studentLoans as { minimumPayment: number | null }[]).map(l => l.minimumPayment ?? 0),
    ].reduce((s, n) => s + n, 0);

    const result = {
      hasData: creditCards.length > 0 || studentLoans.length > 0,
      creditCards,
      studentLoans,
      totalDebt:        Math.round(totalDebt),
      totalMinPayments: Math.round(totalMinPayments),
    };

    cache.set("liabilities:aya", { data: result, expiry: Date.now() + 15 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Liabilities error:", e);
    return NextResponse.json({ error: "Could not fetch liabilities" }, { status: 500 });
  }
}
