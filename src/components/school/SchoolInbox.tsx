"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, RefreshCw, Reply, X, BookOpen, Bell, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

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

function EmailRow({ email, onSelect, selected }: {
  email: Email;
  onSelect: (e: Email) => void;
  selected: boolean;
}) {
  return (
    <div onClick={() => onSelect(email)}
      style={{
        padding: "0.75rem 1rem", cursor: "pointer",
        background: selected ? "rgba(124,92,252,0.08)" : email.isRead ? "var(--bg)" : "var(--surface)",
        borderBottom: "1px solid var(--border)",
        borderLeft: selected ? "3px solid var(--purple)" : "3px solid transparent",
        transition: "background 0.15s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
        {!email.isRead && (
          <div style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: "var(--purple)" }} />
        )}
        {email.isBlackboard && (
          <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(124,92,252,0.15)", color: "var(--purple)", borderRadius: 4, padding: "0.1rem 0.35rem" }}>
            BB
          </span>
        )}
        <span style={{ flex: 1, fontWeight: email.isRead ? 400 : 600, fontSize: "0.85rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.senderName ?? email.senderEmail ?? "Unknown"}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>{fmtDate(email.receivedAt)}</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: email.isRead ? 400 : 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.subject ?? "(no subject)"}
      </p>
      <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.bodyPreview ?? ""}
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            {email.subject ?? "(no subject)"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            <strong>{email.senderName ?? email.senderEmail}</strong>
            {email.senderName && <span> &lt;{email.senderEmail}&gt;</span>}
            {" · "}{new Date(email.receivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          {email.deadlineAt && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", background: "rgba(249,115,22,0.12)", color: "#f97316", borderRadius: 6, padding: "0.2rem 0.5rem", fontWeight: 600 }}>
                📅 Due {fmtDeadline(email.deadlineAt)}
              </span>
              <button onClick={handleAddReminder}
                style={{ fontSize: "0.72rem", background: "rgba(124,92,252,0.12)", color: "var(--purple)", border: "none", borderRadius: 6, padding: "0.2rem 0.5rem", cursor: "pointer", fontWeight: 600 }}>
                + Add to Reminders
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0.2rem" }}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
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

      {/* Reply */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 1.25rem" }}>
        {sent && <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#22c55e" }}>✓ Reply sent</p>}
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

export function SchoolInbox() {
  const [connected, setConnected]     = useState<boolean | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [emails, setEmails]           = useState<Email[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [syncError, setSyncError]     = useState<string | null>(null);
  const [selected, setSelected]       = useState<Email | null>(null);
  const [tab, setTab]                 = useState<"all" | "school">("all");

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/gmail/emails");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncError(data.error ?? `Sync failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setConnected(data.connected ?? false);
      setUserEmail(data.userEmail ?? null);
      setEmails(data.emails ?? []);
      if (data.syncError) setSyncError(data.syncError);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const disconnect = async () => {
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setConnected(false);
    setEmails([]);
    setUserEmail(null);
  };

  const displayed = tab === "school" ? emails.filter(e => e.isBlackboard) : emails;
  const deadlines = emails.filter(e => e.deadlineAt).sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime());

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--purple)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (!connected) return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>School Inbox</h1>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>Connect Gmail to read emails & Blackboard notifications</p>
      </div>
      {syncError && (
        <div style={{ marginBottom: "1rem", padding: "0.6rem 1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: "0.82rem", color: "#ef4444" }}>
          {syncError}
        </div>
      )}
      <div style={{ background: "var(--surface)", borderRadius: 20, border: "1.5px solid var(--border)", padding: "2rem", textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(124,92,252,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <Mail size={26} style={{ color: "var(--purple)" }} />
        </div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: "var(--text)" }}>Connect your Gmail</h2>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Sign in with your personal Gmail. Forward your school email or set Blackboard notifications to go there — we'll read everything and send you Telegram reminders for due dates.
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.15rem", fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>School Inbox</h1>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>{userEmail}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => load()} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", cursor: "pointer" }}>
            <RefreshCw size={12} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} /> Refresh
          </button>
          <button onClick={disconnect} style={{ padding: "0.35rem 0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", cursor: "pointer" }}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: "0.8rem", color: "#ef4444" }}>
          Gmail sync issue: {syncError}
          {syncError.includes("401") || syncError.includes("403") ? " — try disconnecting and reconnecting Gmail." : ""}
        </div>
      )}

      {/* Upcoming deadlines strip */}
      {deadlines.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {deadlines.slice(0, 5).map(e => (
            <div key={e.id} onClick={() => setSelected(e)} style={{ flexShrink: 0, padding: "0.5rem 0.75rem", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 10, cursor: "pointer" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#f97316" }}>📅 {fmtDeadline(e.deadlineAt!)}</p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.deadlineTitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem", background: "var(--bg)", borderRadius: 10, padding: "0.2rem" }}>
        {([
          { key: "all",    label: "All Mail",        icon: <Mail size={13} />,     count: emails.length },
          { key: "school", label: "Blackboard / School", icon: <BookOpen size={13} />, count: emails.filter(e => e.isBlackboard).length },
        ] as const).map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.5rem 0.75rem", borderRadius: 8, border: "none", background: tab === key ? "var(--surface)" : "transparent", color: tab === key ? "var(--purple)" : "var(--text-muted)", fontWeight: tab === key ? 600 : 500, fontSize: "0.82rem", cursor: "pointer", boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {icon} {label}
            {count > 0 && <span style={{ fontSize: "0.68rem", background: tab === key ? "var(--purple)" : "var(--border)", color: tab === key ? "#fff" : "var(--text-muted)", borderRadius: 8, padding: "0.05rem 0.35rem", fontWeight: 700 }}>{count}</span>}
          </button>
        ))}
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
                  {tab === "school" ? "No Blackboard emails yet. Set your notification email in Blackboard to your Gmail." : "No emails. Make sure Gmail is connected and emails are forwarded."}
                </p>
              </div>
            ) : displayed.map(e => (
              <EmailRow key={e.id} email={e} onSelect={setSelected} selected={selected?.id === e.id} />
            ))}
          </div>
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
