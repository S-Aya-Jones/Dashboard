"use client";

import { Sidebar } from "@/components/nav/Sidebar";
import { LectureStudio } from "@/components/lectures/LectureStudio";

export default function Page() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-4xl">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="font-serif text-3xl" style={{ color: "var(--text)" }}>Lecture Studio</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Drop a lecture → MP3 for the commute + notes, concept map, quiz &amp; flashcards. Misses feed your error log.
          </p>
        </div>
        <LectureStudio />
      </main>
    </div>
  );
}
