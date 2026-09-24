"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { ReviewSession } from "@/components/review/ReviewSession";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div style={{ maxWidth: "40rem", margin: "0 auto" }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Review</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Every lecture&apos;s cards, on their own schedule — the ones you miss come back sooner
            </p>
          </div>
          <ReviewSession />
        </div>
      </main>
    </div>
  );
}
