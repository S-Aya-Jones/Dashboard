"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { DashboardData } from "@/types/dashboard";
import { VisionItem } from "@/types/dashboard";

interface Props {
  children: (props: {
    data: DashboardData;
    update: (fn: (d: DashboardData) => DashboardData) => void;
  }) => ReactNode;
}

function VisionBoardBanner({ items }: { items: VisionItem[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden mb-4 md:mb-6 rounded-2xl" style={{ height: 72, background: "var(--bg2)" }}>
      <div className="flex gap-2 h-full animate-marquee" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ height: 72, width: 110 }}>
            <img src={item.src} alt={item.caption ?? ""} className="w-full h-full object-cover opacity-90" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardShell({ children }: Props) {
  const { data, update, saving, loading, dataError, reload } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: "var(--border2)", borderTopColor: "var(--purple)" }}
          />
          <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar saving={saving} />
      <main className="flex-1 overflow-x-hidden pb-44 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8">
          {/* When the database can't be read, the screen is showing blank
              defaults — not her data. Saying so is the difference between a
              confusing app and a frightening one. */}
          {dataError && (
            <div
              className="rounded-2xl p-4 mb-5"
              style={{ background: "var(--surface)", border: "1.5px solid var(--red)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>
                Not showing your real data right now
              </p>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {dataError} Nothing has been deleted.
              </p>
              <button
                onClick={reload}
                className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: "var(--text)", color: "var(--surface)" }}
              >
                Try again
              </button>
            </div>
          )}
          <VisionBoardBanner items={data.visionBoard?.items ?? []} />
          {children({ data, update })}
        </div>
      </main>
    </div>
  );
}
