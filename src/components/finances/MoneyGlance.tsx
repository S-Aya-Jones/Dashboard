"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, CreditCard, PiggyBank, Wallet } from "lucide-react";

interface Bill { title: string; amount: number; dueAt: string; days: number }
interface Glance {
  connected: boolean;
  checking: number; savings: number; creditOwed: number; creditLimit: number;
  utilization: number | null;
  safeToSpend: number; billTotal: number;
  bills: Bill[];
  lastPayday: { title: string; at: string } | null;
  verdict: "good" | "tight" | "watch";
  line: string;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// One calm answer at the top of the page instead of twenty competing panels.
export function MoneyGlance() {
  const [g, setG] = useState<Glance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/glance")
      .then(r => r.json())
      .then(d => { if (!d.error) setG(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-3xl h-44 animate-pulse" style={{ background: "var(--surface)" }} />;
  }
  if (!g) return null;

  const tone =
    g.verdict === "good" ? { bg: "linear-gradient(135deg,#2bb3a3,#3aa864)", accent: "#1e8a7e" }
    : g.verdict === "tight" ? { bg: "linear-gradient(135deg,#e8842c,#d16ba5)", accent: "#9a4a05" }
    : { bg: "linear-gradient(135deg,#c0392b,#a8324a)", accent: "#c0392b" };

  return (
    <div className="space-y-4 mb-6">
      {/* The answer */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="hero-card p-7"
        style={{ background: tone.bg }}>
        <motion.div aria-hidden className="absolute -right-20 -top-20 rounded-full"
          style={{ width: 260, height: 260, background: "rgba(255,255,255,.12)" }}
          animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 8 }} />
        <div className="relative">
          <div className="section-kicker" style={{ color: "rgba(255,255,255,.85)" }}>
            Safe to spend
          </div>
          <div className="stat mt-1" style={{ fontSize: "3.4rem" }}>
            {money(g.safeToSpend)}
          </div>
          <p className="text-sm mt-3 max-w-lg leading-relaxed opacity-95">{g.line}</p>
        </div>
      </motion.div>

      {/* Supporting numbers — quiet, equal weight, no shouting */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={<Wallet size={16} />} label="Checking" value={money(g.checking)} />
        <Tile icon={<PiggyBank size={16} />} label="Savings" value={money(g.savings)} />
        <Tile icon={<CreditCard size={16} />} label="Cards owed" value={money(g.creditOwed)}
          sub={g.utilization !== null ? `${g.utilization}% used` : undefined}
          warn={(g.utilization ?? 0) > 30} />
        <Tile icon={<TrendingUp size={16} />} label="Due in 14 days" value={money(g.billTotal)}
          sub={`${g.bills.length} bill${g.bills.length === 1 ? "" : "s"}`} />
      </div>

      {/* What's actually coming out, in order */}
      {g.bills.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: "var(--text)" }}>Coming out next</h3>
          <div className="space-y-2">
            {g.bills.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: "var(--bg)" }}>
                <span className="text-xs font-bold w-16 flex-shrink-0"
                  style={{ color: b.days <= 2 ? "#c0392b" : "var(--text-muted)" }}>
                  {b.days <= 0 ? "today" : b.days === 1 ? "tomorrow" : `${b.days} days`}
                </span>
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text)" }}>{b.title}</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {b.amount ? money(b.amount) : "—"}
                </span>
              </motion.div>
            ))}
          </div>
          {g.lastPayday && (
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              Last deposit: {g.lastPayday.title} ·{" "}
              {new Date(g.lastPayday.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, warn }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; warn?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div style={{ color: warn ? "#e8842c" : "var(--purple)" }}>{icon}</div>
      <div className="stat text-xl mt-1.5" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-[11px]" style={{ color: warn ? "#e8842c" : "var(--text-muted)" }}>
        {label}{sub ? ` · ${sub}` : ""}
      </div>
    </motion.div>
  );
}
