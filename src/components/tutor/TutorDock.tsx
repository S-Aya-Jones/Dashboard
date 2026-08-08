"use client";

import { useEffect, useState } from "react";
import { GraduationCap, X, Maximize2 } from "lucide-react";
import Link from "next/link";
import { TutorView } from "./TutorView";
import { useStudyContext } from "@/lib/studyContext";

// The tutor, available from anywhere.
//
// Mounted in the root layout rather than on a page, so the conversation
// survives navigating between Today, Lectures and Qbank — you can ask
// something while looking at the thing that prompted it, which is when the
// question actually occurs to you.

export function TutorDock() {
  const [open, setOpen] = useState(false);
  const study = useStudyContext();

  // Escape closes it, like any other panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask the tutor"
          className="fixed z-40 rounded-full flex items-center gap-2 shadow-xl transition-transform active:scale-95"
          style={{
            // Above the voice button, clear of the mobile tab bar.
            right: "1.25rem",
            bottom: "10.5rem",
            height: 52,
            padding: study.course ? "0 1.1rem 0 0.95rem" : "0 0.95rem",
            background: "var(--surface)",
            color: "var(--purple)",
            border: "1.5px solid var(--border2)",
          }}
        >
          <GraduationCap size={22} />
          {/* Naming the subject makes it read as "ask about this", which is
              the only reason to reach for it mid-quiz. */}
          <span className="text-sm font-semibold hidden sm:inline" style={{ color: "var(--text)" }}>
            {study.course ? `Ask about ${study.course}` : "Ask the tutor"}
          </span>
        </button>
      )}

      {open && (
        <>
          {/* Dimmer only on small screens — on desktop the page stays usable
              beside the panel, which is the point of docking it. */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(20,16,13,0.5)" }}
          />

          <aside
            className="fixed z-50 flex flex-col"
            style={{
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(30rem, 100vw)",
              background: "var(--bg)",
              borderLeft: "1.5px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <p className="font-serif text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
                  <GraduationCap size={17} style={{ color: "var(--purple)" }} /> Tutor
                </p>
                {study.lectureTitle && (
                  <p className="text-xs truncate" style={{ color: "var(--text-light)" }}>
                    on {study.lectureTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/tutor"
                  onClick={() => setOpen(false)}
                  aria-label="Open full screen"
                  className="p-2 rounded-lg"
                  style={{ color: "var(--text-light)" }}
                >
                  <Maximize2 size={15} />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close the tutor"
                  className="p-2 rounded-lg"
                  style={{ color: "var(--text-light)" }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <TutorView compact course={study.course} lectureId={study.lectureId} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
