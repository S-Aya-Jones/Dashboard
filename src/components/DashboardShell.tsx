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
    <div className="overflow-hidden mb-6 rounded-2xl" style={{ height: 100, background: "var(--bg2)" }}>
      <div className="flex gap-2 h-full animate-marquee" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ height: 100, width: 150 }}>
            <img src={item.src} alt={item.caption ?? ""} className="w-full h-full object-cover opacity-90" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardShell({ children }: Props) {
  const { data, update, saving, loading } = useDashboard();

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
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <VisionBoardBanner items={data.visionBoard?.items ?? []} />
          {children({ data, update })}
        </div>
      </main>
    </div>
  );
}
