"use client";

import { useState } from "react";
import { Scissors, ShieldCheck, Lock, BookOpen } from "lucide-react";
import { catchUpWeek, totalReclaimed, hoursLabel, Tier } from "@/lib/catchUp";
import { DAY_SHORT, resolveLabel } from "@/lib/weekPlan";
import { formatRange12 } from "@/lib/schedule";

// This week, with the cuts made.
//
// The cut blocks stay on screen struck through rather than disappearing. Seeing
// what was given up is the point — it makes putting something back a decision
// instead of an act of memory, and it stops the week quietly becoming the new
// normal.

const COURSES = ["Biochemistry", "Physiology", "Microbiology", "Cell & Molecular Bio"];

const TIER_META: Record<Tier, { icon: typeof Lock; label: string; color: string }> = {
  fixed:     { icon: Lock,        label: "Fixed",     color: "var(--text-light)" },
  protected: { icon: ShieldCheck, label: "Protected", color: "#3F6F5E" },
  study:     { icon: BookOpen,    label: "Study",     color: "var(--purple)" },
  cuttable:  { icon: Scissors,    label: "Cut",       color: "var(--red)" },
};

export function CatchUpView() {
  const [showFixed, setShowFixed] = useState(false);
  const week = catchUpWeek(COURSES);
  const freed = totalReclaimed(week);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <h1 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Catch-up week</h1>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Everything that can wait a week, cut. <strong style={{ color: "var(--text)" }}>{hoursLabel(freed)}</strong> freed —
          that&apos;s what&apos;s available, not what you owe. Use the part of it you actually have in you.
        </p>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-light)" }}>
          Your gym, therapy, church, Friday with Deandra, office hours and Saturday evening are all still here.
          Cutting those to buy study hours is how a catch-up week turns into a worse one.
        </p>
        <button
          onClick={() => setShowFixed(v => !v)}
          className="text-xs underline mt-3"
          style={{ color: "var(--text-muted)" }}
        >
          {showFixed ? "Hide work and classes" : "Show work and classes too"}
        </button>
      </div>

      {week.map(day => {
        const rows = day.blocks.filter(b => showFixed || b.tier !== "fixed");
        const cuts = day.blocks.filter(b => b.tier === "cuttable").length;
        return (
          <div key={day.dow} className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-serif text-lg" style={{ color: "var(--text)" }}>{DAY_SHORT[day.dow]}</h2>
              <span className="text-xs" style={{ color: day.reclaimedMinutes ? "var(--purple)" : "var(--text-light)" }}>
                {day.reclaimedMinutes
                  ? `${hoursLabel(day.reclaimedMinutes)} freed · ${cuts} cut`
                  : "nothing to cut"}
              </span>
            </div>

            <div className="space-y-1.5">
              {rows.map((r, i) => {
                const meta = TIER_META[r.tier];
                const Icon = meta.icon;
                const cut = r.tier === "cuttable";
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon size={13} style={{ color: meta.color, flexShrink: 0, marginTop: 3 }} />
                    <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-light)", minWidth: "5.5rem" }}>
                      {formatRange12(r.block.start, r.block.end)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm"
                        style={{
                          color: cut ? "var(--text-light)" : "var(--text)",
                          textDecoration: cut ? "line-through" : "none",
                        }}
                      >
                        {resolveLabel(r.block)}
                      </span>
                      {r.reclaimedFor && (
                        <span className="text-xs block" style={{ color: "var(--purple)" }}>
                          → {r.reclaimedFor}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs leading-relaxed" style={{ color: "var(--text-light)" }}>
        Nothing here is saved or changed — this is a view of the same week with the cuts
        applied. Your real schedule is untouched, so next week comes back on its own.
      </p>
    </div>
  );
}
