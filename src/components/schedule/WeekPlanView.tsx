"use client";

import { useEffect, useState } from "react";

// The master weekly template — the system, always visible, independent of
// Google Calendar. Categories drive the color coding.

type Cat = "gym" | "study" | "work" | "exposure" | "therapy" | "life" | "people" | "rest";

interface Block { start: string; end: string; label: string; cat: Cat; note?: string }

const CAT_COLORS: Record<Cat, string> = {
  gym:      "#2bb3a3",
  study:    "#7C5CFC",
  work:     "#8a8fa3",
  exposure: "#e8842c",
  therapy:  "#3aa864",
  life:     "#d16ba5",
  people:   "#c94f7c",
  rest:     "#5b8def",
};

const CAT_LABELS: Record<Cat, string> = {
  gym: "Gym", study: "Study", work: "Work + classes", exposure: "Exposure",
  therapy: "Therapy", life: "Home & errands", people: "People", rest: "Rest & wind-down",
};

const WEEK: Record<number, { name: string; blocks: Block[] }> = {
  1: { name: "Monday", blocks: [
    { start: "05:00", end: "05:15", label: "Up — clothes staged last night", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (1 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · Biochem 8–10 · Physio 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Work (no classes) · heights dose 1:30", cat: "work", note: "Flashcards in the gaps" },
    { start: "14:30", end: "15:20", label: "Extended-route drive home", cat: "exposure", note: "Driving exposure #1 — no time pressure" },
    { start: "15:20", end: "17:00", label: "Flex — flashcards, admin, breathe", cat: "rest" },
    { start: "17:00", end: "18:30", label: "Study Block 1 — nearest assessment, questions first", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner (Sunday-cooked)", cat: "life" },
    { start: "19:00", end: "20:00", label: "Study Block 2 — second course + error log", cat: "study" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call him", cat: "rest", note: "Gym bag staged · lights out at 9" },
  ]},
  2: { name: "Tuesday", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (2 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · CMB 8–10 · Micro 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Work (no classes) · heights dose 1:30", cat: "work" },
    { start: "14:30", end: "15:00", label: "Drive home — direct", cat: "work" },
    { start: "15:00", end: "17:00", label: "Flex — flashcards, admin, breathe", cat: "rest" },
    { start: "17:00", end: "18:30", label: "Study Block 1 — questions first", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Study Block 2 + error log", cat: "study" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  3: { name: "Wednesday · WFH", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:45", label: "MCAT block — freshest 90 min of the week", cat: "study" },
    { start: "07:00", end: "12:00", label: "WFH · Biochem 8–10 · Physio 10–12", cat: "work", note: "Capture mode from your desk" },
    { start: "12:00", end: "13:00", label: "Therapy (lunch)", cat: "therapy", note: "Anchored to the no-driving day" },
    { start: "13:00", end: "15:00", label: "Work winds down", cat: "work" },
    { start: "15:00", end: "17:00", label: "Cook Thu/Fri meals", cat: "life", note: "Lecture recordings playing" },
    { start: "17:00", end: "18:30", label: "Light review only — no new material post-therapy", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Buffer — deliberately empty", cat: "rest", note: "Absorbs the week's overflow" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  4: { name: "Thursday", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (3 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · CMB 8–10 · Micro 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Work (no classes) · heights dose 1:30", cat: "work" },
    { start: "14:30", end: "16:30", label: "Home · flex — flashcards, admin", cat: "rest" },
    { start: "16:30", end: "17:00", label: "Short exposure drive", cat: "exposure", note: "Driving exposure #2 — 20-min loop" },
    { start: "17:00", end: "18:30", label: "Study Block 1 — questions first", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Study Block 2 + error log", cat: "study" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  5: { name: "Friday", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (4 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work — no classes on Fridays", cat: "work", note: "Heights doses 10:00 & 1:30 · clean work day" },
    { start: "15:00", end: "15:30", label: "Budget check (paydays)", cat: "life", note: "Bills tab is already sorted" },
    { start: "15:30", end: "17:00", label: "Friday light study — wrap the week", cat: "study" },
    { start: "18:00", end: "21:00", label: "Geandra time 💜", cat: "people", note: "The week's one late night — bed by 10:30" },
  ]},
  6: { name: "Saturday", blocks: [
    { start: "06:30", end: "07:15", label: "Up + breakfast", cat: "rest" },
    { start: "07:30", end: "11:30", label: "Hospital shadowing", cat: "people", note: "Pauses first during exam weeks" },
    { start: "12:00", end: "12:30", label: "Lunch", cat: "life" },
    { start: "12:30", end: "14:00", label: "Major driving exposure", cat: "exposure", note: "The big weekly session — never before an assessment" },
    { start: "14:30", end: "15:30", label: "Reserved: Therapist B", cat: "therapy", note: "Placeholder until day confirmed" },
    { start: "15:30", end: "17:00", label: "Cleaning reset", cat: "life" },
    { start: "17:00", end: "22:00", label: "Open — social, boyfriend visits, nothing", cat: "people", note: "Real flex, not failure" },
    { start: "22:00", end: "22:30", label: "Skincare, bed", cat: "rest" },
  ]},
  0: { name: "Sunday", blocks: [
    { start: "06:30", end: "07:00", label: "Up + breakfast", cat: "rest" },
    { start: "07:00", end: "08:30", label: "Long study — fresh brain before church", cat: "study" },
    { start: "09:00", end: "12:00", label: "Church", cat: "people" },
    { start: "12:30", end: "14:00", label: "Family time + lunch", cat: "people" },
    { start: "14:00", end: "15:00", label: "Groceries", cat: "life" },
    { start: "15:00", end: "17:00", label: "Cook Mon–Wed meals", cat: "life", note: "Lecture recordings playing" },
    { start: "17:00", end: "18:30", label: "Study — error log review", cat: "study" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "19:30", label: "Week planning — Deadlines tab, assign every block", cat: "study", note: "Check if exam-week mode activates" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function chicagoNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

export function WeekPlanView() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(chicagoNow());
    const t = setInterval(() => setNow(chicagoNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = now?.getDay();
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(CAT_COLORS) as Cat[]).map(c => (
          <span key={c} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[c] }} />
            {CAT_LABELS[c]}
          </span>
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Exam-week mode (auto, week of any exam): shadowing pauses · Saturday exposure shrinks to a 30-min maintenance drive · MCAT drops to Wednesday only · freed hours go to the error log.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {DAY_ORDER.map(d => {
          const day = WEEK[d];
          const isToday = today === d;
          return (
            <div key={d} className="rounded-2xl p-4"
              style={{
                background: "var(--surface)",
                border: isToday ? "2px solid var(--purple)" : "1.5px solid var(--border)",
                boxShadow: isToday ? "0 4px 20px rgba(124,92,252,0.15)" : undefined,
              }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-lg" style={{ color: "var(--text)" }}>{day.name}</h3>
                {isToday && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "var(--purple)" }}>
                    Today
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {day.blocks.map((b, i) => {
                  const [sh, sm] = b.start.split(":").map(Number);
                  const [eh, em] = b.end.split(":").map(Number);
                  const active = isToday && nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
                  return (
                    <div key={i} className="flex gap-2.5 rounded-lg px-2 py-1.5"
                      style={active ? { background: "rgba(124,92,252,0.10)", border: "1px solid rgba(124,92,252,0.35)" } : undefined}>
                      <span className="w-1 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[b.cat] }} />
                      <div className="min-w-0">
                        <div className="text-sm leading-snug" style={{ color: "var(--text)" }}>
                          <span className="font-semibold" style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginRight: 6 }}>
                            {fmt(b.start)}–{fmt(b.end)}
                          </span>
                          {b.label}
                          {active && <span className="ml-2 text-xs font-bold" style={{ color: "var(--purple)" }}>← now</span>}
                        </div>
                        {b.note && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{b.note}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
