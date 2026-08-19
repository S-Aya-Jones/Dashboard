"use client";

import { useEffect, useState } from "react";
import { GraduationCap, ChevronDown, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import type { CreditSnapshot } from "@/lib/creditPlan";
import { CREDIT_UPDATED } from "@/lib/creditEvents";
import {
  buildLoanReadiness, DEFAULT_LOAN_PROFILE,
  type LoanProfile, type AdverseCheck,
} from "@/lib/loanReadiness";

// The score, pointed at the thing she wants it for.
//
// She asked for steps to raise her score "ultimately to get grad plus loans".
// Two things were wrong with that as a plan, and both are worth more than any
// advice about utilisation: Grad PLUS closed to new borrowers on 1 July 2026,
// and it never had a score cutoff in the first place — it is a pass/fail check
// on specific credit events. So this leads with eligibility, then the federal
// ceiling, then the steps that actually apply to whichever side she's on.

interface Props {
  profile?: LoanProfile;
  onProfile: (p: LoanProfile) => void;
}

const STATUS_ICON: Record<AdverseCheck["status"], typeof CheckCircle2> = {
  clear: CheckCircle2, flagged: AlertTriangle, unknown: HelpCircle,
};
const STATUS_COLOR: Record<AdverseCheck["status"], string> = {
  clear: "#3F6F5E", flagged: "#C0503C", unknown: "#8A7A66",
};

export function LoanReadiness({ profile, onProfile }: Props) {
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch("/api/credit/plan", { cache: "no-store" })
        .then(r => r.json())
        .then(d => setSnapshot(d.snapshot ?? null))
        .catch(() => { /* the rules still run with no report */ });
    };
    load();
    window.addEventListener(CREDIT_UPDATED, load);
    return () => window.removeEventListener(CREDIT_UPDATED, load);
  }, []);

  const p = profile ?? DEFAULT_LOAN_PROFILE;
  const r = buildLoanReadiness(snapshot, p);

  const tone = r.gradPlusOpen === false ? "#C0503C" : r.gradPlusOpen === true ? "#3F6F5E" : "#C99A5C";

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap size={17} style={{ color: tone }} />
        <h3 className="section-title flex-1">School loans</h3>
      </div>

      <p className="text-sm font-semibold leading-snug" style={{ color: tone }}>{r.headline}</p>
      <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.summary}</p>

      {/* The one question that decides the rest */}
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>
          Were you already enrolled in this program, with federal loans, before 1 July 2026?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {([["yes", "Yes — enrolled before July"], ["no", "No — I started this August"], ["unknown", "Not sure yet"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => onProfile({ ...p, grandfathered: v })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={p.grandfathered === v
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold mt-3 mb-2" style={{ color: "var(--text)" }}>
          How does your school classify the MHS for loan limits?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {([["graduate", "Graduate / master's"], ["professional", "Professional"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => onProfile({ ...p, programType: v })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={p.programType === v
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The ceiling */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
          <div className="section-kicker">Federal, per year</div>
          <div className="stat text-2xl mt-1" style={{ color: "var(--text)" }}>
            ${r.limits.annual.toLocaleString()}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.limits.label}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
          <div className="section-kicker">Federal, lifetime</div>
          <div className="stat text-2xl mt-1" style={{ color: "var(--text)" }}>
            ${r.limits.aggregate.toLocaleString()}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Unsubsidized aggregate</div>
        </div>
      </div>

      {/* Score, and what it's actually for */}
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "var(--bg)" }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Score target for a private loan
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {r.scoreTarget.current ?? "—"} → {r.scoreTarget.target}
          </span>
        </div>
        {r.scoreTarget.gap !== null && r.scoreTarget.gap > 0 && (
          <p className="text-xs mt-1 font-semibold" style={{ color: "#C97A52" }}>
            {r.scoreTarget.gap} points to go
          </p>
        )}
        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-light)" }}>
          {r.scoreTarget.note}
        </p>
      </div>

      {/* The federal pass/fail test, run against her report */}
      <p className="text-[11px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: "var(--text-light)" }}>
        The federal credit test {r.gradPlusOpen === false && "(if you turn out to be eligible)"}
      </p>
      <div className="space-y-1.5">
        {r.adverse.map(a => {
          const Icon = STATUS_ICON[a.status];
          const color = STATUS_COLOR[a.status];
          return (
            <div key={a.id} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}>
              <Icon size={13} className="flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug" style={{ color: "var(--text)" }}>{a.test}</p>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* The steps */}
      <p className="text-[11px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: "var(--text-light)" }}>
        Steps, in order
      </p>
      <div className="space-y-1.5">
        {r.steps.map((s, i) => {
          const isOpen = openStep === s.id;
          return (
            <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: "var(--bg)" }}>
              <button
                onClick={() => setOpenStep(isOpen ? null : s.id)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
              >
                <span className="text-xs font-bold tabular-nums flex-shrink-0 mt-0.5" style={{ color: "var(--text-light)" }}>
                  {i + 1}
                </span>
                <span className="text-xs font-semibold flex-1 leading-snug" style={{ color: "var(--text)" }}>
                  {s.title}
                </span>
                <ChevronDown
                  size={13}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: "var(--text-light)", transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pl-8 space-y-2">
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{s.detail}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <strong>Why:</strong> {s.why}
                  </p>
                  <p className="text-[11px] leading-relaxed rounded-lg px-2.5 py-1.5"
                    style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                    {s.when}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* What only the aid office can answer */}
      <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowQuestions(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          Four questions for Meharry financial aid
          <ChevronDown size={13} style={{ transform: showQuestions ? "rotate(180deg)" : undefined, transition: "transform .18s" }} />
        </button>
        {showQuestions && (
          <ul className="px-3 pb-3 space-y-1.5">
            {r.askTheAidOffice.map((q, i) => (
              <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--text)" }}>
                <span style={{ color: "var(--text-light)" }}>·</span>{q}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "var(--text-light)" }}>
        Federal rules as of August 2026. The 1 July 2026 change is recent and schools are still
        interpreting the grandfather clause differently — treat the aid office&apos;s written answer as
        the one that counts, not this panel.
      </p>
    </div>
  );
}
