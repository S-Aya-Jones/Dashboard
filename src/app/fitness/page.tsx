"use client";

import { useState } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { FitnessView } from "@/components/fitness/FitnessView";
import { WorkoutView } from "@/components/workout/WorkoutView";

import { BodyScanView } from "@/components/fitness/BodyScanView";

const TABS = [
  { id: "sleep",   label: "Sleep & Stats" },
  { id: "workout", label: "Training" },
  { id: "body",    label: "Body Scan" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Page() {
  const { data, update, saving, loading } = useDashboard();
  const [tab, setTab] = useState<TabId>("sleep");

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: "rgba(124,92,252,0.2)", borderTopColor: "#7C5CFC" }}
          />
          <p className="font-serif text-xl" style={{ color: "var(--text)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar saving={saving} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 pb-20 md:pb-0">
        {/* Tab bar */}
        <div
          className="flex-shrink-0 flex items-center gap-1 px-5 pt-4 pb-0"
          style={{ borderBottom: "1.5px solid var(--border)", background: "var(--surface)" }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all"
              style={tab === t.id
                ? { background: "var(--bg)", color: "var(--purple)", borderBottom: "2px solid var(--purple)" }
                : { color: "var(--text-muted)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "sleep" && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-8">
              <FitnessView data={data} update={update} />
            </div>
          </div>
        )}
        {tab === "workout" && (
          <div className="flex-1 overflow-hidden min-h-0">
            <WorkoutView data={data} update={update} />
          </div>
        )}
        {tab === "body" && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6">
              <BodyScanView data={data} update={update} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
