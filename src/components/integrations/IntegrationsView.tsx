"use client";

import { useState, useEffect, useCallback } from "react";

const LIME = "#7C5CFC";
const BORDER = "rgba(124,92,252,0.12)";
const MUTED = "rgba(30,19,64,0.45)";

// ── Types ──────────────────────────────────────────────────────────────────

interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  messageCount: number;
}

interface CalEvent {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  colorId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (diff < 7 * 86400000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEventTime(event: CalEvent): string {
  if (event.allDay) return "All day";
  if (!event.start) return "";
  const d = new Date(event.start);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(event: CalEvent): string {
  if (!event.start) return "";
  const d = new Date(event.start);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const EVENT_COLORS: Record<string, string> = {
  "1": "#7986CB", "2": "#33B679", "3": "#8E24AA", "4": "#E67C73",
  "5": "#F6BF26", "6": "#F4511E", "7": "#039BE5", "8": "#616161",
  "9": "#3F51B5", "10": "#0B8043", "11": "#D50000",
};

// ── Connect Banner ─────────────────────────────────────────────────────────

function ConnectBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(124,92,252,0.1)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke={LIME} strokeWidth="1.8" fill="none" />
          <path d="M2 8L12 13L22 8" stroke={LIME} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Connect Google Account</h3>
        <p className="text-sm max-w-xs" style={{ color: MUTED }}>Link your Gmail and Google Calendar to see your inbox and upcoming events right here.</p>
      </div>
      <button onClick={onConnect}
        className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
        style={{ background: LIME, color: "#fff" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.908 8.908 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#fff" />
        </svg>
        Connect with Google
      </button>
    </div>
  );
}

// ── Not Configured Banner ──────────────────────────────────────────────────

function NotConfiguredBanner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="1.8" />
          <path d="M12 8v4M12 16h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>Google credentials not set</h3>
        <p className="text-sm max-w-sm" style={{ color: MUTED }}>
          Add <code className="px-1 py-0.5 rounded text-xs" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>GOOGLE_CLIENT_ID</code> and{" "}
          <code className="px-1 py-0.5 rounded text-xs" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>GOOGLE_CLIENT_SECRET</code> to Vercel env vars, then redeploy.
        </p>
      </div>
    </div>
  );
}

// ── Gmail Tab ──────────────────────────────────────────────────────────────

function GmailTab() {
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("in:inbox");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedBody, setExpandedBody] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/google/gmail?q=${encodeURIComponent(q)}&maxResults=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setThreads(data.threads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(query); }, [query, load]);

  const openThread = async (id: string) => {
    if (expanded === id) { setExpanded(null); setExpandedBody(null); return; }
    setExpanded(id);
    setExpandedBody(null);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/google/gmail?threadId=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const messages = data.messages ?? [];
      const lastMsg = messages[messages.length - 1];
      const parts = lastMsg?.payload?.parts ?? [lastMsg?.payload];
      let body = "";
      for (const part of parts) {
        if (part?.mimeType === "text/plain" && part?.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
      }
      setExpandedBody(body || data.snippet || "(no preview available)");
    } catch {
      setExpandedBody("(failed to load message body)");
    } finally {
      setLoadingThread(false);
    }
  };

  const filters = [
    { label: "Inbox", q: "in:inbox" },
    { label: "Unread", q: "in:inbox is:unread" },
    { label: "Important", q: "is:important" },
    { label: "Starred", q: "is:starred" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) setQuery(search.trim());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search + filters */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search mail…"
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
          <button type="submit" className="px-3 py-2 rounded-xl text-sm font-medium"
            style={{ background: LIME, color: "#fff" }}>Search</button>
        </form>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {filters.map(f => (
            <button key={f.q} onClick={() => { setQuery(f.q); setSearch(""); }}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={query === f.q
                ? { background: LIME, color: "#fff" }
                : { background: "rgba(124,92,252,0.08)", color: MUTED, border: `1px solid ${BORDER}` }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          </div>
        )}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: MUTED }}>No messages found</div>
        )}
        {!loading && threads.map(thread => (
          <div key={thread.id}>
            <button onClick={() => openThread(thread.id)} className="w-full text-left px-4 py-3 transition-colors hover:bg-purple-50/30"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: thread.unread ? LIME : "transparent", border: thread.unread ? "none" : `1.5px solid ${BORDER}` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm truncate" style={{ color: "var(--text)", fontWeight: thread.unread ? 600 : 400 }}>
                      {formatFrom(thread.from)}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: MUTED }}>{formatDate(thread.date)}</span>
                  </div>
                  <p className="text-sm truncate mb-0.5" style={{ color: "var(--text)", fontWeight: thread.unread ? 600 : 400 }}>
                    {thread.subject}
                  </p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{thread.snippet}</p>
                </div>
                {thread.messageCount > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(124,92,252,0.1)", color: LIME }}>{thread.messageCount}</span>
                )}
              </div>
            </button>
            {expanded === thread.id && (
              <div className="px-6 py-4" style={{ background: "rgba(124,92,252,0.03)", borderBottom: `1px solid ${BORDER}` }}>
                {loadingThread ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
                    Loading…
                  </div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text)", fontFamily: "inherit", maxHeight: 300, overflow: "auto" }}>
                    {expandedBody}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────────────────

function CalendarTab() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/google/calendar?days=${days}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // Group events by date
  const grouped: Record<string, CalEvent[]> = {};
  for (const e of events) {
    const key = e.start ? new Date(e.start).toDateString() : "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day range filter */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-xs font-medium" style={{ color: MUTED }}>Show next</span>
        {[7, 14, 30, 60].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={days === d
              ? { background: LIME, color: "#fff" }
              : { background: "rgba(124,92,252,0.08)", color: MUTED, border: `1px solid ${BORDER}` }}>
            {d} days
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: MUTED }}>No upcoming events</div>
        )}
        {!loading && Object.entries(grouped).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: LIME }}>
              {formatEventDate(dayEvents[0])}
            </p>
            <div className="space-y-2">
              {dayEvents.map(event => (
                <div key={event.id} className="flex gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
                  <div className="w-1 rounded-full flex-shrink-0 self-stretch"
                    style={{ background: EVENT_COLORS[event.colorId ?? ""] ?? LIME, minHeight: 32 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{event.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>{formatEventTime(event)}</p>
                    {event.location && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>
                        📍 {event.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
      const data = await res.json();
      if (data.url) {
        // credentials configured — check if refresh token also set
        fetch("/api/google/gmail?maxResults=1").then(r => {
          if (r.status === 401) setStatus("not_connected");
          else setStatus("connected");
        });
      }
    }).catch(() => setStatus("not_configured"));
  }, []);

  const handleConnect = async () => {
    const res = await fetch("/api/google/auth");
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, height: "calc(100vh - 180px)", minHeight: 500 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "var(--surface)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "rgba(124,92,252,0.12)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" stroke={LIME} strokeWidth="1.8" fill="none" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text)" }}>Integrations</h2>
            <p className="text-xs" style={{ color: MUTED }}>
              {status === "connected" ? "Google connected" : "Connect your Google account"}
            </p>
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

      {/* Body */}
      <div className="flex-1 min-h-0">
        {status === "loading" && (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: LIME, borderTopColor: "transparent" }} />
          </div>
        )}
        {status === "not_configured" && <NotConfiguredBanner />}
        {status === "not_connected" && <ConnectBanner onConnect={handleConnect} />}
        {status === "connected" && tab === "gmail" && <GmailTab />}
        {status === "connected" && tab === "calendar" && <CalendarTab />}
      </div>
    </div>
  );
}
