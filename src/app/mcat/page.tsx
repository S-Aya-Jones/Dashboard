"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { MCATView } from "@/components/mcat/MCATView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { ShadowingView } from "@/components/shadowing/ShadowingView";
import { QBankView } from "@/components/mcat/QBankView";
import { AnkiView } from "@/components/mcat/AnkiView";
import { StudyTimerView } from "@/components/mcat/StudyTimerView";
import { DiagnosticView } from "@/components/mcat/DiagnosticView";

const TABS = [
  { id: "mcat",       label: "MCAT Prep" },
  { id: "schedule",   label: "School & Schedule" },
  { id: "shadowing",  label: "Shadowing" },
  { id: "qbank",      label: "Q Bank" },
  { id: "flashcards", label: "Flashcards" },
  { id: "timer",      label: "Study Timer" },
  { id: "diagnostic", label: "Diagnostic" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Page() {
  const [tab, setTab] = useState<TabId>("mcat");

  return (
    <DashboardShell>
      {({ data, update }) => (
        <div className="space-y-0">
          {/* Tab bar */}
          <div
            className="flex gap-1 mb-6 p-1 rounded-2xl"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
          >
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
                style={tab === t.id
                  ? { background: "var(--grad)", color: "#fff", boxShadow: "0 2px 12px rgba(124,92,252,0.3)" }
                  : { color: "var(--text-muted)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mcat"       && <MCATView       data={data} update={update} />}
          {tab === "schedule"   && <ScheduleView   data={data} update={update} />}
          {tab === "shadowing"  && <ShadowingView  data={data} update={update} />}
          {tab === "qbank"      && <QBankView      data={data} update={update} />}
          {tab === "flashcards" && <AnkiView       data={data} update={update} />}
          {tab === "timer"      && <StudyTimerView data={data} update={update} />}
          {tab === "diagnostic" && <DiagnosticView data={data} update={update} />}
        </div>
      )}
    </DashboardShell>
  );
}
