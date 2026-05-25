"use client";

import { useState } from "react";
import { Check, X, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BigMove } from "@/types/dashboard";

export interface PlaidTxnLite {
  id:                 string;
  name:               string;
  amount:             number;
  date:               string;
  isInternalTransfer?: boolean;
}

interface Props {
  transactions: PlaidTxnLite[];
  threshold:    number;
  bigMoves:     BigMove[];
  onTag:        (txnId: string, status: "intentional" | "oops", note?: string) => void;
  onThreshold:  (n: number) => void;
}

function fmt$(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BigTicketBoard({ transactions, threshold, bigMoves, onTag, onThreshold }: Props) {
  const [noteOpen,     setNoteOpen]     = useState<string | null>(null);
  const [noteText,     setNoteText]     = useState("");
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft,   setLimitDraft]   = useState(String(threshold));

  const bigTxns = transactions
    .filter((t) => t.amount >= threshold && !t.isInternalTransfer)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 25);

  if (bigTxns.length === 0) return null;

  const tagMap           = new Map(bigMoves.map((m) => [m.transactionId, m]));
  const intentionalCount = bigTxns.filter((t) => tagMap.get(t.id)?.status === "intentional").length;
  const oopsCount        = bigTxns.filter((t) => tagMap.get(t.id)?.status === "oops").length;
  const untaggedCount    = bigTxns.filter((t) => !tagMap.has(t.id)).length;
  const totalTagged      = intentionalCount + oopsCount;
  const intentionalPct   = totalTagged > 0 ? (intentionalCount / totalTagged) * 100 : 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-serif text-xl text-brown">Big Moves</h3>
        {totalTagged > 0 && (
          <p className="text-sm text-brown">
            <span className="text-sage font-semibold">{intentionalCount}</span>
            <span className="text-sand-dark mx-1">·</span>
            <span className="text-rose font-semibold">{oopsCount}</span>
            <span className="text-sand-dark text-xs ml-1">intentional · oops</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 mb-3">
        <p className="text-xs text-sand-dark">Transactions over</p>
        {editingLimit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(limitDraft);
              if (n > 0) onThreshold(n);
              setEditingLimit(false);
            }}
            className="inline-flex items-center gap-1"
          >
            <span className="text-xs text-sand-dark">$</span>
            <input
              type="number" min={1} value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              className="w-16 text-xs py-0 px-1 h-5"
              autoFocus
              onBlur={() => {
                const n = Number(limitDraft);
                if (n > 0) onThreshold(n);
                setEditingLimit(false);
              }}
            />
          </form>
        ) : (
          <button onClick={() => { setEditingLimit(true); setLimitDraft(String(threshold)); }}
            className="text-xs text-terracotta underline decoration-dotted">
            {fmt$(threshold)}
          </button>
        )}
        {untaggedCount > 0 && (
          <span className="ml-auto text-[10px] text-sand-dark">{untaggedCount} untagged</span>
        )}
      </div>

      {totalTagged > 0 && (
        <div className="h-1.5 bg-cream-darker rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${intentionalPct}%`, background: "#7a816c" }} />
        </div>
      )}

      <div className="space-y-2">
        {bigTxns.map((t) => {
          const tag = tagMap.get(t.id);
          return (
            <div key={t.id}
              className={`p-3 rounded-xl transition-colors ${
                tag?.status === "oops"         ? "bg-rose/8 border border-rose/15"
                : tag?.status === "intentional" ? "bg-sage/8"
                : "bg-cream"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brown truncate">{t.name}</p>
                  <p className="text-xs text-sand-dark">{format(parseISO(t.date), "MMM d")}</p>
                  {tag?.note && <p className="text-xs text-sand-dark italic mt-0.5">{tag.note}</p>}
                </div>
                <p className="font-serif text-base text-brown flex-shrink-0">{fmt$(t.amount)}</p>

                {tag ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    tag.status === "intentional" ? "bg-sage/20 text-sage" : "bg-rose/20 text-rose"
                  }`}>
                    {tag.status}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onTag(t.id, "intentional")}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-sage/15 hover:bg-sage/30 transition-colors"
                      title="Intentional">
                      <Check size={12} className="text-sage" />
                    </button>
                    <button onClick={() => onTag(t.id, "oops")}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-rose/15 hover:bg-rose/30 transition-colors"
                      title="Oops">
                      <X size={12} className="text-rose" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => { setNoteOpen(t.id === noteOpen ? null : t.id); setNoteText(tag?.note ?? ""); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-cream-darker transition-colors flex-shrink-0"
                >
                  <MessageSquare size={11} className="text-sand" />
                </button>
              </div>

              {noteOpen === t.id && (
                <div className="mt-2 flex gap-2">
                  <input type="text" placeholder="Add a note…" value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="text-xs flex-1" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { onTag(t.id, tag?.status ?? "intentional", noteText); setNoteOpen(null); } }} />
                  <button onClick={() => { onTag(t.id, tag?.status ?? "intentional", noteText); setNoteOpen(null); }}
                    className="text-xs text-terracotta font-medium px-2">Save</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
