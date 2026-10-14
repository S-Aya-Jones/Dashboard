"use client";

import { useState } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { ExposureHub } from "@/components/exposure/ExposureHub";
import { DashboardShell } from "@/components/DashboardShell";
import { ExposureView } from "@/components/exposure/ExposureView";
import { DrivingLadders } from "@/components/exposure/DrivingLadders";

export default function Page() {
  const [legacy, setLegacy] = useState(false);

  if (legacy) {
    return <DashboardShell>{({ data, update }) => <ExposureView data={data} update={update} />}</DashboardShell>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-8 max-w-4xl">
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Getting your life back</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Driving, bridges and heights — three ladders, each one rep at a time.
            </p>
          </div>
          <button onClick={() => setLegacy(true)} className="text-xs underline flex-shrink-0 mt-2"
            style={{ color: "var(--text-muted)" }}>
            old log
          </button>
        </div>
        <DrivingLadders />
        <div style={{ marginTop: "2rem" }}>
          <ExposureHub />
        </div>
      </main>
    </div>
  );
}
