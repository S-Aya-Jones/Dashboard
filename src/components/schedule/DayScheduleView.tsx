"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Calendar, Mail } from "lucide-react";

interface CalEvent {
  id: string; title: string; start: string; end: string | null;
  allDay: boolean; location?: string; source: "calendar";
}
interface EmailEvt {
  id: string; title: string; start: string; end: string | null;
  allDay: boolean; source: "email"; eventType: string; from: string;
}
type AnyEvent = (CalEvent | EmailEvt);

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5am–10pm

function fmt12(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDayHeader(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

const TYPE_COLORS: Record<string, string> = {
  exam:        "#EF4444",
  quiz:        "#F97316",
  appointment: "#10B981",
  bill:        "#6366F1",
  deadline:    "#F59E0B",
  gym:         "#22D3EE",
  other:       "#8B5CF6",
};

function eventColor(ev: AnyEvent): string {
  if (ev.source === "calendar") return "#0EA5E9";
  return TYPE_COLORS[(ev as EmailEvt).eventType] ?? TYPE_COLORS.other;
}

export function DayScheduleView() {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const [date, setDate] = useState(todayStr);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [emailEvents, setEmailEvents] = useState<EmailEvt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/schedule/day?date=${d}`);
      const data = await res.json();
      setCalEvents(data.calEvents ?? []);
      setEmailEvents(data.emailEvents ?? []);
    } catch {
      setError("Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const allDayEvs = [...calEvents.filter(e => e.allDay), ...emailEvents.filter(e => e.allDay)];
  const timedEvs  = [...calEvents.filter(e => !e.allDay), ...emailEvents.filter(e => !e.allDay)]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const isToday = date === todayStr;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button onClick={() => setDate(d => addDays(d, -1))}
          style={{ padding: "0.4rem 0.7rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)" }}>{fmtDayHeader(date)}</div>
          {isToday && <div style={{ fontSize: "0.75rem", color: "var(--purple)", fontWeight: 600 }}>Today</div>}
        </div>
        <button onClick={() => setDate(d => addDays(d, 1))}
          style={{ padding: "0.4rem 0.7rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}>
          <ChevronRight size={16} />
        </button>
        {date !== todayStr && (
          <button onClick={() => setDate(todayStr)}
            style={{ padding: "0.4rem 0.9rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--purple)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
            Today
          </button>
        )}
        <button onClick={() => load(date)}
          style={{ padding: "0.4rem 0.7rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}>
          <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
      </div>

      {error && <p style={{ color: "#EF4444", marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</p>}

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem", fontSize: "0.75rem" }}>
        {[
          { color: "#0EA5E9", label: "Google Calendar" },
          { color: "#10B981", label: "Appointment" },
          { color: "#EF4444", label: "Exam" },
          { color: "#F97316", label: "Quiz" },
          { color: "#22D3EE", label: "Gym" },
          { color: "#F59E0B", label: "Deadline" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--text-muted)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* ── All-day events ── */}
      {allDayEvs.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>All Day</div>
          {allDayEvs.map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.3rem", background: `${eventColor(ev)}18`, borderLeft: `3px solid ${eventColor(ev)}` }}>
              {ev.source === "calendar" ? <Calendar size={13} style={{ color: eventColor(ev), flexShrink: 0 }} /> : <Mail size={13} style={{ color: eventColor(ev), flexShrink: 0 }} />}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>{ev.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hour grid ── */}
      <div style={{ position: "relative", borderRadius: 12, border: "1.5px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
        {HOURS.map(h => {
          const hStr = h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
          const isCurrentHour = isToday && new Date().getHours() === h;
          const eventsThisHour = timedEvs.filter(ev => {
            const localH = new Date(ev.start).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" });
            return parseInt(localH) === h;
          });

          return (
            <div key={h} style={{
              display: "grid", gridTemplateColumns: "52px 1fr",
              borderBottom: h < 22 ? "1px solid var(--border)" : "none",
              background: isCurrentHour ? "rgba(124,92,252,0.04)" : undefined,
              minHeight: eventsThisHour.length > 0 ? undefined : 44,
            }}>
              <div style={{ padding: "10px 8px 0 8px", fontSize: "0.7rem", fontWeight: 600, color: isCurrentHour ? "var(--purple)" : "var(--text-muted)", textAlign: "right", lineHeight: 1 }}>
                {hStr}
              </div>
              <div style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {isToday && isCurrentHour && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--purple)", flexShrink: 0 }} />
                    <div style={{ height: 1.5, flex: 1, background: "var(--purple)", opacity: 0.4 }} />
                    <span style={{ fontSize: "0.7rem", color: "var(--purple)", fontWeight: 600 }}>
                      {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}
                    </span>
                  </div>
                )}
                {eventsThisHour.map(ev => (
                  <div key={ev.id} style={{
                    padding: "0.4rem 0.7rem", borderRadius: 7,
                    background: `${eventColor(ev)}18`,
                    borderLeft: `3px solid ${eventColor(ev)}`,
                    display: "flex", alignItems: "flex-start", gap: "0.5rem",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        {ev.source === "calendar"
                          ? <Calendar size={11} style={{ color: eventColor(ev), flexShrink: 0 }} />
                          : <Mail size={11} style={{ color: eventColor(ev), flexShrink: 0 }} />}
                        <span style={{ fontWeight: 600, fontSize: "0.83rem", color: "var(--text)" }}>{ev.title}</span>
                        {ev.source === "email" && (ev as EmailEvt).eventType && (
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: eventColor(ev), textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {(ev as EmailEvt).eventType}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {fmt12(ev.start)}
                        {ev.end && ` – ${fmt12(ev.end)}`}
                        {ev.source === "calendar" && (ev as CalEvent).location && ` · ${(ev as CalEvent).location}`}
                        {ev.source === "email" && (ev as EmailEvt).from && ` · ${(ev as EmailEvt).from}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {timedEvs.length === 0 && allDayEvs.length === 0 && !loading && (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📅</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No events found for this day</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "0.25rem" }}>Appointments from your email will appear here after scanning</div>
          </div>
        )}
      </div>

      {(timedEvs.length > 0 || allDayEvs.length > 0) && (
        <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "right" }}>
          {timedEvs.length + allDayEvs.length} event{timedEvs.length + allDayEvs.length !== 1 ? "s" : ""} · {calEvents.length} from Google Calendar · {emailEvents.length} from email
        </div>
      )}
    </div>
  );
}
