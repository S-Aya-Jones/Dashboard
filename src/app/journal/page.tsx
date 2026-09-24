"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { JournalView } from "@/components/journal/JournalView";

export default function Page() {
  return (
    <DashboardShell>
      {({ data, update }) => (
        <>
          <div style={{ marginBottom: "1.25rem" }}>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Journal</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Type it or talk it. It keeps the date and waits for you.
            </p>
          </div>
          <JournalView data={data} update={update} />
        </>
      )}
    </DashboardShell>
  );
}
