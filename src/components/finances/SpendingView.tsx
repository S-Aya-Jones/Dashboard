"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import {
  buildReport, donutSlices, categoryLabel,
  type SpendingReport, type Txn, type CategorySlice,
} from "@/lib/spending";

// Where the money went, in pictures.
//
// Palette: four categorical hues plus a neutral roll-up. Validated with the
// dataviz validator in both light and dark against their own surfaces —
// lightness band, chroma floor, normal-vision separation and contrast all pass;
// clay↔green sits at ΔE 7.3 deutan, which is the 6–8 band and legal only with
// secondary encoding. So every slice carries a direct label and a percentage,
// the legend repeats the value, and the full table sits underneath. Identity is
// never colour alone here.
//
// Four slices plus Other on purpose: past four, a categorical palette stops
// being reliably distinguishable, and a ring of twelve slivers answers nothing.

const SERIES = ["#C94F7C", "#2E6FBF", "#0F8A55", "#C0562A"];
const ROLLUP = "#8A7A66";

const colorFor = (i: number, cat: string) => (cat === "OTHER_ROLLUP" ? ROLLUP : SERIES[i % SERIES.length]);

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString()}`;
const exact = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const RANGES = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
];

/** Donut geometry: a 2px surface gap between segments, per the mark spec. */
function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}

export function SpendingView() {
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/transactions", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); return; }
        setTxns(d.transactions ?? []);
      })
      .catch(() => setErr("Couldn't load your transactions."));
  }, []);

  const report: SpendingReport | null = useMemo(
    () => (txns ? buildReport(txns, days) : null),
    [txns, days],
  );

  if (err) {
    return (
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{err}</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="rounded-2xl p-6 flex items-center gap-2" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <RefreshCw size={15} className="animate-spin" style={{ color: "var(--text-light)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Reading your transactions…</p>
      </div>
    );
  }
  if (!report.txnCount) {
    return (
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text)" }}>No spending in the last {days} days.</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          If that doesn&apos;t sound right, your bank connection may need refreshing on the Flow tab.
        </p>
      </div>
    );
  }

  const slices = donutSlices(report.categories);
  const maxMonth = Math.max(...report.months.map(m => m.total), 1);

  // Donut geometry
  const R = 62, SW = 22, CX = 80, CY = 80;
  const GAP = 0.045; // radians ≈ the 2px surface gap at this radius
  let angle = -Math.PI / 2;

  return (
    <div className="space-y-4">
      {/* Range filter — one row above the charts */}
      <div className="flex items-center gap-2 flex-wrap">
        {RANGES.map(r => (
          <button key={r.days} onClick={() => setDays(r.days)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={days === r.days
              ? { background: "var(--text)", color: "var(--surface)" }
              : { background: "var(--surface)", color: "var(--text-muted)", border: "1.5px solid var(--border)" }}>
            {r.label}
          </button>
        ))}
        <span className="text-xs ml-auto" style={{ color: "var(--text-light)" }}>
          {report.txnCount} purchases · transfers and income excluded
        </span>
      </div>

      {/* Headline — a number, not a chart */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Spent in the last {days} days
        </p>
        <p className="font-serif text-4xl mt-1" style={{ color: "var(--text)" }}>{exact(report.total)}</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {exact(report.dailyAverage)} a day · {exact(report.recurringTotal)} of it is standing commitments,
          {" "}{exact(report.oneOffTotal)} is week-to-week choices
        </p>
      </div>

      {/* The circle */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="section-title mb-3">What it went on</h3>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <svg width="160" height="160" viewBox="0 0 160 160" role="img"
            aria-label={`Spending by category: ${slices.map(s => `${s.label} ${Math.round(s.share * 100)}%`).join(", ")}`}>
            {slices.map((s, i) => {
              const sweep = s.share * Math.PI * 2;
              const a0 = angle + GAP / 2;
              const a1 = angle + sweep - GAP / 2;
              angle += sweep;
              if (a1 <= a0) return null;
              const on = hover === s.category;
              return (
                <path key={s.category}
                  d={arc(CX, CY, R, a0, a1)}
                  stroke={colorFor(i, s.category)}
                  strokeWidth={on ? SW + 4 : SW}
                  fill="none"
                  strokeLinecap="butt"
                  onMouseEnter={() => setHover(s.category)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "stroke-width .12s", cursor: "default" }}
                />
              );
            })}
            <text x={CX} y={CY - 4} textAnchor="middle"
              style={{ fill: "var(--text)", fontSize: 20, fontWeight: 700 }}>
              {money(hover ? (slices.find(s => s.category === hover)?.total ?? report.total) : report.total)}
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle"
              style={{ fill: "var(--text-muted)", fontSize: 10 }}>
              {hover ? slices.find(s => s.category === hover)?.label : `${days} days`}
            </text>
          </svg>

          {/* Legend carries the identity, the value and the share — so the
              colour is never doing the work on its own. */}
          <div className="flex-1 w-full space-y-1.5">
            {slices.map((s, i) => (
              <div key={s.category}
                onMouseEnter={() => setHover(s.category)} onMouseLeave={() => setHover(null)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                style={{ background: hover === s.category ? "var(--bg)" : undefined }}>
                <span className="rounded-sm flex-shrink-0" style={{ width: 10, height: 10, background: colorFor(i, s.category) }} />
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text)" }}>{s.label}</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>{exact(s.total)}</span>
                <span className="text-xs tabular-nums w-10 text-right" style={{ color: "var(--text-muted)" }}>
                  {Math.round(s.share * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month over month — one series, so no legend; the title names it */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="section-title mb-1">Spending by month</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Last six months, everything except transfers</p>
        {/* Bar heights are pixels, not percentages.
            As percentages inside a flex column that also holds two labels, every
            bar over about 60% was shrunk to the same leftover space — Jul at
            $3.1k drew shorter than Aug at $2.2k. A chart that lies about which
            month was bigger is worse than no chart. */}
        <div className="flex items-end gap-2">
          {report.months.map(m => {
            const h = Math.round(3 + (m.total / maxMonth) * 100);
            const isNow = m.month === report.to.slice(0, 7);
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {m.total > 0 ? money(m.total) : ""}
                </span>
                <div style={{
                  width: "100%", height: h, flexShrink: 0,
                  background: isNow ? SERIES[3] : "var(--surface2)",
                  border: isNow ? "none" : "1px solid var(--border)",
                  borderRadius: "4px 4px 0 0",
                }} />
                <span className="text-[10px]" style={{ color: isNow ? "var(--text)" : "var(--text-light)", fontWeight: isNow ? 700 : 400 }}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] mt-2" style={{ color: "var(--text-light)" }}>
          This month is partial — it only counts up to today.
        </p>
      </div>

      {/* Movers */}
      {(report.growing.length > 0 || report.shrinking.length > 0) && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <h3 className="section-title mb-1">What changed</h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Against the {days} days before this one
          </p>
          <div className="space-y-1.5">
            {[...report.growing.map(c => ({ c, up: true })), ...report.shrinking.map(c => ({ c, up: false }))]
              .map(({ c, up }) => (
                <div key={c.category} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}>
                  {up ? <TrendingUp size={14} style={{ color: "#C0562A" }} /> : <TrendingDown size={14} style={{ color: "#0F8A55" }} />}
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text)" }}>{c.label}</span>
                  <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {exact(c.prior)} → {exact(c.total)}
                  </span>
                  <span className="text-sm font-bold tabular-nums w-16 text-right"
                    style={{ color: up ? "#C0562A" : "#0F8A55" }}>
                    {up ? "+" : ""}{Math.round(c.changePct ?? 0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Where it goes, by name */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h3 className="section-title mb-1">Top places</h3>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Biggest by total, not by number of visits
        </p>
        <div className="space-y-1.5">
          {report.merchants.slice(0, 10).map(m => {
            const pct = report.total > 0 ? (m.total / report.total) * 100 : 0;
            const standing = report.recurring.some(r => r.name === m.name);
            return (
              <div key={m.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm truncate" style={{ color: "var(--text)" }}>{m.name}</span>
                    {standing && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                        recurring
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                    <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", background: SERIES[1], borderRadius: 4 }} />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums w-16 text-right" style={{ color: "var(--text)" }}>
                  {exact(m.total)}
                </span>
                <span className="text-[11px] tabular-nums w-8 text-right" style={{ color: "var(--text-light)" }}>
                  ×{m.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* The table — every category, exact, for anything the charts round off */}
      <details className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
        <summary className="px-5 py-3 text-sm font-semibold cursor-pointer"
          style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
          Every category, exactly
        </summary>
        <div className="px-5 pb-4" style={{ background: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-light)" }}>
                <th className="text-left font-semibold text-[11px] uppercase tracking-wider py-2">Category</th>
                <th className="text-right font-semibold text-[11px] uppercase tracking-wider">Spent</th>
                <th className="text-right font-semibold text-[11px] uppercase tracking-wider">Before</th>
                <th className="text-right font-semibold text-[11px] uppercase tracking-wider">n</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((c: CategorySlice) => (
                <tr key={c.category} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2" style={{ color: "var(--text)" }}>{categoryLabel(c.category)}</td>
                  <td className="text-right tabular-nums" style={{ color: "var(--text)" }}>{exact(c.total)}</td>
                  <td className="text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{exact(c.prior)}</td>
                  <td className="text-right tabular-nums" style={{ color: "var(--text-light)" }}>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
