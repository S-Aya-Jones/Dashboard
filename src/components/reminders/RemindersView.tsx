"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Plus, Trash2, Check, X, MessageSquare, RefreshCw, BookOpen, Calendar } from "lucide-react";

interface Reminder {
  id: string;
  title: string;
  body?: string;
  scheduleType: "daily" | "weekly" | "once";
  timeOfDay: string;
  daysOfWeek?: number[];
  nextRunAt?: string;
  active: boolean;
  createdAt: string;
}

interface InboundLog {
  id:          string;
  rawText:     string;
  parsedType?: string;
  receivedAt:  string;
}

interface UpcomingEvent {
  id:            string;
  eventType:     string;
  title:         string;
  eventDate:     string;
  sourceSender:  string;
  sourceSubject: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt12(timeOfDay: string) {
  const [hStr, mStr] = timeOfDay.split(":");
  const h    = parseInt(hStr, 10);
  const m    = parseInt(mStr ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function fmtDays(days: number[]) {
  return days.map(d => DAY_NAMES[d]).join(", ");
}

function fmtRelative(iso: string) {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtEventDate(iso: string) {
  const d   = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });

  if (diffDays === 0)      return `Today at ${timeStr}`;
  if (diffDays === 1)      return `Tomorrow at ${timeStr}`;
  if (diffDays <= 6)       return `${dateStr} at ${timeStr}`;
  return dateStr;
}

function urgencyColor(iso: string): string {
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diffDays <= 1)  return "#ef4444";
  if (diffDays <= 3)  return "#f97316";
  if (diffDays <= 7)  return "#eab308";
  return "var(--purple)";
}

function isCourseDeadline(e: UpcomingEvent): boolean {
  return e.sourceSender === "Microbiology" || e.sourceSender === "Cell & Molecular Bio" ||
    e.sourceSender === "Physiology" || e.sourceSender === "Biochemistry";
}

const COURSE_COLORS: Record<string, string> = {
  "Microbiology":         "#22c55e",
  "Cell & Molecular Bio": "#B4552F",
  "Physiology":           "#06b6d4",
  "Biochemistry":         "#f97316",
};

const TYPE_COLORS: Record<string, string> = {
  remind_created: "#22c55e",
  reminder_off:   "#f97316",
  reminder_on:    "#22c55e",
  free_text:      "#B4552F",
  explicit_log:   "#B4552F",
  list:           "#06b6d4",
  help:           "#06b6d4",
  start:          "#06b6d4",
};

const DAY_BTNS = [
  { label: "Su", value: 0 }, { label: "Mo", value: 1 },
  { label: "Tu", value: 2 }, { label: "We", value: 3 },
  { label: "Th", value: 4 }, { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

function ReminderCard({ r, onToggle, onDelete }: {
  r: Reminder;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const schedLabel = r.scheduleType === "daily"
    ? `Daily at ${fmt12(r.timeOfDay)}`
    : r.scheduleType === "weekly"
    ? `${fmtDays(r.daysOfWeek ?? [])} at ${fmt12(r.timeOfDay)}`
    : r.nextRunAt
    ? `Once · ${new Date(r.nextRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${fmt12(r.timeOfDay)}`
    : `Once at ${fmt12(r.timeOfDay)}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: r.active ? "var(--surface)" : "var(--bg)", borderRadius: 12, border: `1.5px solid ${r.active ? "var(--border2)" : "var(--border)"}`, opacity: r.active ? 1 : 0.6, transition: "all 0.2s" }}>
      <button onClick={() => onToggle(r.id, !r.active)}
        style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, background: r.active ? "var(--purple)" : "var(--border)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 2, left: r.active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>{schedLabel}</p>
      </div>
      <button onClick={() => onDelete(r.id)}
        style={{ flexShrink: 0, padding: "0.35rem", background: "transparent", border: "none", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer" }}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

interface FormState {
  title: string; body: string; scheduleType: "daily" | "weekly" | "once";
  hour: string; minute: string; ampm: "AM" | "PM"; daysOfWeek: number[]; date: string;
}
const BLANK: FormState = { title: "", body: "", scheduleType: "daily", hour: "7", minute: "00", ampm: "PM", daysOfWeek: [], date: "" };

const ALL_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function RemindersView() {
  const [tab,          setTab]          = useState<"deadlines" | "messages" | "reminders">("deadlines");
  const [reminders,    setReminders]    = useState<Reminder[]>([]);
  const [logs,         setLogs]         = useState<InboundLog[]>([]);
  const [events,       setEvents]       = useState<UpcomingEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [seeding,      setSeeding]      = useState(false);
  const [seedMsg,      setSeedMsg]      = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState<FormState>(BLANK);

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/inbound-logs");
      if (res.ok) setLogs(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/gmail/upcoming-events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const [rRes, lRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/inbound-logs"),
      ]);
      if (rRes.ok) setReminders(await rRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      await loadEvents();
    } finally {
      setLoading(false);
    }
  }, [loadEvents]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "messages") return;
    const t = setInterval(() => loadLogs(true), 30_000);
    return () => clearInterval(t);
  }, [tab, loadLogs]);

  const handleToggle = async (id: string, active: boolean) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, active } : r));
    await fetch(`/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
  };

  const handleDelete = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
  };

  const handleSeedDeadlines = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/courses/seed", { method: "POST" });
      const data = await res.json();
      setSeedMsg(data.message ?? "Done");
      await loadEvents();
    } catch (e) {
      setSeedMsg("Error seeding: " + String(e));
    } finally {
      setSeeding(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    if (form.scheduleType === "once" && !form.date) return;
    setSaving(true);
    let h = parseInt(form.hour, 10);
    if (form.ampm === "PM" && h !== 12) h += 12;
    if (form.ampm === "AM" && h === 12) h = 0;
    const timeOfDay = `${h.toString().padStart(2, "0")}:${form.minute}`;
    let nextRunAt: string | undefined;
    if (form.scheduleType === "once" && form.date) {
      const [yr, mo, dy] = form.date.split("-").map(Number);
      nextRunAt = new Date(yr, mo - 1, dy, h, parseInt(form.minute), 0, 0).toISOString();
    }
    try {
      const res = await fetch("/api/reminders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), body: form.body.trim() || undefined, scheduleType: form.scheduleType, timeOfDay, daysOfWeek: form.scheduleType === "weekly" ? form.daysOfWeek : undefined, nextRunAt }),
      });
      if (res.ok) { const created = await res.json(); setReminders(prev => [created, ...prev]); setForm(BLANK); setShowForm(false); }
    } finally { setSaving(false); }
  };

  const toggleDay = (d: number) => setForm(prev => {
    const has = prev.daysOfWeek.includes(d);
    return { ...prev, daysOfWeek: has ? prev.daysOfWeek.filter(x => x !== d) : [...prev.daysOfWeek, d] };
  });

  const active   = reminders.filter(r => r.active);
  const inactive = reminders.filter(r => !r.active);

  const courseEvents = events.filter(isCourseDeadline);
  const emailEvents  = events.filter(e => !isCourseDeadline(e));

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--purple)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>Telegram</h1>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>Two-way bot · @AyaDashboardbot</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", background: "var(--bg)", borderRadius: 12, padding: "0.25rem" }}>
        {([
          { key: "deadlines", label: "Deadlines", icon: <BookOpen size={14} />,      count: events.length },
          { key: "messages",  label: "Messages",  icon: <MessageSquare size={14} />, count: logs.length },
          { key: "reminders", label: "Reminders", icon: <Bell size={14} />,           count: active.length },
        ] as const).map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.6rem 0.6rem", borderRadius: 10, border: "none", background: tab === key ? "var(--surface)" : "transparent", color: tab === key ? "var(--purple)" : "var(--text-muted)", fontWeight: tab === key ? 600 : 500, fontSize: "0.8rem", cursor: "pointer", boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
            {icon} {label}
            {count > 0 && <span style={{ fontSize: "0.7rem", background: tab === key ? "var(--purple)" : "var(--border)", color: tab === key ? "#fff" : "var(--text-muted)", borderRadius: 10, padding: "0.05rem 0.4rem", fontWeight: 700 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* ── Deadlines tab ── */}
      {tab === "deadlines" && (
        <div>
          {/* Seed button + status */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <button onClick={handleSeedDeadlines} disabled={seeding}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", background: "rgba(180,85,47,0.1)", border: "1.5px solid var(--purple)", borderRadius: 10, color: "var(--purple)", fontSize: "0.8rem", fontWeight: 600, cursor: seeding ? "wait" : "pointer", opacity: seeding ? 0.6 : 1 }}>
              <RefreshCw size={13} style={{ animation: seeding ? "spin 0.8s linear infinite" : "none" }} />
              {seeding ? "Seeding…" : "Sync Course Deadlines"}
            </button>
            {seedMsg && <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{seedMsg}</span>}
          </div>

          {/* Course deadlines */}
          {courseEvents.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Course Exams &amp; Quizzes
              </p>

              {/* Course legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {Object.entries(COURSE_COLORS).map(([course, color]) => (
                  <span key={course} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", background: `${color}18`, borderRadius: 20, fontSize: "0.7rem", color, fontWeight: 600, border: `1px solid ${color}40` }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {course}
                  </span>
                ))}
              </div>

              <div style={{ display: "grid", gap: "0.45rem" }}>
                {courseEvents.map(ev => {
                  const color = COURSE_COLORS[ev.sourceSender] ?? "var(--purple)";
                  const isExam = ev.title.toLowerCase().includes("exam");
                  const urg = urgencyColor(ev.eventDate);
                  return (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--surface)", borderRadius: 12, border: `1.5px solid ${isExam ? `${urg}60` : "var(--border)"}`, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: "4px 0 0 4px" }} />
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: "0.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>{ev.title}</p>
                          {isExam && <span style={{ fontSize: "0.65rem", fontWeight: 700, background: `${urg}20`, color: urg, padding: "0.1rem 0.45rem", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>EXAM</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: isExam ? urg : "var(--text-muted)", fontWeight: isExam ? 600 : 400 }}>
                          <Calendar size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                          {fmtEventDate(ev.eventDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {courseEvents.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", background: "var(--surface)", borderRadius: 16, border: "1.5px dashed var(--border)", marginBottom: "1.5rem" }}>
              <BookOpen size={28} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "0.5rem" }} />
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--text)", fontSize: "0.9rem" }}>No course deadlines loaded</p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>Click "Sync Course Deadlines" to load all exams and quizzes from your syllabi.</p>
            </div>
          )}

          {/* Email-derived events */}
          {emailEvents.length > 0 && (
            <div>
              <p style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                From Your Inbox
              </p>
              <div style={{ display: "grid", gap: "0.45rem" }}>
                {emailEvents.map(ev => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div style={{ flexShrink: 0, marginTop: 3, width: 8, height: 8, borderRadius: "50%", background: ev.eventType === "appointment" ? "#22c55e" : ev.eventType === "payment" ? "#f97316" : "var(--purple)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 0.15rem", fontWeight: 600, fontSize: "0.88rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                      <p style={{ margin: 0, fontSize: "0.77rem", color: "var(--text-muted)" }}>{fmtEventDate(ev.eventDate)} · {ev.sourceSender}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-muted)" }}>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>No upcoming events detected from email.</p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>Run "Scan Email History" in School Inbox to parse past emails for dates.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Messages tab ── */}
      {tab === "messages" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Inbound from Telegram
            </p>
            <button onClick={() => loadLogs()} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.6rem", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer" }}>
              <RefreshCw size={12} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} /> Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)" }}>
              <MessageSquare size={32} style={{ color: "var(--text-muted)", opacity: 0.3, marginBottom: "0.75rem" }} />
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--text)", fontSize: "0.9rem" }}>No messages yet</p>
              <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Open Telegram, message <strong>@AyaDashboardbot</strong>, and send anything.<br />
                It will appear here once the webhook is connected.
              </p>
              <div style={{ display: "inline-block", padding: "0.5rem 1rem", background: "rgba(180,85,47,0.08)", borderRadius: 8, fontSize: "0.78rem", color: "var(--purple)", fontFamily: "monospace" }}>
                /start
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {logs.map(l => (
                <div key={l.id} style={{ padding: "0.75rem 1rem", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: TYPE_COLORS[l.parsedType ?? ""] ?? "var(--border)", marginTop: 6 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 0.2rem", fontSize: "0.88rem", color: "var(--text)", wordBreak: "break-word" }}>{l.rawText}</p>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{l.parsedType ?? "message"} · {fmtRelative(l.receivedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reminders tab ── */}
      {tab === "reminders" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button onClick={() => setShowForm(s => !s)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: showForm ? "var(--bg)" : "var(--purple)", color: showForm ? "var(--text-muted)" : "#fff", border: showForm ? "1.5px solid var(--border)" : "none", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
              {showForm ? <X size={15} /> : <Plus size={15} />}
              {showForm ? "Cancel" : "Add Reminder"}
            </button>
          </div>

          {showForm && (
            <div style={{ background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border2)", padding: "1.25rem 1.5rem", marginBottom: "1.25rem", boxShadow: "0 4px 24px rgba(180,85,47,0.08)" }}>
              <p style={{ margin: "0 0 1rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>New Reminder</p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <input placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }} />
                <input placeholder="Body (optional)" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["daily", "weekly", "once"] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, scheduleType: t }))}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: 8, border: `1.5px solid ${form.scheduleType === t ? "var(--purple)" : "var(--border)"}`, background: form.scheduleType === t ? "rgba(180,85,47,0.1)" : "var(--bg)", color: form.scheduleType === t ? "var(--purple)" : "var(--text-muted)", fontWeight: 600, cursor: "pointer", fontSize: "0.82rem", textTransform: "capitalize" }}>
                      {t}
                    </button>
                  ))}
                </div>
                {form.scheduleType === "weekly" && (
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {DAY_BTNS.map(({ label, value }) => (
                      <button key={value} onClick={() => toggleDay(value)}
                        style={{ flex: 1, padding: "0.4rem 0", borderRadius: 8, border: `1.5px solid ${form.daysOfWeek.includes(value) ? "var(--purple)" : "var(--border)"}`, background: form.daysOfWeek.includes(value) ? "rgba(180,85,47,0.12)" : "var(--bg)", color: form.daysOfWeek.includes(value) ? "var(--purple)" : "var(--text-muted)", fontWeight: 600, cursor: "pointer", fontSize: "0.75rem" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {form.scheduleType === "once" && (
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }} />
                )}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select value={form.hour} onChange={e => setForm(p => ({ ...p, hour: e.target.value }))}
                    style={{ flex: 1, padding: "0.55rem 0.5rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
                  </select>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>:</span>
                  <select value={form.minute} onChange={e => setForm(p => ({ ...p, minute: e.target.value }))}
                    style={{ flex: 1, padding: "0.55rem 0.5rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}>
                    {ALL_MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1.5px solid var(--border)" }}>
                    {(["AM", "PM"] as const).map(ap => (
                      <button key={ap} onClick={() => setForm(p => ({ ...p, ampm: ap }))}
                        style={{ padding: "0.5rem 0.65rem", background: form.ampm === ap ? "var(--purple)" : "var(--bg)", color: form.ampm === ap ? "#fff" : "var(--text-muted)", border: "none", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>
                        {ap}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleCreate}
                  disabled={saving || !form.title.trim() || (form.scheduleType === "weekly" && form.daysOfWeek.length === 0) || (form.scheduleType === "once" && !form.date)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.65rem", background: "var(--purple)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: "0.9rem", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  <Check size={15} /> {saving ? "Saving…" : "Create Reminder"}
                </button>
              </div>
            </div>
          )}

          {active.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Active</p>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {active.map(r => <ReminderCard key={r.id} r={r} onToggle={handleToggle} onDelete={handleDelete} />)}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Paused</p>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {inactive.map(r => <ReminderCard key={r.id} r={r} onToggle={handleToggle} onDelete={handleDelete} />)}
              </div>
            </div>
          )}

          {reminders.length === 0 && !showForm && (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
              <Bell size={32} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
              <p style={{ margin: 0, fontSize: "0.9rem" }}>No reminders yet.</p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>Add one here or send /remind in Telegram.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
