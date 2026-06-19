"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardData, SmsMessage, SmsReminder } from "@/types/dashboard";
import { id } from "@/lib/utils";
import { subscribeToPush, unsubscribeFromPush } from "@/components/PwaRegistration";

interface SmsViewProps {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const LIME = "#7C5CFC";
const BUBBLE_OUT = "#7C5CFC";
const BUBBLE_IN = "var(--bg2)";
const BORDER = "rgba(124,92,252,0.12)";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${timeStr}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${timeStr}`;
}

function formatReminderDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Every day";
  if (JSON.stringify([...days].sort()) === JSON.stringify([0, 1, 2, 3, 4])) return "Weekdays";
  if (JSON.stringify([...days].sort()) === JSON.stringify([5, 6])) return "Weekends";
  return days.map(d => DAY_NAMES[d]).join(", ");
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const QUICK_SENDS = [
  { label: "Workout Reminder", message: "Time to train! 💪 Reply DONE when you finish, or SKIP for a rest day." },
  { label: "Check-in Prompt", message: "Quick check-in! Reply with: weight in lbs (e.g. 130lbs) or steps (e.g. 8500 steps)." },
  { label: "You're amazing", message: "You're doing amazing. Keep showing up — that's the whole game. 🌟" },
  { label: "Eating today?", message: "What are you eating today? Fueling that body right! 🥗" },
];

export function SmsView({ data, update }: SmsViewProps) {
  const sms = data.sms ?? { phoneNumber: "", enabled: false, messages: [], reminders: [] };

  const [tab, setTab] = useState<"thread" | "reminders" | "settings">("thread");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [phoneInput, setPhoneInput] = useState(sms.phoneNumber);
  const [pushBusy, setPushBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pushEnabled = !!sms.pushSubscription;
  const phoneConfigured = !!sms.phoneNumber;

  useEffect(() => {
    if (tab === "thread") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sms.messages, tab]);

  const showToast = (text: string, type: "error" | "success" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const savePhone = () => {
    const formatted = phoneInput.trim().replace(/\D/g, "");
    const e164 = formatted.startsWith("1") ? `+${formatted}` : `+1${formatted}`;
    update(d => ({ ...d, sms: { ...(d.sms!), phoneNumber: e164 } }));
    showToast("Phone number saved!", "success");
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setSending(true);
    const outbound: SmsMessage = {
      id: id(),
      direction: "outbound",
      body: message.trim(),
      timestamp: new Date().toISOString(),
    };
    update(d => ({ ...d, sms: { ...d.sms!, messages: [...(d.sms?.messages ?? []), outbound] } }));
    setInput("");

    try {
      const res = await fetch("/api/sms/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error ?? "Failed to send", "error");
      } else {
        const reply: SmsMessage = {
          id: id(),
          direction: "inbound",
          body: result.reply ?? "Got it!",
          timestamp: new Date().toISOString(),
        };
        update(d => ({ ...d, sms: { ...d.sms!, messages: [...(d.sms?.messages ?? []), reply] } }));
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const toggleReminder = (remId: string) => {
    update(d => ({
      ...d,
      sms: { ...d.sms!, reminders: d.sms!.reminders.map(r => r.id === remId ? { ...r, enabled: !r.enabled } : r) },
    }));
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        update(d => ({ ...d, sms: { ...d.sms!, pushSubscription: undefined } }));
        showToast("Push notifications disabled", "success");
      } else {
        const ok = await subscribeToPush();
        if (ok) {
          showToast("Push notifications enabled!", "success");
          const freshRes = await fetch("/api/data");
          if (freshRes.ok) {
            const fresh = await freshRes.json();
            if (fresh?.sms?.pushSubscription) {
              update(d => ({ ...d, sms: { ...d.sms!, pushSubscription: fresh.sms.pushSubscription } }));
            }
          }
        } else {
          showToast("Permission denied or browser not supported", "error");
        }
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setPushBusy(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Aya's Dashboard", message: "Push notifications are working! 🔔", url: "/messages" }),
      });
      const result = await res.json();
      if (!res.ok) showToast(result.error ?? "Failed to send test", "error");
      else showToast("Test notification sent!", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setPushBusy(false);
    }
  };

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/sms/webhook` : "/api/sms/webhook";

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, height: "calc(100vh - 180px)", minHeight: 500 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}`, background: "var(--surface)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "rgba(124,92,252,0.12)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M8 2H16C17.1 2 18 2.9 18 4V20C18 21.1 17.1 22 16 22H8C6.9 22 6 21.1 6 20V4C6 2.9 6.9 2 8 2Z" stroke={LIME} strokeWidth="1.8" fill="none" />
              <circle cx="12" cy="18.5" r="1" fill={LIME} />
              <path d="M10 5H14" stroke={LIME} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text)" }}>Messages</h2>
            <p className="text-xs" style={{ color: phoneConfigured ? "var(--text-muted)" : "#DA667B" }}>
              {phoneConfigured ? `Texting ${sms.phoneNumber}` : "Add your number in Settings"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(124,92,252,0.08)" }}>
          {(["thread", "reminders", "settings"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === t ? { background: LIME, color: "#fff" } : { color: "var(--text-muted)" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Setup Banner */}
      {!phoneConfigured && tab === "thread" && (
        <div className="flex items-center gap-3 px-5 py-3 text-sm font-medium"
          style={{ background: "rgba(124,92,252,0.08)", borderBottom: `1px solid rgba(124,92,252,0.18)`, color: LIME }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={LIME} strokeWidth="1.8" />
            <path d="M12 8v4M12 16h.01" stroke={LIME} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Chat works right here without a phone number — add one in Settings only if you also want texts/push.
          <button onClick={() => setTab("settings")} className="ml-auto underline text-xs" style={{ color: LIME }}>Set up →</button>
        </div>
      )}

      {/* Thread Tab */}
      {tab === "thread" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {sms.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--text)" strokeWidth="1.5" fill="none" />
                </svg>
                <p className="text-sm text-center" style={{ color: "var(--text)" }}>No messages yet.<br />Send a quick check-in below!</p>
              </div>
            ) : (
              sms.messages.map((msg, i) => {
                const isOut = msg.direction === "outbound";
                const showTime = i === 0 || Math.abs(new Date(msg.timestamp).getTime() - new Date(sms.messages[i - 1].timestamp).getTime()) > 5 * 60 * 1000;
                return (
                  <div key={msg.id}>
                    {showTime && (
                      <p className="text-center text-xs my-2" style={{ color: "var(--text-muted)" }}>
                        {formatTimestamp(msg.timestamp)}
                      </p>
                    )}
                    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div style={{ maxWidth: "72%" }}>
                        <div className="px-4 py-2.5 rounded-3xl text-sm leading-relaxed"
                          style={isOut
                            ? { background: BUBBLE_OUT, color: "#fff", borderBottomRightRadius: 8 }
                            : { background: BUBBLE_IN, color: "var(--text)", borderBottomLeftRadius: 8 }}>
                          {msg.body}
                        </div>
                        {!isOut && msg.parsedAction && (
                          <p className="text-xs mt-1 ml-1" style={{ color: "rgba(124,92,252,0.8)" }}>✓ {msg.parsedAction}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Send Pills */}
          <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none" style={{ borderTop: `1px solid ${BORDER}` }}>
            {QUICK_SENDS.map(q => (
              <button key={q.label} onClick={() => sendMessage(q.message)}
                disabled={sending}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-end gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Type a message…" rows={1} disabled={sending}
              className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--bg2)", border: `1px solid ${BORDER}`, color: "var(--text)", maxHeight: 120 }}
              onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }} />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              className="flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0 disabled:opacity-30"
              style={{ background: input.trim() ? LIME : "rgba(124,92,252,0.2)" }}>
              {sending
                ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#000", borderTopColor: "transparent" }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        </div>
      )}

      {/* Reminders Tab */}
      {tab === "reminders" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Tap Send Now to fire a reminder to your phone instantly.
          </p>
          {sms.reminders.map(rem => (
            <ReminderCard key={rem.id} reminder={rem}
              onToggle={() => toggleReminder(rem.id)}
              onSendNow={() => sendMessage(rem.message)}
              sending={sending} phoneConfigured={phoneConfigured} />
          ))}
          {sms.reminders.length === 0 && (
            <div className="text-center py-12 opacity-40"><p className="text-sm" style={{ color: "var(--text)" }}>No reminders configured.</p></div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 no-scrollbar">

          {/* Push Notifications */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LIME }}>Push Notifications</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {pushEnabled ? "Enabled — you'll receive alerts on this device" : "Get alerts on this device"}
                </p>
              </div>
              <button onClick={handleTogglePush} disabled={pushBusy}
                className="relative flex-shrink-0 w-12 h-7 rounded-full transition-all duration-200 disabled:opacity-40"
                style={{ background: pushEnabled ? LIME : "rgba(124,92,252,0.15)" }}>
                <span className="absolute top-1.5 w-4 h-4 rounded-full transition-all duration-200"
                  style={{ background: pushEnabled ? "#fff" : "rgba(124,92,252,0.5)", left: pushEnabled ? "calc(100% - 20px)" : 4 }} />
              </button>
            </div>
            {pushEnabled && (
              <button onClick={testPush} disabled={pushBusy}
                className="w-full py-2 rounded-xl text-xs font-medium disabled:opacity-40"
                style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
                Send Test Notification
              </button>
            )}
            {!pushEnabled && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                iOS: add to Home Screen first, then enable here.
              </p>
            )}
          </div>

          {/* Step 1 — Your phone number */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LIME }}>Step 1 — Your phone number</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>The number that will receive your texts.</p>
            <div className="flex gap-2">
              <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg)", border: `1px solid ${BORDER}`, color: "var(--text)" }} />
              <button onClick={savePhone}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: LIME, color: "#000" }}>
                Save
              </button>
            </div>
            {phoneConfigured && (
              <p className="text-xs" style={{ color: LIME }}>✓ Saved: {sms.phoneNumber}</p>
            )}
          </div>

          {/* Step 2 — Twilio webhook */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LIME }}>Step 2 — Set up two-way texting</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              To receive your replies, tell Twilio where to send incoming messages:
            </p>
            <ol className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <li>1. Go to <span style={{ color: LIME }}>console.twilio.com</span> → Phone Numbers → Manage → Active Numbers</li>
              <li>2. Click your number <span style={{ color: "var(--text)" }}>+16158020682</span></li>
              <li>3. Under <span style={{ color: LIME }}>Messaging Configuration</span> → &ldquo;A message comes in&rdquo; → set to <span style={{ color: LIME }}>Webhook</span></li>
              <li>4. Paste this URL:</li>
            </ol>
            <div className="rounded-xl px-3 py-2.5 font-mono text-xs break-all" style={{ background: "var(--bg)", border: `1px solid rgba(124,92,252,0.2)`, color: "rgba(124,92,252,0.9)" }}>
              {webhookUrl}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); showToast("Copied!", "success"); }}
              className="w-full py-2 rounded-xl text-xs font-medium"
              style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
              Copy Webhook URL
            </button>
          </div>

          {/* Reply commands */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface)", border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Reply Commands</p>
            {[
              ["DONE", "Marks today's workout complete"],
              ["SKIP", "Logs a rest day"],
              ["130lbs", "Logs body weight"],
              ["8500 steps", "Logs step count"],
              ["HELP", "Shows command list"],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex items-center gap-3 text-xs">
                <code className="px-2 py-0.5 rounded-md font-mono flex-shrink-0"
                  style={{ background: "rgba(124,92,252,0.1)", color: LIME, minWidth: 90, display: "inline-block" }}>
                  {cmd}
                </code>
                <span style={{ color: "var(--text-muted)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none"
          style={{
            background: toast.type === "error" ? "#FFF0F0" : "rgba(124,92,252,0.1)",
            color: toast.type === "error" ? "#c0392b" : LIME,
            border: `1px solid ${toast.type === "error" ? "rgba(192,57,43,0.3)" : "rgba(124,92,252,0.3)"}`,
            zIndex: 50,
          }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function ReminderCard({ reminder, onToggle, onSendNow, sending, phoneConfigured }: {
  reminder: SmsReminder; onToggle: () => void; onSendNow: () => void; sending: boolean; phoneConfigured: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: reminder.enabled ? "rgba(124,92,252,0.06)" : "var(--surface)", border: `1px solid ${reminder.enabled ? "rgba(124,92,252,0.25)" : BORDER}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{reminder.label}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(124,92,252,0.08)", color: "var(--text-muted)" }}>
              {formatTime(reminder.time)}
            </span>
          </div>
          <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>{reminder.message}</p>
        </div>
        <button onClick={onToggle}
          className="flex-shrink-0 relative w-10 h-6 rounded-full transition-all duration-200"
          style={{ background: reminder.enabled ? LIME : "rgba(124,92,252,0.15)" }}>
          <span className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
            style={{ background: reminder.enabled ? "#fff" : "rgba(124,92,252,0.5)", left: reminder.enabled ? "calc(100% - 20px)" : 4 }} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatReminderDays(reminder.days)}</span>
        <button onClick={onSendNow} disabled={sending || !phoneConfigured}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-30"
          style={{ background: "rgba(124,92,252,0.1)", color: LIME, border: `1px solid rgba(124,92,252,0.2)` }}>
          Send Now
        </button>
      </div>
    </div>
  );
}
