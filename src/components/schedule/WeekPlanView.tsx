"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

// The master weekly template — the system, always visible, independent of
// Google Calendar.
//
// This used to render all seven days at once as a wall of small text, which
// meant reading everything to find anything. Now it opens on today, full size,
// with the current block marked; the other days are one tap away.

type Cat = "gym" | "study" | "work" | "exposure" | "therapy" | "life" | "people" | "rest";

interface Block { start: string; end: string; label: string; cat: Cat; note?: string }

// Warm palette only — these sit next to clay, gold and sage, so nothing
// cold or neon.
const CAT_COLORS: Record<Cat, string> = {
  gym:      "#3F6F5E",
  study:    "#B4552F",
  work:     "#8A7A66",
  exposure: "#E0A44A",
  therapy:  "#71816D",
  life:     "#C9A227",
  people:   "#C9748A",
  rest:     "#A8967E",
};

const CAT_LABELS: Record<Cat, string> = {
  gym: "Gym", study: "Study", work: "Work + classes", exposure: "Exposure",
  therapy: "Therapy", life: "Home & errands", people: "People", rest: "Rest & wind-down",
};

const WEEK: Record<number, { name: string; sub?: string; blocks: Block[] }> = {
  1: { name: "Monday", blocks: [
    { start: "05:00", end: "05:15", label: "Up — clothes staged last night", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (1 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "12:00", label: "Work · Biochem 8–10 · Physio 10–12", cat: "work", note: "Capture mode · heights dose at the 10:00 class switch" },
    { start: "12:00", end: "14:30", label: "Work (no classes) · heights dose 1:30", cat: "work", note: "Flashcards in the gaps" },
    { start: "14:30", end: "15:20", label: "Extended-route drive home", cat: "exposure", note: "Driving exposure #1 — no time pressure" },
    { start: "15:20", end: "17:00", label: "Flex — flashcards, admin, breathe", cat: "rest" },
    { start: "17:00", end: "18:30", label: "Block 1 — Biochemistry", cat: "study", note: "Same-day review · questions first · deadline overrides in exam weeks" },
    { start: "18:30", end: "19:00", label: "Dinner (Sunday-cooked)", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Physiology", cat: "study", note: "Log every miss in the error log" },
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
    { start: "17:00", end: "18:30", label: "Block 1 — Cell & Molecular Bio", cat: "study", note: "Same-day review · questions first" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Microbiology", cat: "study", note: "Log every miss" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  3: { name: "Wednesday", sub: "Work from home", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:45", label: "MCAT — content review only", cat: "study", note: "Parked at 90 min/week until Sep 1, then scales up" },
    { start: "07:00", end: "11:00", label: "WFH · Biochem 8–10 · Physio from 10", cat: "work", note: "Capture mode from your desk" },
    { start: "11:00", end: "12:00", label: "Therapy", cat: "therapy", note: "Overlaps Physiology 10–12 — catch the recording after" },
    { start: "12:00", end: "15:00", label: "Work · Physio recording", cat: "work", note: "Re-watch the hour you missed" },
    { start: "15:00", end: "17:00", label: "Cook Thu/Fri meals", cat: "life", note: "Lecture recordings playing" },
    { start: "17:00", end: "18:30", label: "Light review — Biochem + Physio flashcards", cat: "study", note: "No new material after therapy" },
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
    { start: "17:00", end: "18:30", label: "Block 1 — Microbiology", cat: "study", note: "Flipped so Micro isn't always the tired block" },
    { start: "18:30", end: "19:00", label: "Dinner", cat: "life" },
    { start: "19:00", end: "20:00", label: "Block 2 — Cell & Molecular Bio", cat: "study" },
    { start: "20:00", end: "21:00", label: "Skincare hour + call", cat: "rest" },
  ]},
  5: { name: "Friday", blocks: [
    { start: "05:00", end: "05:15", label: "Up", cat: "rest" },
    { start: "05:15", end: "06:10", label: "Gym (4 of 4)", cat: "gym" },
    { start: "06:10", end: "07:00", label: "Shower, ready, breakfast", cat: "rest" },
    { start: "07:00", end: "14:30", label: "Work — no classes on Fridays", cat: "work", note: "Heights doses 10:00 & 1:30 · clean work day" },
    { start: "15:00", end: "15:30", label: "Budget check (paydays)", cat: "life", note: "Bills tab is already sorted" },
    { start: "15:30", end: "17:00", label: "Weakest subject of the week", cat: "study", note: "No classes Friday — the pressure valve · 2nd shadowing slot fits here" },
    { start: "18:00", end: "21:00", label: "Geandra time", cat: "people", note: "The week's one late night — bed by 10:30" },
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
const SHORT: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };

function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function mins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function chicagoNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

export function WeekPlanView() {
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    setNow(chicagoNow());
    const t = setInterval(() => setNow(chicagoNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = now?.getDay() ?? null;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Before the clock resolves on the client, show Monday rather than nothing.
  const day = picked ?? today ?? 1;
  const isToday = day === today;
  const plan = WEEK[day];

  const currentIdx = isToday
    ? plan.blocks.findIndex((b) => nowMin >= mins(b.start) && nowMin < mins(b.end))
    : -1;
  const nextIdx = isToday
    ? plan.blocks.findIndex((b) => mins(b.start) > nowMin)
    : -1;

  const heading = isToday
    ? now!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : plan.name;

  return (
    <div className="space-y-5">
      {/* Day picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DAY_ORDER.map((d) => {
          const on = d === day;
          const isNow = d === today;
          return (
            <button
              key={d}
              onClick={() => setPicked(d)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                background: on ? "var(--text)" : "var(--surface)",
                color:      on ? "var(--surface)" : "var(--text-muted)",
                border:     `1.5px solid ${on ? "var(--text)" : "var(--border)"}`,
              }}
            >
              {SHORT[d]}
              {isNow && !on && (
                <span
                  className="inline-block ml-1.5 rounded-full align-middle"
                  style={{ width: 5, height: 5, background: "var(--purple)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* The day itself */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
      >
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>{heading}</h2>
            {isToday && currentIdx >= 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Right now: <span style={{ color: "var(--text)", fontWeight: 600 }}>{plan.blocks[currentIdx].label}</span>
              </p>
            )}
            {isToday && currentIdx < 0 && nextIdx >= 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Next up at {fmt(plan.blocks[nextIdx].start)}:{" "}
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{plan.blocks[nextIdx].label}</span>
              </p>
            )}
          </div>
          {plan.sub && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-light)" }}>{plan.sub}</p>
          )}
        </div>

        <div className="px-4 py-3 md:px-6 md:py-4">
          {plan.blocks.map((b, i) => {
            const active = i === currentIdx;
            const past   = isToday && nowMin >= mins(b.end);
            return (
              <div
                key={i}
                className="flex gap-3 md:gap-4 rounded-xl px-2 md:px-3 py-2.5"
                style={{
                  background: active ? "rgba(180,85,47,0.07)" : undefined,
                  opacity: past ? 0.5 : 1,
                }}
              >
                <span
                  className="text-xs tabular-nums text-right pt-0.5 flex-shrink-0 leading-relaxed"
                  style={{ color: "var(--text-light)", width: "5.5rem" }}
                >
                  {fmt(b.start)}<br />{fmt(b.end)}
                </span>
                <span
                  className="w-1 rounded-full flex-shrink-0 self-stretch"
                  style={{ background: CAT_COLORS[b.cat] }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="leading-snug"
                    style={{ color: "var(--text)", fontWeight: active ? 700 : 500 }}
                  >
                    {b.label}
                    {active && (
                      <span className="ml-2 text-xs font-bold" style={{ color: "var(--purple)" }}>now</span>
                    )}
                  </p>
                  {b.note && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {b.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supporting detail, out of the way until asked for */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
        <button
          onClick={() => setShowRules((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold"
          style={{ background: "var(--surface)", color: "var(--text-muted)" }}
        >
          How this week works
          <ChevronDown
            size={15}
            style={{ transform: showRules ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
          />
        </button>
        {showRules && (
          <div className="px-5 pb-5 pt-1 space-y-4" style={{ background: "var(--surface)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Evenings anchor to that morning’s classes — Biochem and Physio on Monday and
              Wednesday, CMB and Micro on Tuesday and Thursday. Same-day review is the strongest
              defence against forgetting. Within five days of a quiz or seven of an exam, that
              course takes Block 1 instead.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Exam-week mode: shadowing pauses first, Saturday exposure shrinks to a 30-minute
              maintenance drive, and MCAT drops to Wednesday only.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {(Object.keys(CAT_COLORS) as Cat[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-light)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[c] }} />
                  {CAT_LABELS[c]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
