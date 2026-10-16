"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { BreakPlanView } from "@/components/break/BreakPlanView";

export default function Page() {
  return (
    <DashboardShell>
      {({ data, update }) => (
        <>
          <div style={{ marginBottom: "1.25rem" }}>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>The break</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              What this stretch is for, and the short list of things waiting on you
            </p>
          </div>
          <BreakPlanView data={data} update={update} />
        </>
      )}
    </DashboardShell>
  );
}
