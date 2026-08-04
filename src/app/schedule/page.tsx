"use client";

import { useState } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { DayScheduleView } from "@/components/schedule/DayScheduleView";
import { WeekPlanView } from "@/components/schedule/WeekPlanView";

export default function Page() {
  const [tab, setTab] = useState<"plan" | "day">("plan");

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Schedule</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              {tab === "plan"
                ? "The weekly system — every block, color-coded, live"
                : "Google Calendar + email appointments, hour by hour"}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab("plan")}
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={tab === "plan"
                ? { background: "var(--purple)", color: "white" }
                : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
              Week Plan
            </button>
            <button onClick={() => setTab("day")}
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={tab === "day"
                ? { background: "var(--purple)", color: "white" }
                : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
              Day View
            </button>
          </div>
        </div>
        {tab === "plan" ? <WeekPlanView /> : <DayScheduleView />}
      </main>
    </div>
  );
}
