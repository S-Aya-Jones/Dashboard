"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Mail, RefreshCw, Reply, X, BookOpen, Bell, ChevronDown, ChevronUp, ExternalLink, Heart, DollarSign, AlertCircle, Inbox, Calendar, Search } from "lucide-react";

type EmailCategory = "school" | "health" | "bills" | "action" | "spam" | "general";

interface UpcomingEvent {
  id:            string;
  eventType:     "appointment" | "deadline" | "payment" | "event";
  title:         string;
  eventDate:     string;
  sourceSender:  string;
}

interface Email {
  id:            string;
  threadId:      string | null;
  subject:       string | null;
  senderName:    string | null;
  senderEmail:   string | null;
  receivedAt:    string;
  bodyPreview:   string | null;
  bodyContent:   string | null;
  isRead:        boolean;
  isBlackboard:  boolean;
  deadlineTitle: string | null;
  deadlineAt:    string | null;
  category:      EmailCategory;
}

type TabKey = "all" | "school" | "health" | "bills" | "action";

const CATEGORY_COLOR: Record<EmailCategory, string> = {
  school:  "var(--purple)",
  health:  "#22c55e",
  bills:   "#f97316",
  action:  "#ef4444",
  spam:    "#6b7280",
  general: "transparent",
};

function categoryLabel(c: EmailCategory) {
  return { school: "BB", health: "APPT", bills: "BILL", action: "!", spam: "", general: "" }[c];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtTimeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function EmailRow({ email, onSelect, selected }: {
  email: Email;
  onSelect: (e: Email) => void;
  selected: boolean;
}) {
  const tag = categoryLabel(email.category);
  const color = CATEGORY_COLOR[email.category];
  return (
    <div onClick={() => onSelect(email)}
      style={{
        padding: "0.75rem 1rem", cursor: "pointer",
        background: selected ? "rgba(180,85,47,0.08)" : email.isRead ? "var(--bg)" : "var(--surface)",
        borderBottom: "1px solid var(--border)",
        borderLeft: `3px solid ${selected ? "var(--purple)" : color !== "transparent" ? color : "transparent"}`,
        transition: "background 0.15s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
        {!email.isRead && (
          <div style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: "var(--purple)" }} />
        )}
        {tag && (
          <span style={{ fontSize: "0.62rem", fontWeight: 700, background: color + "22", color, borderRadius: 4, padding: "0.1rem 0.3rem", flexShrink: 0 }}>
            {tag}
          </span>
        )}
        <span style={{ flex: 1, fontWeight: email.isRead ? 400 : 600, fontSize: "0.85rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.senderName || email.senderEmail || "Unknown"}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>{fmtDate(email.receivedAt)}</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: email.isRead ? 400 : 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.subject || "(no subject)"}
      </p>
      <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.bodyPreview || ""}
      </p>
      {email.deadlineAt && (
        <div style={{ marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Bell size={11} style={{ color: "#f97316" }} />
          <span style={{ fontSize: "0.7rem", color: "#f97316", fontWeight: 600 }}>Due {fmtDeadline(email.deadlineAt)}</span>
        </div>
      )}
    </div>
  );
}

function EmailDetail({ email, onClose }: { email: Email; onClose: () => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: email.id,
          threadId:  email.threadId,
          to:        email.senderEmail,
          subject:   email.subject ?? "",
          body:      replyText,
        }),
      });
      if (res.ok) {
        setSent(true);
        setReplyText("");
        setReplyOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSendError(data.error ?? `Failed to send (${res.status})`);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  };

  const handleAddReminder = async () => {
    if (!email.deadlineAt || !email.deadlineTitle) return;
    const d = new Date(email.deadlineAt);
    const h = d.getHours(), m = d.getMinutes();
    const timeOfDay = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`;
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: email.deadlineTitle,
        scheduleType: "once",
        timeOfDay,
        nextRunAt: email.deadlineAt,
      }),
    });
    alert("Reminder added to Telegram!");
  };

  const color = CATEGORY_COLOR[email.category];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            {email.subject ?? "(no subject)"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            <strong>{email.senderName ?? email.senderEmail}</strong>
            {email.senderName && <span> &lt;{email.senderEmail}&gt;</span>}
            {" · "}{new Date(email.receivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {email.category !== "general" && (
              <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", fontWeight: 700, color, background: color + "22", borderRadius: 4, padding: "0.1rem 0.35rem" }}>
                {email.category.toUpperCase()}
              </span>
            )}
          </p>
          {email.deadlineAt && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", background: "rgba(249,115,22,0.12)", color: "#f97316", borderRadius: 6, padding: "0.2rem 0.5rem", fontWeight: 600 }}>
                Due {fmtDeadline(email.deadlineAt)}
              </span>
              <button onClick={handleAddReminder}
                style={{ fontSize: "0.72rem", background: "rgba(180,85,47,0.12)", color: "var(--purple)", border: "none", borderRadius: 6, padding: "0.2rem 0.5rem", cursor: "pointer", fontWeight: 600 }}>
                + Add to Reminders
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0.2rem" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.25rem" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {showFull
            ? email.bodyContent ?? email.bodyPreview ?? ""
            : (email.bodyContent ?? email.bodyPreview ?? "").slice(0, 600)}
        </div>
        {(email.bodyContent ?? "").length > 600 && (
          <button onClick={() => setShowFull(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {showFull ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showFull ? "Show less" : "Show full email"}
          </button>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 1.25rem" }}>
        {sent && <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#22c55e" }}>Reply sent</p>}
        {sendError && <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#ef4444" }}>Error: {sendError}</p>}
        {!replyOpen ? (
          <button onClick={() => setReplyOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", background: "var(--purple)", color: "#fff", border: "none", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
            <Reply size={14} /> Reply
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4}
              placeholder="Write your reply…"
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 10, border: "1.5px solid var(--border2)", background: "var(--bg)", color: "var(--text)", fontSize: "0.88rem", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleSend} disabled={sending || !replyText.trim()}
                style={{ padding: "0.5rem 1.25rem", background: "var(--purple)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending…" : "Send"}
              </button>
              <button onClick={() => { setReplyOpen(false); setReplyText(""); }}
                style={{ padding: "0.5rem 0.75rem", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: "0.85rem", cursor: "pointer", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  appointment: "#22c55e",
  deadline:    "#f97316",
  payment:     "#ef4444",
  event:       "var(--purple)",
};

function fmtUpcomingEvent(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffD = Math.round((d.getTime() - now.getTime()) / 86400000);
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffD === 0) return `today ${timeStr}`;
  if (diffD === 1) return `tomorrow ${timeStr}`;
  return `${dateStr}`;
}

export function SchoolInbox() {
  const [connected, setConnected]         = useState<boolean | null>(null);
  const [userEmail, setUserEmail]         = useState<string | null>(null);
  const [emails, setEmails]               = useState<Email[]>([]);
  const [total, setTotal]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [syncError, setSyncError]         = useState<string | null>(null);
  const [lastSynced, setLastSynced]       = useState<Date | null>(null);
  const [selected, setSelected]           = useState<Email | null>(null);
  const [tab, setTab]                     = useState<TabKey>("all");
  const [scanning, setScanning]           = useState(false);
  const [scanResult, setScanResult]       = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadUpcomingEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/gmail/upcoming-events");
      if (!res.ok) return;
      const data = await res.json();
      setUpcomingEvents(data.events ?? []);
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/gmail/emails?limit=50&offset=0");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncError(data.error ?? `Sync failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setConnected(data.connected ?? false);
      setUserEmail(data.userEmail ?? null);
      setEmails(data.emails ?? []);
      setTotal(data.total ?? 0);
      if (data.syncError) setSyncError(data.syncError);
      setLastSynced(new Date());
      loadUpcomingEvents();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadUpcomingEvents]);

  const scanHistory = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/gmail/scan-history", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setScanResult(`Scan error: ${data.error}`);
      } else {
        setScanResult(`Found ${data.eventsFound} events (${data.future} upcoming, ${data.past} past) across ${data.scanned} emails`);
        loadUpcomingEvents();
      }
    } catch (e) {
      setScanResult(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/gmail/emails?limit=50&offset=${emails.length}`);
      if (!res.ok) return;
      const data = await res.json();
      setEmails(prev => {
        const seen = new Set(prev.map(e => e.id));
        const fresh = (data.emails ?? []).filter((e: Email) => !seen.has(e.id));
        return [...prev, ...fresh];
      });
      setTotal(data.total ?? total);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const urlError = params.get("error");
    if (urlError) {
      setSyncError(`OAuth error: ${urlError}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    load();
  }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => load(true), 5 * 60 * 1000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [load]);

  const disconnect = async () => {
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setConnected(false);
    setEmails([]);
    setUserEmail(null);
  };

  const hasContent = (e: Email) => !!(e.subject || e.senderName || e.senderEmail);

  const tabFilter = (e: Email): boolean => {
    if (!hasContent(e)) return false;
    if (tab === "all")    return true;
    if (tab === "school") return e.isBlackboard || e.category === "school";
    return e.category === tab;
  };

  const displayed = emails.filter(tabFilter);
  const deadlines = emails.filter(e => e.deadlineAt).sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime());

  // "Needs You" = action emails + school emails with upcoming deadlines (within 14 days)
  const soon = Date.now() + 14 * 86400000;
  const needsYou = emails.filter(e =>
    e.category === "action" ||
    (e.category === "school" && e.deadlineAt && new Date(e.deadlineAt).getTime() < soon)
  );

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color?: string }[] = [
    { key: "all",    label: "All",     icon: <Inbox size={13} /> },
    { key: "school", label: "School",  icon: <BookOpen size={13} />, color: "var(--purple)" },
    { key: "health", label: "Health",  icon: <Heart size={13} />,    color: "#22c55e" },
    { key: "bills",  label: "Bills",   icon: <DollarSign size={13} />, color: "#f97316" },
    { key: "action", label: "Action",  icon: <AlertCircle size={13} />, color: "#ef4444" },
  ];

  const countFor = (key: TabKey) => {
    if (key === "all") return emails.length;
    if (key === "school") return emails.filter(e => e.isBlackboard || e.category === "school").length;
    return emails.filter(e => e.category === key).length;
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--purple)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (!connected) return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>Inbox</h1>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>Connect Gmail to read emails, Blackboard notifications, and get smart Telegram briefings</p>
      </div>
      {syncError && (
        <div style={{ marginBottom: "1rem", padding: "0.6rem 1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: "0.82rem", color: "#ef4444" }}>
          {syncError}
        </div>
      )}
      <div style={{ background: "var(--surface)", borderRadius: 20, border: "1.5px solid var(--border)", padding: "2rem", textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(180,85,47,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <Mail size={26} style={{ color: "var(--purple)" }} />
        </div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: "var(--text)" }}>Connect your Gmail</h2>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Sign in with your personal Gmail. We'll auto-sort school, health, bills, and action items — and feed the important stuff into your daily Telegram briefings.
        </p>
        <a href="/api/auth/google"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1.5rem", background: "var(--purple)", color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
          <ExternalLink size={16} /> Connect Gmail
        </a>
        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--bg)", borderRadius: 12, textAlign: "left" }}>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.8rem", color: "var(--text)" }}>Setup tips:</p>
          <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.8 }}>
            <li>In Blackboard → Profile → Notifications → set email to your Gmail</li>
            <li>In school email → Settings → Forwarding → forward to Gmail</li>
          </ol>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.1rem", fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>Inbox</h1>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {userEmail}
            {lastSynced && <span style={{ marginLeft: "0.5rem" }}>· synced {fmtTimeAgo(lastSynced)}</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={scanHistory} disabled={scanning}
            title="Scan last 12 months for appointments, deadlines, bills"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", cursor: "pointer", opacity: scanning ? 0.6 : 1 }}>
            <Search size={12} style={{ animation: scanning ? "spin 0.8s linear infinite" : "none" }} />
            {scanning ? "Scanning…" : "Scan 12mo"}
          </button>
          <button onClick={() => load()} disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", cursor: "pointer", opacity: refreshing ? 0.6 : 1 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            {refreshing ? "Syncing…" : "Refresh"}
          </button>
          <button onClick={disconnect} style={{ padding: "0.35rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", cursor: "pointer" }}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: "0.8rem", color: "#ef4444", display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>Sync issue: {syncError}</span>
          {(syncError.includes("401") || syncError.includes("403")) && (
            <a href="/api/auth/google"
              style={{ flexShrink: 0, padding: "0.25rem 0.75rem", background: "#ef4444", color: "#fff", borderRadius: 6, fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", whiteSpace: "nowrap" }}>
              Reconnect Gmail
            </a>
          )}
        </div>
      )}

      {/* Scan result banner */}
      {scanResult && (
        <div style={{ marginBottom: "0.75rem", padding: "0.5rem 1rem", background: "rgba(180,85,47,0.07)", border: "1px solid rgba(180,85,47,0.2)", borderRadius: 10, fontSize: "0.78rem", color: "var(--purple)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{scanResult}</span>
          <button onClick={() => setScanResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* Upcoming events from email parsing */}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <Calendar size={11} /> Coming up
          </p>
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {upcomingEvents.slice(0, 6).map(ev => {
              const color = EVENT_TYPE_COLOR[ev.eventType] ?? "var(--purple)";
              return (
                <div key={ev.id} style={{ flexShrink: 0, padding: "0.45rem 0.7rem", background: color + "12", border: `1px solid ${color}44`, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color, textTransform: "uppercase" }}>{ev.eventType}</p>
                  <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                  <p style={{ margin: "0.1rem 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>{fmtUpcomingEvent(ev.eventDate)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Needs You section */}
      {needsYou.length > 0 && (
        <div style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12 }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <AlertCircle size={13} /> Needs your attention
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {needsYou.slice(0, 4).map(e => (
              <div key={e.id} onClick={() => { setSelected(e); setTab("all"); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {e.subject ?? "(no subject)"}
                </span>
                {e.deadlineAt && (
                  <span style={{ fontSize: "0.7rem", color: "#f97316", fontWeight: 600, flexShrink: 0 }}>Due {fmtDeadline(e.deadlineAt)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming deadlines strip */}
      {deadlines.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {deadlines.slice(0, 5).map(e => (
            <div key={e.id} onClick={() => setSelected(e)} style={{ flexShrink: 0, padding: "0.5rem 0.75rem", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 10, cursor: "pointer" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#f97316" }}>Due {fmtDeadline(e.deadlineAt!)}</p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.deadlineTitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.75rem", overflowX: "auto" }}>
        {tabs.map(({ key, label, icon, color }) => {
          const count = countFor(key);
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.45rem 0.8rem", borderRadius: 20, border: "1.5px solid",
                borderColor: active ? (color ?? "var(--purple)") : "var(--border)",
                background: active ? ((color ?? "var(--purple)") + "18") : "var(--bg)",
                color: active ? (color ?? "var(--purple)") : "var(--text-muted)",
                fontWeight: active ? 700 : 500, fontSize: "0.8rem", cursor: "pointer",
              }}>
              {icon} {label}
              {count > 0 && (
                <span style={{ fontSize: "0.67rem", background: active ? (color ?? "var(--purple)") : "var(--border)", color: active ? "#fff" : "var(--text-muted)", borderRadius: 8, padding: "0.05rem 0.3rem", fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Split view: list + detail */}
      <div style={{ display: "flex", gap: "1rem", height: 520 }}>
        {/* Email list */}
        <div style={{ width: selected ? 280 : "100%", flexShrink: 0, background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            {displayed.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                <Mail size={28} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  {tab === "school" ? "No school emails yet." : `No ${tab} emails.`}
                </p>
              </div>
            ) : displayed.map(e => (
              <EmailRow key={e.id} email={e} onSelect={setSelected} selected={selected?.id === e.id} />
            ))}
          </div>
          {/* Load more */}
          {emails.length < total && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "0.6rem", textAlign: "center" }}>
              <button onClick={loadMore} disabled={loadingMore}
                style={{ fontSize: "0.78rem", color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, opacity: loadingMore ? 0.6 : 1 }}>
                {loadingMore ? "Loading…" : `Load more (${total - emails.length} remaining)`}
              </button>
            </div>
          )}
        </div>

        {/* Email detail panel */}
        {selected && (
          <div style={{ flex: 1, background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            <EmailDetail email={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
