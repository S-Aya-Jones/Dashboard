"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { TutorView } from "@/components/tutor/TutorView";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-44 md:pb-8">
        <div className="max-w-3xl mx-auto">
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Tutor</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Teaches from your own lectures, and already knows what you&apos;ve been getting wrong.
            </p>
          </div>
          <TutorView />
        </div>
      </main>
    </div>
  );
}
