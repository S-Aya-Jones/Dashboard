"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardData, SmsMessage, SmsReminder } from "@/types/dashboard";
import { id } from "@/lib/utils";

interface SmsViewProps {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const LIME = "#C8FF00";
const SURFACE = "#111111";
const BUBBLE_OUT = "#C8FF00";
const BUBBLE_IN = "#1E1E1E";
const BORDER = "rgba(255,255,255,0.08)";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const msgStr = d.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (msgStr === todayStr) return `Today ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (msgStr === yesterday.toDateString()) return `Yesterday ${timeStr}`;

  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${timeStr}`;
}

function formatReminderDays(days: number[]): string {
  if (days.length === 0) return "Every day";
  if (days.length === 7) return "Every day";
  if (JSON.stringify(days.sort()) === JSON.stringify([0, 1, 2, 3, 4])) return "Weekdays";
  if (JSON.stringify(days.sort()) === JSON.stringify([5, 6])) return "Weekends";
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
  { label: "Check-in Prompt", message: "Quick check-in! Reply with: weight in lbs (e.g. 130lbs) or steps (e.g. 8500 steps). How'd today go?" },
  { label: "You're amazing", message: "You're doing amazing. Keep showing up — that's the whole game. 🌟" },
  { label: "Eating today?", message: "What are you eating today? Fueling that body right! 🥗" },
];

export function SmsView({ data, update }: SmsViewProps) {
  const sms = data.sms ?? {
    phoneNumber: "",
    enabled: false,
    messages: [],
    reminders: [],
  };

  const [tab, setTab] = useState<"thread" | "reminders" | "settings">("thread");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [phoneInput, setPhoneInput] = useState(sms.phoneNumber);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === "thread") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [sms.messages, tab]);

  const showToast = (text: string, type: "error" | "success" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    if (!sms.phoneNumber) {
      showToast("Add your phone number in Settings first", "error");
      return;
    }

    setSending(true);

    // Optimistically add to thread
    const outbound: SmsMessage = {
      id: id(),
      direction: "outbound",
      body: message.trim(),
      timestamp: new Date().toISOString(),
    };
    update(d => ({
      ...d,
      sms: {
        ...d.sms!,
        messages: [...(d.sms?.messages ?? []), outbound],
      },
    }));
    setInput("");

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), to: sms.phoneNumber }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          showToast("Twilio not configured — message saved locally only", "error");
        } else {
          showToast(result.error ?? "Failed to send", "error");
        }
      } else {
        showToast("Sent!", "success");
      }
    } catch {
      showToast("Network error — message saved locally only", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const savePhoneNumber = () => {
    update(d => ({
      ...d,
      sms: { ...(d.sms ?? { phoneNumber: "", enabled: false, messages: [], reminders: [] }), phoneNumber: phoneInput },
    }));
    showToast("Phone number saved!", "success");
  };

  const toggleReminder = (remId: string) => {
    update(d => ({
      ...d,
      sms: {
        ...(d.sms!),
        reminders: d.sms!.reminders.map(r =>
          r.id === remId ? { ...r, enabled: !r.enabled } : r
        ),
      },
    }));
  };

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        height: "calc(100vh - 180px)",
        minHeight: 500,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "#0D0D0D" }}
      >
        <div className="flex items-center gap-3">
          {/* Phone icon */}
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: "rgba(200,255,0,0.12)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 2H16C17.1 2 18 2.9 18 4V20C18 21.1 17.1 22 16 22H8C6.9 22 6 21.1 6 20V4C6 2.9 6.9 2 8 2Z"
                stroke={LIME}
                strokeWidth="1.8"
                fill="none"
              />
              <circle cx="12" cy="18.5" r="1" fill={LIME} />
              <path d="M10 5H14" stroke={LIME} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-white text-base">Messages</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {sms.phoneNumber ? sms.phoneNumber : "No phone configured"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {(["thread", "reminders", "settings"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                tab === t
                  ? { background: LIME, color: "#000" }
                  : { color: "rgba(255,255,255,0.5)" }
              }
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Setup Banner */}
      {!sms.phoneNumber && tab === "thread" && (
        <div
          className="flex items-center gap-3 px-5 py-3 text-sm font-medium"
          style={{ background: "rgba(200,255,0,0.1)", borderBottom: `1px solid rgba(200,255,0,0.2)`, color: LIME }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={LIME} strokeWidth="1.8" />
            <path d="M12 8v4M12 16h.01" stroke={LIME} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add your phone number in Settings to enable SMS
          <button
            onClick={() => setTab("settings")}
            className="ml-auto underline text-xs"
            style={{ color: LIME }}
          >
            Set up →
          </button>
        </div>
      )}

      {/* Thread Tab */}
      {tab === "thread" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {sms.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="white"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                <p className="text-white text-sm text-center">No messages yet.<br />Send a quick check-in below!</p>
              </div>
            ) : (
              sms.messages.map((msg, i) => {
                const isOut = msg.direction === "outbound";
                const showTime =
                  i === 0 ||
                  Math.abs(
                    new Date(msg.timestamp).getTime() -
                    new Date(sms.messages[i - 1].timestamp).getTime()
                  ) > 5 * 60 * 1000;

                return (
                  <div key={msg.id}>
                    {showTime && (
                      <p
                        className="text-center text-xs my-2"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        {formatTimestamp(msg.timestamp)}
                      </p>
                    )}
                    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div style={{ maxWidth: "72%" }}>
                        <div
                          className="px-4 py-2.5 rounded-3xl text-sm leading-relaxed"
                          style={
                            isOut
                              ? { background: BUBBLE_OUT, color: "#000", borderBottomRightRadius: 8 }
                              : { background: BUBBLE_IN, color: "#fff", borderBottomLeftRadius: 8 }
                          }
                        >
                          {msg.body}
                        </div>
                        {!isOut && msg.parsedAction && (
                          <p
                            className="text-xs mt-1 ml-1"
                            style={{ color: "rgba(200,255,0,0.6)" }}
                          >
                            ✓ {msg.parsedAction}
                          </p>
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
          <div
            className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            {QUICK_SENDS.map(q => (
              <button
                key={q.label}
                onClick={() => sendMessage(q.message)}
                disabled={sending || !sms.phoneNumber}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-40"
                style={{
                  background: "rgba(200,255,0,0.1)",
                  color: LIME,
                  border: `1px solid rgba(200,255,0,0.2)`,
                }}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div
            className="flex items-end gap-3 px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-white outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${BORDER}`,
                maxHeight: 120,
                lineHeight: "1.5",
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="flex items-center justify-center rounded-full w-10 h-10 transition-all flex-shrink-0 disabled:opacity-30"
              style={{
                background: input.trim() ? LIME : "rgba(200,255,0,0.2)",
              }}
            >
              {sending ? (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "#000", borderTopColor: "transparent" }}
                />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reminders Tab */}
      {tab === "reminders" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            Automated reminders sent to your phone. Configure Twilio + a cron job to trigger these.
          </p>
          {sms.reminders.map(rem => (
            <ReminderCard
              key={rem.id}
              reminder={rem}
              onToggle={() => toggleReminder(rem.id)}
              onSendNow={() => sendMessage(rem.message)}
              sending={sending}
              phoneConfigured={!!sms.phoneNumber}
            />
          ))}
          {sms.reminders.length === 0 && (
            <div className="text-center py-12 opacity-40">
              <p className="text-white text-sm">No reminders configured.</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Phone Number
            </label>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
              Messages will be sent TO this number via Twilio.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BORDER}`,
                }}
              />
              <button
                onClick={savePhoneNumber}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: LIME, color: "#000" }}
              >
                Save
              </button>
            </div>
          </div>

          {/* Twilio Setup Callout */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Twilio Setup
            </h3>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Add these environment variables to your <code style={{ color: LIME }}>.env.local</code> to enable SMS sending:
            </p>
            <div
              className="rounded-xl p-4 space-y-1.5 font-mono text-xs"
              style={{ background: "#0A0A0A", border: `1px solid rgba(200,255,0,0.15)` }}
            >
              {[
                "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx",
                "TWILIO_AUTH_TOKEN=your_auth_token",
                "TWILIO_PHONE_NUMBER=+1xxxxxxxxxx",
              ].map(line => (
                <p key={line} style={{ color: "rgba(200,255,0,0.8)" }}>
                  {line}
                </p>
              ))}
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Set your Twilio webhook URL to{" "}
              <code style={{ color: LIME }}>https://yourdomain.com/api/sms/webhook</code>
              {" "}to receive and parse replies.
            </p>
          </div>

          {/* Webhook Info */}
          <div
            className="rounded-2xl p-5 space-y-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <h3 className="text-sm font-semibold text-white">Reply Parsing</h3>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              When you reply to a message, the webhook auto-logs:
            </p>
            <div className="space-y-1.5">
              {[
                ["DONE / FINISHED", "Marks workout complete"],
                ["SKIP / REST", "Logs rest day"],
                ["130lbs", "Logs body weight"],
                ["8500 steps", "Logs step count"],
                ["HELP", "Shows command menu"],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-center gap-3 text-xs">
                  <code
                    className="px-2 py-0.5 rounded-md font-mono"
                    style={{ background: "rgba(200,255,0,0.1)", color: LIME, minWidth: 100, display: "inline-block" }}
                  >
                    {cmd}
                  </code>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-none"
          style={{
            background: toast.type === "error" ? "#2A1A1A" : "rgba(200,255,0,0.15)",
            color: toast.type === "error" ? "#FF6B6B" : LIME,
            border: `1px solid ${toast.type === "error" ? "rgba(255,100,100,0.3)" : "rgba(200,255,0,0.3)"}`,
            zIndex: 50,
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  onToggle,
  onSendNow,
  sending,
  phoneConfigured,
}: {
  reminder: SmsReminder;
  onToggle: () => void;
  onSendNow: () => void;
  sending: boolean;
  phoneConfigured: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: reminder.enabled ? "rgba(200,255,0,0.05)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${reminder.enabled ? "rgba(200,255,0,0.2)" : BORDER}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">{reminder.label}</h4>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {formatTime(reminder.time)}
            </span>
          </div>
          <p className="text-xs line-clamp-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            {reminder.message}
          </p>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 relative w-10 h-6 rounded-full transition-all duration-200"
          style={{
            background: reminder.enabled ? LIME : "rgba(255,255,255,0.12)",
          }}
        >
          <span
            className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
            style={{
              background: reminder.enabled ? "#000" : "rgba(255,255,255,0.6)",
              left: reminder.enabled ? "calc(100% - 20px)" : 4,
            }}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          {formatReminderDays(reminder.days)}
        </span>
        <button
          onClick={onSendNow}
          disabled={sending || !phoneConfigured}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-30"
          style={{
            background: "rgba(200,255,0,0.1)",
            color: LIME,
            border: `1px solid rgba(200,255,0,0.2)`,
          }}
        >
          Send Now
        </button>
      </div>
    </div>
  );
}
