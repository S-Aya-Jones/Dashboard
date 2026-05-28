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
  const doubled = [...items, ...items]; // duplicate for seamless loop
  return (
    <div className="overflow-hidden mb-6 rounded-2xl" style={{ height: 100, background: "#111" }}>
      <div className="flex gap-2 h-full animate-marquee" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ height: 100, width: 150 }}>
            <img src={item.src} alt={item.caption ?? ""} className="w-full h-full object-cover opacity-80" />
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
      <div className="flex h-screen items-center justify-center" style={{ background: "#0A0A0A" }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white/20 rounded-full border-t-white animate-spin mx-auto" />
          <p className="font-serif text-xl text-white">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
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
