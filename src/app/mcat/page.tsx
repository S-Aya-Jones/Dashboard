"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { MCATView } from "@/components/mcat/MCATView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { ShadowingView } from "@/components/shadowing/ShadowingView";
import { QBankView } from "@/components/mcat/QBankView";
import { AnkiView } from "@/components/mcat/AnkiView";
import { StudyTimerView } from "@/components/mcat/StudyTimerView";
import { DiagnosticView } from "@/components/mcat/DiagnosticView";
import { LearnView } from "@/components/mcat/LearnView";
import { RunwayView } from "@/components/mcat/RunwayView";
import { StudyCaptureView } from "@/components/mcat/StudyCaptureView";
import { Brain, X, BookOpen } from "lucide-react";

const TABS = [
  { id: "mcat",       label: "MCAT Prep" },
  { id: "runway",     label: "137-Day Runway" },
  { id: "schedule",   label: "School & Schedule" },
  { id: "shadowing",  label: "Shadowing" },
  { id: "qbank",      label: "Q Bank" },
  { id: "studyscan",  label: "Study Scan" },
  { id: "flashcards", label: "Flashcards" },
  { id: "learn",      label: "Learn" },
  { id: "timer",      label: "Study Timer" },
  { id: "diagnostic", label: "Diagnostic" },
] as const;

type TabId = typeof TABS[number]["id"];

const SUBJECTS = [
  { name: "Behavioral Sciences", color: "#7C5CFC" },
  { name: "Biochemistry",        color: "#E879F9" },
  { name: "Biology",             color: "#10B981" },
  { name: "CARS",                color: "#FB923C" },
  { name: "General Chemistry",   color: "#F59E0B" },
  { name: "Organic Chemistry",   color: "#EF4444" },
  { name: "Physics",             color: "#6366F1" },
];

export default function Page() {
  const [tab, setTab] = useState<TabId>("mcat");
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayAnswered, setOverlayAnswered] = useState(false);
  const [startTimer, setStartTimer] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Show overlay when page first loads, once per session
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!overlayAnswered) setShowOverlay(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [overlayAnswered]);

  function handleYes() {
    setShowOverlay(false);
    setOverlayAnswered(true);
    setStartTimer(true);
    setTab("timer");
  }

  function handleNo() {
    setShowOverlay(false);
    setOverlayAnswered(true);
  }

  return (
    <DashboardShell>
      {({ data, update }) => (
        <div className="space-y-0 relative">

          {/* Study Session Overlay */}
          {showOverlay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
              style={{ background: "rgba(26,5,51,0.85)", backdropFilter: "blur(8px)" }}>
              <div className="w-full max-w-sm rounded-3xl p-6 relative"
                style={{ background: "var(--surface)", border: "1.5px solid var(--border)", boxShadow: "0 24px 80px rgba(124,92,252,0.3)" }}>

                <button onClick={handleNo} className="absolute top-4 right-4" style={{ color: "var(--text-muted)" }}>
                  <X size={18} />
                </button>

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #7C5CFC, #E879F9)" }}>
                  <Brain size={28} color="#fff" />
                </div>

                <h2 className="font-serif text-2xl text-center mb-1" style={{ color: "var(--text)" }}>
                  Starting a study session?
                </h2>
                <p className="text-sm text-center mb-5" style={{ color: "var(--text-muted)" }}>
                  Pick a subject and I&apos;ll track your time automatically
                </p>

                {/* Subject picker */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {SUBJECTS.map(s => (
                    <button key={s.name} onClick={() => setSelectedSubject(s.name)}
                      className="py-2.5 px-3 rounded-2xl text-xs font-semibold text-left transition-all"
                      style={{
                        background: selectedSubject === s.name ? s.color : `${s.color}15`,
                        color: selectedSubject === s.name ? "#fff" : s.color,
                        border: `1.5px solid ${selectedSubject === s.name ? s.color : `${s.color}30`}`,
                        boxShadow: selectedSubject === s.name ? `0 4px 12px ${s.color}40` : "none",
                      }}>
                      {s.name}
                    </button>
                  ))}
                  <button onClick={() => setSelectedSubject("All")}
                    className="py-2.5 px-3 rounded-2xl text-xs font-semibold col-span-2 transition-all"
                    style={{
                      background: selectedSubject === "All" ? "var(--grad)" : "var(--bg)",
                      color: selectedSubject === "All" ? "#fff" : "var(--text-muted)",
                      border: `1.5px solid ${selectedSubject === "All" ? "transparent" : "var(--border)"}`,
                    }}>
                    <BookOpen size={12} className="inline mr-1.5" />
                    Mixed / All Subjects
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button onClick={handleNo}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1.5px solid var(--border)" }}>
                    Not now
                  </button>
                  <button onClick={handleYes}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
                    style={{
                      background: "linear-gradient(135deg, #7C5CFC, #E879F9)",
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(124,92,252,0.4)",
                      opacity: selectedSubject ? 1 : 0.6,
                    }}>
                    Start Timer ⚡
                  </button>
                </div>

                <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
                  90+ min counts toward your 75 Hard goal
                </p>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 p-1 rounded-2xl overflow-x-auto"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-shrink-0 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
                style={tab === t.id
                  ? { background: "var(--grad)", color: "#fff", boxShadow: "0 2px 12px rgba(124,92,252,0.3)" }
                  : { color: "var(--text-muted)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mcat"       && <MCATView       data={data} update={update} />}
          {tab === "runway"     && <RunwayView     data={data} update={update} />}
          {tab === "schedule"   && <ScheduleView   data={data} update={update} />}
          {tab === "shadowing"  && <ShadowingView  data={data} update={update} />}
          {tab === "qbank"      && <QBankView      data={data} update={update} />}
          {tab === "studyscan"  && <StudyCaptureView data={data} update={update} />}
          {tab === "flashcards" && <AnkiView       data={data} update={update} />}
          {tab === "learn"      && <LearnView      data={data} update={update} />}
          {tab === "timer"      && (
            <StudyTimerView
              data={data}
              update={(fn) => {
                // Intercept saves to also check 75 Hard
                update(prev => {
                  const next = fn(prev);
                  const today = new Date().toISOString().slice(0, 10);
                  const todayLogs = (next.studyTimerLogs ?? []).filter(l => l.date === today);
                  const totalSecs = todayLogs.reduce((s, l) => s + l.durationSeconds, 0);
                  if (totalSecs >= 90 * 60 && next.seventyFiveHard) {
                    const h75 = next.seventyFiveHard;
                    const existingLog = h75.logs.find(l => l.date === today) ?? {
                      date: today, workout: false, steps: false, water: false,
                      mcat: false, progressPhoto: false, exposureTherapy: false, diet: false,
                    };
                    if (!existingLog.mcat) {
                      h75.logs = [...h75.logs.filter(l => l.date !== today), { ...existingLog, mcat: true }];
                      next.seventyFiveHard = h75;
                    }
                  }
                  return next;
                });
              }}
              autoStart={startTimer}
              autoSubject={selectedSubject ?? undefined}
            />
          )}
          {tab === "diagnostic" && <DiagnosticView data={data} update={update} />}
        </div>
      )}
    </DashboardShell>
  );
}
