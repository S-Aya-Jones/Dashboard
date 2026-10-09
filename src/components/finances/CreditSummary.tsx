"use client";

import { useEffect, useState } from "react";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import type { CreditSnapshot } from "@/lib/creditPlan";
import { CREDIT_UPDATED } from "@/lib/creditEvents";
import { buildLoanReadiness, DEFAULT_LOAN_PROFILE, type LoanProfile } from "@/lib/loanReadiness";

// Credit on the main page, in one line rather than the whole stack.
//
// The full detail lives in the Credit tab. This is the part worth seeing next
// to the money — where the number is, whether it moved, and what it means for
// the loan — with a way through to the rest.

interface Props {
  profile?: LoanProfile;
  onOpen: () => void;
}

const band = (s: number) =>
  s >= 740 ? { label: "Very good", tone: "#3F6F5E" }
  : s >= 670 ? { label: "Good", tone: "#3F6F5E" }
  : s >= 580 ? { label: "Fair", tone: "#C99A5C" }
  : { label: "Poor", tone: "#C0503C" };

export function CreditSummary({ profile, onOpen }: Props) {
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/credit/plan", { cache: "no-store" })
        .then(r => r.json())
        .then(d => {
          setSnapshot(d.snapshot ?? null);
          setChange(typeof d.change === "number" ? d.change : null);
          setScore(d.plan?.score ?? null);
        })
        .catch(() => { /* the button still works */ });
    };
    load();
    window.addEventListener(CREDIT_UPDATED, load);
    return () => window.removeEventListener(CREDIT_UPDATED, load);
  }, []);

  const readiness = buildLoanReadiness(snapshot, profile ?? DEFAULT_LOAN_PROFILE);
  const b = score !== null ? band(score) : null;

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl p-5 mb-4 text-left"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="section-title">Credit</h3>
            {score !== null ? (
              <>
                <span className="stat text-2xl" style={{ color: b!.tone }}>{score}</span>
                <span className="text-xs font-semibold" style={{ color: b!.tone }}>{b!.label}</span>
                {change !== null && change !== 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold"
                    style={{ color: change > 0 ? "#3F6F5E" : "#C0503C" }}>
                    {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {change > 0 ? "+" : ""}{change}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>No report uploaded yet</span>
            )}
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {readiness.headline}
            {readiness.adverseFlagged && " · marks on file to clear"}
          </p>
        </div>
        <ChevronRight size={18} className="flex-shrink-0" style={{ color: "var(--text-light)" }} />
      </div>
    </button>
  );
}
