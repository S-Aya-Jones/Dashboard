"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { QBankView } from "@/components/qbank/QBankView";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-4xl">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Question Bank</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Every question from every lecture — vignettes, select-all, sequencing, matching, data, and draw-it prompts.
          </p>
        </div>
        <QBankView />
      </main>
    </div>
  );
}
