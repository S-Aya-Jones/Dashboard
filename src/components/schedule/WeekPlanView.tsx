"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEK, CAT_COLORS, CAT_LABELS, DAY_ORDER, DAY_SHORT,
  planMinutes as mins, type Cat,
} from "@/lib/weekPlan";
import { applyChanges, rowsFromPlan, isoDate } from "@/lib/dayPlan";
import { tempWeekFor } from "@/lib/tempWeek";
import { useDatedChanges } from "@/lib/useDatedChanges";

// The master weekly template, rendered one day at a time — with whatever is
// temporary about that particular date laid on top.
//
// The plan itself lives in lib/weekPlan.ts so the Today page renders the same
// schedule this page shows; the temporary layer lives in lib/tempWeek.ts and
// in the changes she saves by voice. A day that differs says so, and says when
// it goes back to normal, so a catch-up week never turns into the new normal
// by accident.

function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function chicagoNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

/** Monday of the week containing `d`. */
function mondayOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

function shift(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function WeekPlanView() {
  const [now, setNow] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const n = chicagoNow();
    setNow(n);
    setWeekStart(mondayOf(n));
    const t = setInterval(() => setNow(chicagoNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = now?.getDay() ?? null;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Before the clock resolves on the client, show Monday rather than nothing.
  const day = picked ?? today ?? 1;

  // Dates for the week on screen, in Mon–Sun order to match DAY_ORDER.
  const dates = useMemo(() => {
    const base = weekStart ?? mondayOf(new Date());
    return DAY_ORDER.map((dow, i) => ({ dow, date: shift(base, i) }));
  }, [weekStart]);

  const current = dates.find(d => d.dow === day) ?? dates[0];
  const dateStr = isoDate(current.date);
  const isToday = now != null && isoDate(now) === dateStr;

  // One fetch covering the whole visible week rather than one per day.
  const changes = useDatedChanges(isoDate(dates[0].date), isoDate(dates[6].date));

  const plan = WEEK[current.dow];
  const merged = useMemo(
    () => applyChanges(rowsFromPlan(plan.blocks, current.date), changes, dateStr),
    [plan, changes, dateStr, current.date],
  );

  const currentIdx = isToday
    ? merged.rows.findIndex(b => nowMin >= mins(b.start) && nowMin < mins(b.end))
    : -1;
  const nextIdx = isToday
    ? merged.rows.findIndex(b => mins(b.start) > nowMin)
    : -1;

  const week = tempWeekFor(dateStr);
  const backToNormal = week
    ? longDate(shift(new Date(`${week.to}T12:00:00`), 1))
    : null;

  const heading = longDate(current.date);

  return (
    <div className="space-y-5">
      {/* Which week */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setWeekStart(w => shift(w ?? mondayOf(new Date()), -7)); }}
          className="px-2.5 py-2 rounded-full"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}
          aria-label="Previous week"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {dates.map(({ dow, date }) => {
            const on = dow === day;
            const ds = isoDate(date);
            const isNow = now != null && isoDate(now) === ds;
            const special = changes.some(c => c.date === ds);
            return (
              <button
                key={dow}
                onClick={() => setPicked(dow)}
                className="flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: on ? "var(--text)" : "var(--surface)",
                  color:      on ? "var(--surface)" : "var(--text-muted)",
                  border:     `1.5px solid ${on ? "var(--text)" : "var(--border)"}`,
                }}
              >
                {DAY_SHORT[dow]}{" "}
                <span style={{ opacity: 0.65, fontWeight: 500 }}>{date.getDate()}</span>
                {(isNow || special) && !on && (
                  <span
                    className="inline-block ml-1.5 rounded-full align-middle"
                    style={{ width: 5, height: 5, background: special ? CAT_COLORS.study : CAT_COLORS.therapy }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { setWeekStart(w => shift(w ?? mondayOf(new Date()), 7)); }}
          className="px-2.5 py-2 rounded-full"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}
          aria-label="Next week"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Why today isn't the usual day */}
      {merged.temporary && (
        <div
          className="rounded-2xl px-5 py-3.5"
          style={{ background: "rgba(180,85,47,0.08)", border: `1.5px solid ${CAT_COLORS.study}55` }}
        >
          <p className="text-sm font-semibold" style={{ color: CAT_COLORS.study }}>
            Temporary schedule{merged.weekName ? ` — ${merged.weekName}` : ""}
          </p>
          {merged.weekWhy && (
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {merged.weekWhy}
            </p>
          )}
          {backToNormal && (
            <p className="text-xs mt-1.5" style={{ color: "var(--text-light)" }}>
              Your normal week is back on {backToNormal}. Nothing here changes it.
            </p>
          )}
        </div>
      )}

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
                Right now: <span style={{ color: "var(--text)", fontWeight: 600 }}>{merged.rows[currentIdx].label}</span>
              </p>
            )}
            {isToday && currentIdx < 0 && nextIdx >= 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Next up at {fmt(merged.rows[nextIdx].start)}:{" "}
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{merged.rows[nextIdx].label}</span>
              </p>
            )}
          </div>
          {plan.sub && !merged.temporary && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-light)" }}>{plan.sub}</p>
          )}
        </div>

        <div className="px-4 py-3 md:px-6 md:py-4">
          {merged.rows.map((b, i) => {
            const active = i === currentIdx;
            const past   = isToday && nowMin >= mins(b.end);
            return (
              <div
                key={b.key}
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
                  style={{ background: b.color }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="leading-snug"
                    style={{ color: "var(--text)", fontWeight: active ? 700 : 500 }}
                  >
                    {b.label}
                    {b.temporary && (
                      <span
                        className="ml-2 text-[10px] font-bold uppercase tracking-wider align-middle px-1.5 py-0.5 rounded-full"
                        style={{ background: `${CAT_COLORS.study}1f`, color: CAT_COLORS.study }}
                      >
                        this week
                      </span>
                    )}
                    {active && (
                      <span className="ml-2 text-xs font-bold" style={{ color: CAT_COLORS.study }}>now</span>
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

        {/* What the temporary week took out, so nothing disappears silently */}
        {merged.cut.length > 0 && (
          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-light)" }}>
              Cut from today
            </p>
            <ul className="space-y-1">
              {merged.cut.map((c, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--text-muted)" }}>
                  <span style={{ textDecoration: "line-through" }}>{c.label}</span>
                  {c.note && <span style={{ color: "var(--text-light)" }}> — {c.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
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
              The gym sits between getting home and Block 1 — five slots a week so four still
              happen when a day gets eaten. Forty-five minutes moving, fifteen to shower.
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
