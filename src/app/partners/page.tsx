"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { PartnersView } from "@/components/partners/PartnersView";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-44 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Study partners</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Give someone a link and they can quiz you from your own lectures.
            </p>
          </div>
          <PartnersView />
        </div>
      </main>
    </div>
  );
}
