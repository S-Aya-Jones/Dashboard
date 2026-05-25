"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { format, parseISO, differenceInDays, startOfMonth } from "date-fns";

export interface PlaidTxnLite {
  id:                  string;
  name:                string;
  amount:              number;
  date:                string;
  isInternalTransfer?: boolean;
}

interface Props {
  transactions:       PlaidTxnLite[]; // 90 days
  watchListMerchants: string[];
  onUpdate:           (merchants: string[]) => void;
}

function fmt$(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isHit(name: string, merchant: string) {
  return name.toLowerCase().includes(merchant.toLowerCase());
}

export function WatchListCard({ transactions, watchListMerchants, onUpdate }: Props) {
  const [adding,    setAdding]    = useState(false);
  const [newVal,    setNewVal]    = useState("");

  const today      = new Date();
  const monthStart = startOfMonth(today);

  const activeTxns = transactions.filter((t) => !t.isInternalTransfer && t.amount > 0);

  // All watch-list hits this calendar month
  const monthHits = activeTxns.filter(
    (t) => parseISO(t.date) >= monthStart && watchListMerchants.some((m) => isHit(t.name, m)),
  );
  const monthTotal = monthHits.reduce((s, t) => s + t.amount, 0);

  // Per-merchant data
  const merchantRows = watchListMerchants.map((merchant) => {
    const all90     = activeTxns.filter((t) => isHit(t.name, merchant));
    const monthOnly = all90.filter((t) => parseISO(t.date) >= monthStart);
    const lastTxn   = all90.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];
    const streak    = lastTxn ? differenceInDays(today, parseISO(lastTxn.date)) : 90;

    return {
      merchant,
      streak,
      monthHits:  monthOnly.length,
      monthSpent: monthOnly.reduce((s, t) => s + t.amount, 0),
      lastDate:   lastTxn?.date ?? null,
    };
  });

  const addMerchant = () => {
    const v = newVal.trim().toLowerCase();
    if (v && !watchListMerchants.includes(v)) onUpdate([...watchListMerchants, v]);
    setNewVal("");
    setAdding(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-xl text-brown">Watch List</h3>
          <p className="text-xs text-sand-dark mt-0.5">
            {monthHits.length > 0
              ? `${monthHits.length} hits this month · ${fmt$(monthTotal)}`
              : "0 hits this month"}
          </p>
        </div>
        <button onClick={() => setAdding(true)}
          className="w-7 h-7 rounded-full bg-cream flex items-center justify-center hover:bg-cream-darker transition-colors">
          <Plus size={13} className="text-sand-dark" />
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-3">
          <input type="text" placeholder="Merchant (e.g. sephora)" value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            className="text-xs flex-1" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") addMerchant(); if (e.key === "Escape") setAdding(false); }} />
          <button onClick={addMerchant} className="text-xs text-terracotta font-medium px-2">Add</button>
          <button onClick={() => setAdding(false)} className="text-xs text-sand-dark">×</button>
        </div>
      )}

      {/* This-month hit transactions */}
      {monthHits.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {[...monthHits].sort((a, b) => b.amount - a.amount).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg"
              style={{ background: "rgba(196,122,94,0.08)", border: "1px solid rgba(196,122,94,0.2)" }}>
              <div>
                <p className="text-sm text-brown">{t.name}</p>
                <p className="text-xs text-sand-dark">{format(parseISO(t.date), "MMM d")}</p>
              </div>
              <p className="font-serif text-base text-terracotta">{fmt$(t.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-merchant clean streaks */}
      <div className="space-y-2">
        {merchantRows.map((row) => (
          <div key={row.merchant} className="flex items-center justify-between gap-3">
            <span className="text-xs text-brown capitalize flex-1">{row.merchant}</span>
            {row.monthHits > 0 ? (
              <span className="text-xs text-terracotta">
                {row.monthHits}× · {fmt$(row.monthSpent)}
              </span>
            ) : (
              <span className="text-[11px] text-sage">
                🚫 {row.streak >= 90 ? "90d+" : `${row.streak}d`} clean
              </span>
            )}
            <button onClick={() => onUpdate(watchListMerchants.filter((m) => m !== row.merchant))}
              className="text-sand hover:text-rose transition-colors flex-shrink-0">
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {watchListMerchants.length === 0 && (
        <p className="text-xs text-sand-dark text-center py-2">No merchants added yet.</p>
      )}
    </div>
  );
}
