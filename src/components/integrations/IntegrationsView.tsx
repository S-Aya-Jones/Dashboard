"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LIME = "#7C5CFC";
const BORDER = "rgba(124,92,252,0.12)";
const MUTED = "var(--text-muted)";
const RED = "#EF4444";
const GREEN = "#10B981";
const AMBER = "#F59E0B";

type TriageCategory = "reply" | "appointment" | "bill" | "school" | "spam" | "fyi" | "uncategorized";

interface GmailThread {
  id: string; subject: string; from: string; date: string;
  snippet: string; unread: boolean; messageCount: number;
  category?: TriageCategory;
}

interface CalEvent {
  id: string; title: string; start?: string; end?: string;
  allDay: boolean; location?: string; description?: string; colorId?: string;
}

const CAT_CONFIG: Record<TriageCategory, { label: string; color: string; bg: string }> = {
  reply:         { label: "Reply Needed",  color: RED,    bg: "rgba(239,68,68,0.08)" },
  appointment:   { label: "Appointments",  color: LIME,   bg: "rgba(124,92,252,0.08)" },
  bill:          { label: "Bills",         color: AMBER,  bg: "rgba(245,158,11,0.08)" },
  school:        { label: "School/MCAT",   color: GREEN,  bg: "rgba(16,185,129,0.08)" },
  spam:          { label: "Spam/Junk",     color: "#9CA3AF", bg: "rgba(156,163,175,0.08)" },
  fyi:           { label: "FYI",           color: "#6366F1", bg: "rgba(99,102,241,0.08)" },
  uncategorized: { label: "All",           color: MUTED,  bg: "transparent" },
};

const EVENT_COLORS: Record<string, string> = {
  "1": "#7986CB", "2": "#33B679", "3": "#8E24AA", "4": "#E67C73",
  "5": "#F6BF26", "6": "#F4511E", "7": "#039BE5", "11": "#D50000",
};

function formatFrom(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : from.replace(/<.*>/, "").trim();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - d.getTime() < 7 * 86400000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEventDate(start?: string): string {
  if (!start) return "";
  const d = new Date(start);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatEventTime(event: CalEvent): string {
  if (event.allDay) return "All day";
  if (!event.start) return "";
  return new Date(event.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Reply Modal ────────────────────────────────────────────────────────────

function ReplyModal({ thread, onClose, onSent }: { thread: GmailThread; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const toMatch = thread.from.match(/<(.+?)>/);
      const to = toMatch ? toMatch[1] : thread.from;
      const res = await fetch("/api/google/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, to, subject: `Re: ${thread.subject}`, body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-lg rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Reply to {formatFrom(thread.from)}</h3>
          <button onClick={onClose} style={{ color: MUTED }}>✕</button>
        </div>
        <p className="text-xs truncate" style={{ color: MUTED }}>Re: {thread.subject}</p>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
          placeholder="Write your reply…"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
        {error && <p className="text-xs" style={{ color: RED }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: MUTED }}>Cancel</button>
          <button onClick={send} disabled={sending || !body.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: LIME, color: "#fff" }}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Event Modal ─────────────────────────────────────────────────────

function CreateEventModal({ prefill, onClose, onCreated }: { prefill?: string; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(prefill ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), date, time, duration: parseInt(duration), description, allDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>New Calendar Event</h3>
          <button onClick={onClose} style={{ color: MUTED }}>✕</button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
          {!allDay && (
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
          )}
        </div>
        {!allDay && (
          <select value={duration} onChange={e => setDuration(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }}>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        )}
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          All day
        </label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Notes (optional)" rows={2}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
          style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
        <p className="text-xs" style={{ color: MUTED }}>You&apos;ll get a popup reminder 30 min before + email 1 hour before.</p>
        {error && <p className="text-xs" style={{ color: RED }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: MUTED }}>Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: LIME, color: "#fff" }}>
            {saving ? "Creating…" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gmail Tab ──────────────────────────────────────────────────────────────

function GmailTab() {
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TriageCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedBody, setExpandedBody] = useState<string | null>(null);
  const [replyThread, setReplyThread] = useState<GmailThread | null>(null);
  const [createEvent, setCreateEvent] = useState<string | undefined>(undefined);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const triageRef = useRef<Record<string, TriageCategory>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async (q = "in:inbox") => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/google/gmail?q=${encodeURIComponent(q)}&maxResults=30`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const withCats = (data.threads ?? []).map((t: GmailThread) => ({
        ...t, category: (triageRef.current[t.id] as TriageCategory) ?? "uncategorized",
      }));
      setThreads(withCats);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runTriage = async () => {
    setTriaging(true);
    try {
      const emails = threads.map(t => ({ id: t.id, from: t.from, subject: t.subject, snippet: t.snippet }));
      const res = await fetch("/api/google/gmail/triage", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const map: Record<string, TriageCategory> = {};
      for (const r of data.results) map[r.id] = r.category;
      triageRef.current = { ...triageRef.current, ...map };
      setThreads(prev => prev.map(t => ({ ...t, category: map[t.id] ?? t.category ?? "uncategorized" })));
      showToast(`Triaged ${data.results.length} emails`);
    } catch { showToast("Triage failed"); }
    finally { setTriaging(false); }
  };

  const deleteThreads = async (ids: string[]) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/google/gmail", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThreads(prev => prev.filter(t => !ids.includes(t.id)));
      setSelected(new Set());
      showToast(`Deleted ${ids.length} email${ids.length > 1 ? "s" : ""}`);
    } catch { showToast("Delete failed"); }
    finally { setDeleting(false); }
  };

  const massDeleteSpam = () => {
    const spamIds = threads.filter(t => t.category === "spam").map(t => t.id);
    if (spamIds.length) deleteThreads(spamIds);
  };

  const openThread = async (id: string) => {
    if (expanded === id) { setExpanded(null); setExpandedBody(null); return; }
    setExpanded(id); setExpandedBody(null);
    try {
      const res = await fetch(`/api/google/gmail?threadId=${id}`);
      const data = await res.json();
      const messages = data.messages ?? [];
      const lastMsg = messages[messages.length - 1];
      const parts = lastMsg?.payload?.parts ?? [lastMsg?.payload];
      let body = "";
      for (const part of parts) {
        if (part?.mimeType === "text/plain" && part?.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8"); break;
        }
      }
      setExpandedBody(body || data.snippet || "(no preview)");
    } catch { setExpandedBody("(failed to load)"); }
  };

  const visible = threads.filter(t => {
    if (activeTab !== "all" && t.category !== activeTab) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.from.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const spamCount = threads.filter(t => t.category === "spam").length;
  const tabs: Array<TriageCategory | "all"> = ["all", "reply", "appointment", "bill", "school", "fyi", "spam"];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 md:px-4 pt-3 pb-2 space-y-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mail…"
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
          <button onClick={runTriage} disabled={triaging || threads.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: "rgba(124,92,252,0.12)", color: LIME }}>
            {triaging ? "Analyzing…" : "AI Triage"}
          </button>
          {spamCount > 0 && (
            <button onClick={massDeleteSpam} disabled={deleting}
              className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.1)", color: RED }}>
              Delete {spamCount} Spam
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <span className="text-xs self-center flex-shrink-0" style={{ color: MUTED }}>Batch delete:</span>
          {[12, 18].map(n => (
            <button key={n} onClick={() => deleteThreads(visible.slice(0, n).map(t => t.id))}
              disabled={deleting || visible.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.08)", color: RED, border: `1px solid rgba(239,68,68,0.2)` }}>
              Top {n}
            </button>
          ))}
          {visible.length > 0 && (
            <button onClick={() => deleteThreads(visible.map(t => t.id))}
              disabled={deleting}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.08)", color: RED, border: `1px solid rgba(239,68,68,0.2)` }}>
              All {visible.length}
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map(t => {
            const count = t === "all" ? threads.length : threads.filter(x => x.category === t).length;
            const cfg = t === "all" ? { label: "All", color: LIME, bg: "rgba(124,92,252,0.08)" } : CAT_CONFIG[t];
            return (
              <button key={t} onClick={() => setActiveTab(t)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1"
                style={activeTab === t ? { background: cfg.color, color: "#fff" } : { background: cfg.bg, color: cfg.color, border: `1px solid ${BORDER}` }}>
                {cfg.label} {count > 0 && <span className="text-xs opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: MUTED }}>{selected.size} selected</span>
            <button onClick={() => deleteThreads(Array.from(selected))} disabled={deleting}
              className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: "rgba(239,68,68,0.1)", color: RED }}>
              Delete selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs" style={{ color: MUTED }}>Clear</button>
          </div>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} /></div>}
        {error && <div className="mx-4 mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: RED }}>{error}</div>}
        {!loading && visible.length === 0 && <div className="text-center py-16 text-sm" style={{ color: MUTED }}>No emails</div>}
        {!loading && visible.map(thread => {
          const cat = thread.category ?? "uncategorized";
          const cfg = cat !== "uncategorized" ? CAT_CONFIG[cat] : null;
          return (
            <div key={thread.id}>
              <div className="flex items-start gap-2 px-3 py-3 cursor-pointer hover:bg-purple-50/30 transition-colors"
                style={{ borderBottom: `1px solid ${BORDER}` }}>
                <input type="checkbox" checked={selected.has(thread.id)}
                  onChange={e => { const s = new Set(selected); if (e.target.checked) { s.add(thread.id); } else { s.delete(thread.id); } setSelected(s); }}
                  onClick={ev => ev.stopPropagation()} className="mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0" onClick={() => openThread(thread.id)}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm truncate" style={{ color: "var(--text)", fontWeight: thread.unread ? 600 : 400 }}>
                      {formatFrom(thread.from)}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {cfg && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>}
                      <span className="text-xs" style={{ color: MUTED }}>{formatDate(thread.date)}</span>
                    </div>
                  </div>
                  <p className="text-sm truncate" style={{ color: "var(--text)", fontWeight: thread.unread ? 600 : 400 }}>{thread.subject}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: MUTED }}>{thread.snippet}</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => setReplyThread(thread)} className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>Reply</button>
                  <button onClick={() => { setCreateEvent(thread.subject); setShowCreateEvent(true); }}
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: "rgba(16,185,129,0.1)", color: GREEN }}>+ Cal</button>
                  <button onClick={() => deleteThreads([thread.id])} disabled={deleting}
                    className="text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-40"
                    style={{ background: "rgba(239,68,68,0.08)", color: RED }}>Del</button>
                </div>
              </div>
              {expanded === thread.id && (
                <div className="px-6 py-4" style={{ background: "rgba(124,92,252,0.03)", borderBottom: `1px solid ${BORDER}` }}>
                  {expandedBody === null
                    ? <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}><div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />Loading…</div>
                    : <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text)", fontFamily: "inherit", maxHeight: 280, overflow: "auto" }}>{expandedBody}</pre>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {replyThread && <ReplyModal thread={replyThread} onClose={() => setReplyThread(null)} onSent={() => { setReplyThread(null); showToast("Reply sent!"); }} />}
      {showCreateEvent && <CreateEventModal prefill={createEvent} onClose={() => setShowCreateEvent(false)} onCreated={() => { setShowCreateEvent(false); showToast("Event created! Check Google Calendar."); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none z-50" style={{ background: "rgba(124,92,252,0.12)", color: LIME, border: `1px solid rgba(124,92,252,0.3)` }}>{toast}</div>}
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────────────────

function CalendarTab() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/google/calendar?days=${days}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvents(data.events ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const grouped: Record<string, CalEvent[]> = {};
  for (const e of events) {
    const key = e.start ? new Date(e.start).toDateString() : "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: MUTED }}>Next</span>
          {[7, 14, 30, 60].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={days === d ? { background: LIME, color: "#fff" } : { background: "rgba(124,92,252,0.08)", color: MUTED, border: `1px solid ${BORDER}` }}>
              {d}d
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
          style={{ background: LIME, color: "#fff" }}>
          + New Event
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} /></div>}
        {error && <div className="p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: RED }}>{error}</div>}
        {!loading && events.length === 0 && <div className="text-center py-16 text-sm" style={{ color: MUTED }}>No upcoming events</div>}
        {!loading && Object.entries(grouped).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: LIME }}>
              {formatEventDate(dayEvents[0].start)}
            </p>
            <div className="space-y-2">
              {dayEvents.map(event => (
                <div key={event.id} className="flex gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
                  <div className="w-1 rounded-full flex-shrink-0" style={{ background: EVENT_COLORS[event.colorId ?? ""] ?? LIME, minHeight: 32 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{event.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>{formatEventTime(event)}</p>
                    {event.location && <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>📍 {event.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); showToast("Event created! Check Google Calendar."); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none z-50" style={{ background: "rgba(124,92,252,0.12)", color: LIME, border: `1px solid rgba(124,92,252,0.3)` }}>{toast}</div>}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────

export function IntegrationsView() {
  const [tab, setTab] = useState<"gmail" | "calendar">("gmail");
  const [status, setStatus] = useState<"loading" | "not_configured" | "not_connected" | "connected">("loading");

  useEffect(() => {
    fetch("/api/google/auth").then(async res => {
      if (res.status === 503) { setStatus("not_configured"); return; }
      fetch("/api/google/gmail?maxResults=1").then(r => {
        if (r.status === 401) setStatus("not_connected");
        else setStatus("connected");
      });
    }).catch(() => setStatus("not_configured"));
  }, []);

  const handleConnect = async () => {
    const res = await fetch("/api/google/auth");
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: "var(--bg)", height: "100%", minHeight: 0 }}>
      <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4" style={{ borderBottom: `1px solid ${BORDER}`, background: "var(--surface)" }}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center justify-center rounded-full w-8 h-8 md:w-9 md:h-9 flex-shrink-0" style={{ background: "rgba(124,92,252,0.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm md:text-base" style={{ color: "var(--text)" }}>Integrations</h2>
            <p className="text-xs" style={{ color: MUTED }}>{status === "connected" ? "Google connected" : "Connect Google"}</p>
          </div>
        </div>
        {status === "connected" && (
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(124,92,252,0.08)" }}>
            {(["gmail", "calendar"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={tab === t ? { background: LIME, color: "#fff" } : { color: MUTED }}>
                {t === "gmail" ? "Gmail" : "Calendar"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {status === "loading" && <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} /></div>}
        {status === "not_configured" && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <p className="text-sm" style={{ color: MUTED }}>Add <code style={{ color: LIME }}>GOOGLE_CLIENT_ID</code> and <code style={{ color: LIME }}>GOOGLE_CLIENT_SECRET</code> to Vercel env vars.</p>
          </div>
        )}
        {status === "not_connected" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
            <button onClick={handleConnect} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: LIME, color: "#fff" }}>
              Connect with Google
            </button>
          </div>
        )}
        {status === "connected" && tab === "gmail" && <GmailTab />}
        {status === "connected" && tab === "calendar" && <CalendarTab />}
      </div>
    </div>
  );
}
