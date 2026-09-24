"use client";

import { useEffect, useState } from "react";
import { Check, Phone, HelpCircle, Flag } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";
import { TIMELINE, CLEANUP, OPEN_ITEMS, currentPhase, type Task } from "@/lib/breakPlan";

// The break, on one page.
//
// The timeline is context. The two lists under it are the page — the cleanup is
// money leaving the account every month it isn't done, and the open items are
// the questions everything else is waiting on.

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const KIND_COLOR: Record<string, string> = {
  focus: "#B4552F",
  money: "#0F8A55",
  checkpoint: "#E0A44A",
  school: "#2E6FBF",
};

function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BreakPlanView({ data, update }: Props) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(isoDate()); }, []);

  const done = new Set(data.breakTasksDone ?? []);
  const toggle = (id: string) => {
    update(d => {
      const next = new Set(d.breakTasksDone ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...d, breakTasksDone: Array.from(next) };
    });
  };

  if (!today) return null;
  const phase = currentPhase(today);

  const list = (tasks: Task[]) => (
    <div className="space-y-1">
      {tasks.map(t => {
        const on = done.has(t.id);
        return (
          <button key={t.id} onClick={() => toggle(t.id)}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
            style={{ background: on ? "transparent" : "var(--bg)", opacity: on ? 0.5 : 1 }}>
            <span className="flex items-center justify-center flex-shrink-0 rounded-md mt-0.5"
              style={{
                width: 20, height: 20,
                background: on ? "#0F8A55" : "transparent",
                border: on ? "none" : "1.5px solid var(--border2)",
              }}>
              {on && <Check size={13} color="#fff" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm block leading-snug"
                style={{ color: "var(--text)", textDecoration: on ? "line-through" : undefined }}>
                {t.text}
              </span>
              {t.detail && (
                <span className="text-[11px] block mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {t.detail}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  const cleanupLeft = CLEANUP.filter(t => !done.has(t.id)).length;
  const openLeft = OPEN_ITEMS.filter(t => !done.has(t.id)).length;

  return (
    <div className="space-y-4">
      {phase && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: `1.5px solid ${KIND_COLOR[phase.kind]}55` }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>{phase.title}</h2>
            <span className="text-xs" style={{ color: "var(--text-light)" }}>
              {fmt(phase.from)}{phase.to ? ` – ${fmt(phase.to)}` : ""}
            </span>
          </div>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{phase.detail}</p>
        </div>
      )}

      {/* ── The cleanup ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Phone size={15} style={{ color: "#C0562A" }} />
          <h3 className="section-title">Cleanup — this week</h3>
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
            {CLEANUP.length - cleanupLeft}/{CLEANUP.length}
          </span>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every one of these is money leaving the account for something you decided you don&apos;t want.
        </p>
        {list(CLEANUP)}
      </div>

      {/* ── Open items ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle size={15} style={{ color: "#2E6FBF" }} />
          <h3 className="section-title">Open questions</h3>
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
            {OPEN_ITEMS.length - openLeft}/{OPEN_ITEMS.length}
          </span>
        </div>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Nothing downstream gets decided until these have answers.
        </p>
        {list(OPEN_ITEMS)}
      </div>

      {/* ── The shape of the next year ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Flag size={15} style={{ color: "var(--text-muted)" }} />
          <h3 className="section-title">From here to the application cycle</h3>
        </div>
        <div className="space-y-2.5">
          {TIMELINE.map(p => {
            const past = (p.to ?? p.on ?? p.from) < today;
            const now = p.id === phase?.id;
            return (
              <div key={p.id} className="flex gap-3" style={{ opacity: past ? 0.45 : 1 }}>
                <span className="flex-shrink-0 w-1 rounded-full" style={{ background: KIND_COLOR[p.kind] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.title}</span>
                    {now && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: `${KIND_COLOR[p.kind]}1A`, color: KIND_COLOR[p.kind] }}>
                        now
                      </span>
                    )}
                    <span className="text-[11px] ml-auto tabular-nums" style={{ color: "var(--text-light)" }}>
                      {p.on ? fmt(p.on) : `${fmt(p.from)}${p.to ? ` – ${fmt(p.to)}` : " onward"}`}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{p.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
