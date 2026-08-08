"use client";

import { useEffect, useState } from "react";
import { GraduationCap, X, Maximize2 } from "lucide-react";
import Link from "next/link";
import { TutorView } from "./TutorView";

// The tutor, available from anywhere.
//
// Mounted in the root layout rather than on a page, so the conversation
// survives navigating between Today, Lectures and Qbank — you can ask
// something while looking at the thing that prompted it, which is when the
// question actually occurs to you.

export function TutorDock() {
  const [open, setOpen] = useState(false);

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
          aria-label="Open the tutor"
          className="fixed z-40 rounded-full grid place-items-center shadow-xl transition-transform active:scale-95"
          style={{
            // Above the voice button, clear of the mobile tab bar.
            right: "1.25rem",
            bottom: "10.5rem",
            width: 52,
            height: 52,
            background: "var(--surface)",
            color: "var(--purple)",
            border: "1.5px solid var(--border2)",
          }}
        >
          <GraduationCap size={22} />
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
              <p className="font-serif text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
                <GraduationCap size={17} style={{ color: "var(--purple)" }} /> Tutor
              </p>
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
              <TutorView compact />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
