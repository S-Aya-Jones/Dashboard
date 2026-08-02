"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Plus, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";

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
  id: string;
  rawText: string;
  parsedType?: string;
  receivedAt: string;
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
  const d   = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000)  return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const DAY_BTNS = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

function ReminderCard({ r, onToggle, onDelete }: {
  r: Reminder;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const schedLabel = r.scheduleType === "daily"
    ? `Daily at ${fmt12(r.timeOfDay)}`
    : r.scheduleType === "weekly"
    ? `${fmtDays(r.daysOfWeek ?? [])} at ${fmt12(r.timeOfDay)}`
    : `Once at ${fmt12(r.timeOfDay)}`;

  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          "0.75rem",
      padding:      "0.875rem 1rem",
      background:   r.active ? "var(--surface)" : "var(--bg)",
      borderRadius: "12px",
      border:       `1.5px solid ${r.active ? "var(--border2)" : "var(--border)"}`,
      opacity:      r.active ? 1 : 0.6,
      transition:   "all 0.2s",
    }}>
      {/* Toggle */}
      <button
        onClick={() => onToggle(r.id, !r.active)}
        style={{
          flexShrink:   0,
          width:        36,
          height:       20,
          borderRadius: 10,
          background:   r.active ? "var(--purple)" : "var(--border)",
          border:       "none",
          cursor:       "pointer",
          position:     "relative",
          transition:   "background 0.2s",
        }}
        title={r.active ? "Pause" : "Activate"}
      >
        <span style={{
          position:    "absolute",
          top:         2,
          left:        r.active ? 18 : 2,
          width:       16,
          height:      16,
          borderRadius: "50%",
          background:  "#fff",
          transition:  "left 0.2s",
          boxShadow:   "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin:     0,
          fontWeight: 600,
          fontSize:   "0.9rem",
          color:      "var(--text)",
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{r.title}</p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>{schedLabel}</p>
      </div>

      {/* Delete */}
      <button
        onClick={async () => {
          setDeleting(true);
          onDelete(r.id);
        }}
        disabled={deleting}
        style={{
          flexShrink:   0,
          padding:      "0.35rem",
          background:   "transparent",
          border:       "none",
          borderRadius: 8,
          color:        "var(--text-muted)",
          cursor:       "pointer",
          opacity:      deleting ? 0.5 : 1,
        }}
        title="Delete"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

interface FormState {
  title:        string;
  body:         string;
  scheduleType: "daily" | "weekly";
  hour:         string;
  minute:       string;
  ampm:         "AM" | "PM";
  daysOfWeek:   number[];
}

const BLANK: FormState = {
  title: "", body: "", scheduleType: "daily",
  hour: "7", minute: "00", ampm: "PM", daysOfWeek: [],
};

export function RemindersView() {
  const [reminders, setReminders]   = useState<Reminder[]>([]);
  const [logs,      setLogs]        = useState<InboundLog[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [showForm,  setShowForm]    = useState(false);
  const [showLogs,  setShowLogs]    = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [form,      setForm]        = useState<FormState>(BLANK);

  const load = useCallback(async () => {
    try {
      const [rRes, lRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/inbound-logs"),
      ]);
      if (rRes.ok) setReminders(await rRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, active: boolean) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, active } : r));
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  };

  const handleDelete = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const h24 = (() => {
      let h = parseInt(form.hour, 10);
      if (form.ampm === "PM" && h !== 12) h += 12;
      if (form.ampm === "AM" && h === 12) h = 0;
      return h;
    })();
    const timeOfDay = `${h24.toString().padStart(2, "0")}:${form.minute}`;
    try {
      const res = await fetch("/api/reminders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:        form.title.trim(),
          body:         form.body.trim() || undefined,
          scheduleType: form.scheduleType,
          timeOfDay,
          daysOfWeek:   form.scheduleType === "weekly" ? form.daysOfWeek : undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setReminders(prev => [created, ...prev]);
        setForm(BLANK);
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (d: number) => {
    setForm(prev => {
      const has = prev.daysOfWeek.includes(d);
      return { ...prev, daysOfWeek: has ? prev.daysOfWeek.filter(x => x !== d) : [...prev.daysOfWeek, d] };
    });
  };

  const active   = reminders.filter(r => r.active);
  const inactive = reminders.filter(r => !r.active);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--purple)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(124,92,252,0.15), rgba(232,121,249,0.12))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={20} style={{ color: "var(--purple)" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: "1.4rem", color: "var(--text)" }}>Reminders</h1>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>Telegram-delivered · {active.length} active</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "0.4rem",
            padding:      "0.5rem 1rem",
            background:   showForm ? "var(--bg)" : "var(--purple)",
            color:        showForm ? "var(--text-muted)" : "#fff",
            border:       showForm ? "1.5px solid var(--border)" : "none",
            borderRadius: 10,
            fontSize:     "0.85rem",
            fontWeight:   600,
            cursor:       "pointer",
          }}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "Add Reminder"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border2)", padding: "1.25rem 1.5rem", marginBottom: "1.25rem", boxShadow: "0 4px 24px rgba(124,92,252,0.08)" }}>
          <p style={{ margin: "0 0 1rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>New Reminder</p>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <input
              placeholder="Title"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }}
            />
            <input
              placeholder="Body (optional)"
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem", boxSizing: "border-box" }}
            />

            {/* Schedule type */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["daily", "weekly"] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, scheduleType: t }))}
                  style={{ flex: 1, padding: "0.5rem", borderRadius: 8, border: `1.5px solid ${form.scheduleType === t ? "var(--purple)" : "var(--border)"}`, background: form.scheduleType === t ? "rgba(124,92,252,0.1)" : "var(--bg)", color: form.scheduleType === t ? "var(--purple)" : "var(--text-muted)", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem", textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Days of week (weekly only) */}
            {form.scheduleType === "weekly" && (
              <div style={{ display: "flex", gap: "0.35rem" }}>
                {DAY_BTNS.map(({ label, value }) => (
                  <button key={value} onClick={() => toggleDay(value)}
                    style={{ flex: 1, padding: "0.4rem 0", borderRadius: 8, border: `1.5px solid ${form.daysOfWeek.includes(value) ? "var(--purple)" : "var(--border)"}`, background: form.daysOfWeek.includes(value) ? "rgba(124,92,252,0.12)" : "var(--bg)", color: form.daysOfWeek.includes(value) ? "var(--purple)" : "var(--text-muted)", fontWeight: 600, cursor: "pointer", fontSize: "0.75rem" }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Time */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select value={form.hour} onChange={e => setForm(p => ({ ...p, hour: e.target.value }))}
                style={{ flex: 1, padding: "0.55rem 0.5rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={String(h)}>{h}</option>
                ))}
              </select>
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>:</span>
              <select value={form.minute} onChange={e => setForm(p => ({ ...p, minute: e.target.value }))}
                style={{ flex: 1, padding: "0.55rem 0.5rem", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.9rem" }}>
                {["00", "15", "30", "45"].map(m => <option key={m} value={m}>{m}</option>)}
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

            <button onClick={handleCreate} disabled={saving || !form.title.trim() || (form.scheduleType === "weekly" && form.daysOfWeek.length === 0)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.65rem", background: "var(--purple)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: "0.9rem", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              <Check size={15} /> {saving ? "Saving…" : "Create Reminder"}
            </button>
          </div>
        </div>
      )}

      {/* Active reminders */}
      {active.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Active</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {active.map(r => (
              <ReminderCard key={r.id} r={r} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive reminders */}
      {inactive.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Paused</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {inactive.map(r => (
              <ReminderCard key={r.id} r={r} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {reminders.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <Bell size={32} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
          <p style={{ margin: 0, fontSize: "0.9rem" }}>No reminders yet.</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>Add one above or send /remind in Telegram.</p>
        </div>
      )}

      {/* Inbound logs */}
      {logs.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <button onClick={() => setShowLogs(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
            {showLogs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            Inbound Log ({logs.length} recent)
          </button>

          {showLogs && (
            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
              {logs.map(l => (
                <div key={l.id} style={{ padding: "0.6rem 0.875rem", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: 6, background: "rgba(124,92,252,0.1)", color: "var(--purple)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {l.parsedType ?? "message"}
                  </span>
                  <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--text)", wordBreak: "break-word" }}>{l.rawText}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtRelative(l.receivedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Telegram setup hint */}
      <div style={{ marginTop: "2rem", padding: "1rem 1.25rem", background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text)" }}>Telegram setup</strong><br />
        Set webhook to <code style={{ fontSize: "0.75rem", background: "rgba(124,92,252,0.08)", padding: "0.1em 0.3em", borderRadius: 4 }}>/api/telegram</code> and configure <code style={{ fontSize: "0.75rem", background: "rgba(124,92,252,0.08)", padding: "0.1em 0.3em", borderRadius: 4 }}>TELEGRAM_BOT_TOKEN</code>, <code style={{ fontSize: "0.75rem", background: "rgba(124,92,252,0.08)", padding: "0.1em 0.3em", borderRadius: 4 }}>TELEGRAM_CHAT_ID</code>, and <code style={{ fontSize: "0.75rem", background: "rgba(124,92,252,0.08)", padding: "0.1em 0.3em", borderRadius: 4 }}>TELEGRAM_WEBHOOK_SECRET</code> in Vercel env vars. Reminders are checked every 10 minutes.
      </div>
    </div>
  );
}
