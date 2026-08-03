"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { DayScheduleView } from "@/components/schedule/DayScheduleView";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Schedule</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Google Calendar + email appointments, hour by hour
          </p>
        </div>
        <DayScheduleView />
      </main>
    </div>
  );
}
