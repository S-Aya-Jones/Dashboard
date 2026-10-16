"use client";

import { useEffect, useState } from "react";
import { Lock, Wallet, PiggyBank, CalendarClock, AlertTriangle, Check } from "lucide-react";
import {
  CARDS, RULES, SHORT_CHECK, SAVINGS, FEBRUARY,
  BILLS_TOTAL, SPEND_TOTAL, CHECK_TOTAL, SAVINGS_TOTAL, SAVINGS_SPARE,
  cardTotal, savedBy, nextPayday, money, type Line,
} from "@/lib/paycheckPlan";

// The paycheck plan.
//
// Two cards, and the difference between them is the entire system: one is
// automatic and she never looks at it, the other has a floor she can see.
// Everything is per check rather than per month, because the decision she
// actually makes is "what happens when this money lands".

const KIND_COLOR: Record<Line["kind"], string> = {
  bill:  "#8A7A66",
  debt:  "#2E6FBF",
  save:  "#0F8A55",
  spend: "#C0562A",
};

function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}

function fmtDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function PaycheckPlan() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(isoDate()); }, []);
  if (!today) return null;

  const progress = savedBy(today);
  const next = nextPayday(today);
  const daysToNext = next ? daysBetween(today, next) : null;
  const pct = Math.min(100, (progress.saved / SAVINGS.goal) * 100);
  const shortCheckAhead = today <= SHORT_CHECK.date;
  const febAhead = today < FEBRUARY.from;

  return (
    <div className="space-y-4">
      {/* ── Where the savings goal stands ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>
            {money(SAVINGS.goal)} by January 8
          </h2>
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
            {progress.checks} of {SAVINGS.checks} checks
          </span>
        </div>

        <div className="mt-3 h-3 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#0F8A55", borderRadius: 6, transition: "width .3s" }} />
        </div>

        <div className="flex gap-2 mt-3">
          {([
            ["Banked", money(progress.saved), "#0F8A55"],
            ["To go", money(progress.left), "var(--text-light)"],
            ["Lands at", money(SAVINGS_TOTAL), "#2E6FBF"],
          ] as const).map(([label, val, color]) => (
            <div key={label} className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>{label}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>

        <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Seven full checks at {money(SAVINGS.perCheck)} comes to <strong style={{ color: "var(--text)" }}>{money(SAVINGS_TOTAL)}</strong> —
          the goal met with {money(SAVINGS_SPARE)} spare. {SAVINGS.note}
        </p>

        {next && (
          <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "var(--bg)" }}>
            <CalendarClock size={14} style={{ color: "#C97A52" }} className="flex-shrink-0" />
            <span className="text-xs" style={{ color: "var(--text)" }}>
              <strong>Next check {fmtDay(next)}</strong>
              {daysToNext !== null && daysToNext > 0 ? ` · ${daysToNext} day${daysToNext === 1 ? "" : "s"}` : " · today"}
              {next === SHORT_CHECK.date ? " · the short one" : ` · move ${money(SAVINGS.perCheck)} to savings first`}
            </span>
          </div>
        )}
      </div>

      {/* ── The short check, while it still matters ── */}
      {shortCheckAhead && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid rgba(201,122,82,0.45)" }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>
              {fmtDay(SHORT_CHECK.date)} — {money(SHORT_CHECK.amount)}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: "rgba(201,122,82,0.14)", color: "#C97A52" }}>
              one-off
            </span>
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{SHORT_CHECK.why}</p>
          <div className="mt-2.5 space-y-1">
            {SHORT_CHECK.lines.map(l => (
              <div key={l.label} className="flex items-baseline gap-2 text-sm">
                <span className="flex-1" style={{ color: "var(--text)" }}>{l.label}</span>
                <span className="tabular-nums font-semibold" style={{ color: l.amount === 0 ? "var(--text-light)" : "var(--text)" }}>
                  {money(l.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The two cards ── */}
      <div className="grid md:grid-cols-2 gap-3">
        {CARDS.map(card => {
          const total = cardTotal(card);
          return (
            <div key={card.id} className="rounded-2xl p-5"
              style={{
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderTop: `4px solid ${card.id === "bills" ? "#8A7A66" : "#C0562A"}`,
              }}>
              <div className="flex items-center gap-2">
                {card.id === "bills" ? <Lock size={14} style={{ color: "#8A7A66" }} /> : <Wallet size={14} style={{ color: "#C0562A" }} />}
                <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>{card.name}</h3>
              </div>
              <p className="text-[11px] mb-3" style={{ color: "var(--text-light)" }}>{card.sub}</p>

              <div className="space-y-1">
                {card.lines.map(l => (
                  <div key={l.id} className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: KIND_COLOR[l.kind] }} />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm block" style={{ color: "var(--text)" }}>{l.label}</span>
                      {l.note && <span className="text-[10px] block leading-snug" style={{ color: "var(--text-light)" }}>{l.note}</span>}
                    </span>
                    <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: KIND_COLOR[l.kind] }}>
                      {money(l.perCheck)}
                    </span>
                    <span className="text-[10px] tabular-nums w-14 text-right flex-shrink-0" style={{ color: "var(--text-light)" }}>
                      {money(l.perCheck * 2)}/mo
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline gap-2 mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="text-xs font-semibold flex-1" style={{ color: "var(--text)" }}>Per check</span>
                <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{money(total)}</span>
                <span className="text-[10px] tabular-nums w-14 text-right" style={{ color: "var(--text-light)" }}>{money(total * 2)}/mo</span>
              </div>

              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>{card.rule}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl px-5 py-3.5 flex items-baseline gap-3 flex-wrap"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>The whole check</span>
        <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{money(CHECK_TOTAL)}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {money(BILLS_TOTAL)} bills + {money(SPEND_TOTAL)} spending · {money(CHECK_TOTAL * 2)} a month
        </span>
      </div>

      {/* ── What February does ── */}
      {febAhead && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <PiggyBank size={15} style={{ color: "#2E6FBF" }} />
            <h3 className="section-title">What changes in February</h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            Rent starts at <strong>{money(FEBRUARY.rentMonthly)} a month</strong> — {money(FEBRUARY.rentPerCheck)} a check.
            {" "}{FEBRUARY.why}
          </p>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>Savings now</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: "#0F8A55" }}>{money(SAVINGS.perCheck)}</div>
            </div>
            <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>From February</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: "#C97A52" }}>{money(FEBRUARY.savingsPerCheckAfter)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── The rules ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="section-title mb-2.5">The rules</h3>
        <ul className="space-y-2">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#0F8A55" }} />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* ── The one number that's missing ── */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid rgba(192,80,60,0.35)" }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={14} style={{ color: "#C0503C" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Still missing: your credit card minimums</h3>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          The {money(120)} extra-debt line is the only card money in this plan. If your minimums are
          separate from it, they aren&apos;t budgeted anywhere and the first month will come up short.
          Send the amounts and they become their own line.
        </p>
      </div>
    </div>
  );
}
