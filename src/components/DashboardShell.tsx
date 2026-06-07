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
    <div className="overflow-hidden mb-6 rounded-2xl" style={{ height: 100 }}>
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

/* Decorative background bubbles — fixed, blurred, non-interactive */
function BackgroundBubbles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Large purple-lavender bubble — top right */}
      <div className="animate-bubble-drift" style={{
        position: "absolute", top: "-8%", right: "-6%",
        width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, rgba(200,184,255,0.7) 0%, rgba(168,144,248,0.3) 60%, transparent 80%)",
        filter: "blur(2px)",
        animationDuration: "10s",
      }} />
      {/* Pink bubble — bottom left */}
      <div className="animate-bubble-drift" style={{
        position: "absolute", bottom: "-5%", left: "5%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle at 40% 30%, rgba(255,208,232,0.75) 0%, rgba(255,160,200,0.3) 60%, transparent 80%)",
        filter: "blur(2px)",
        animationDuration: "13s", animationDelay: "2s",
      }} />
      {/* Mint bubble — mid left */}
      <div className="animate-float-slow" style={{
        position: "absolute", top: "35%", left: "-4%",
        width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle at 38% 32%, rgba(184,240,232,0.8) 0%, rgba(126,221,208,0.3) 60%, transparent 80%)",
        filter: "blur(1px)",
        animationDuration: "9s", animationDelay: "1s",
      }} />
      {/* Peach/orange bubble — top center-right */}
      <div className="animate-float-slow" style={{
        position: "absolute", top: "10%", right: "28%",
        width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, rgba(255,216,184,0.85) 0%, rgba(255,168,120,0.35) 60%, transparent 80%)",
        filter: "blur(1px)",
        animationDuration: "7s", animationDelay: "0.5s",
      }} />
      {/* Lemon-green bubble — bottom right */}
      <div className="animate-bubble-drift" style={{
        position: "absolute", bottom: "15%", right: "8%",
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle at 38% 32%, rgba(232,248,168,0.8) 0%, rgba(200,232,112,0.3) 60%, transparent 80%)",
        filter: "blur(1px)",
        animationDuration: "11s", animationDelay: "3s",
      }} />
      {/* Sky blue bubble — mid right */}
      <div className="animate-float-slow" style={{
        position: "absolute", top: "55%", right: "3%",
        width: 140, height: 140, borderRadius: "50%",
        background: "radial-gradient(circle at 38% 30%, rgba(184,232,255,0.85) 0%, rgba(120,200,248,0.3) 60%, transparent 80%)",
        filter: "blur(1px)",
        animationDuration: "8s", animationDelay: "4s",
      }} />
      {/* Lilac bubble — bottom center */}
      <div className="animate-bubble-drift" style={{
        position: "absolute", bottom: "8%", left: "40%",
        width: 120, height: 120, borderRadius: "50%",
        background: "radial-gradient(circle at 38% 32%, rgba(232,200,255,0.85) 0%, rgba(200,152,248,0.3) 60%, transparent 80%)",
        filter: "blur(1px)",
        animationDuration: "12s", animationDelay: "1.5s",
      }} />
    </div>
  );
}

export function DashboardShell({ children }: Props) {
  const { data, update, saving, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <BackgroundBubbles />
        <div className="text-center space-y-4" style={{ position: "relative", zIndex: 1 }}>
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: "rgba(124,92,252,0.2)", borderTopColor: "#7C5CFC" }}
          />
          <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ position: "relative" }}>
      <BackgroundBubbles />
      <Sidebar saving={saving} />
      <main className="flex-1 overflow-x-hidden" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <VisionBoardBanner items={data.visionBoard?.items ?? []} />
          {children({ data, update })}
        </div>
      </main>
    </div>
  );
}
