"use client";

import { useState } from "react";

const PURPLE = "#7C5CFC";
const GOLD = "#E8C547";
const PEACH = "#E8A87C";

const EXAMPLES = [
  "Just finished upper body, felt strong on bench but struggled with shoulders. Weight was 143 this morning.",
  "Crushed leg day today. 9,200 steps. Went to bed at 11 last night, woke up at 6:30 feeling good.",
  "Rest day. Super tired, only got 5 hours of sleep. Weight 141.",
  "Did a 45 min walk. Feel amazing today, energy is a 10.",
  "Skipped workout today but hit 12k steps running errands. Weight 144.5.",
];

export default function ShortcutsPage() {
  const [testMsg, setTestMsg] = useState("");
  const [testResult, setTestResult] = useState<{ reply: string; parsed: Record<string, unknown> } | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sms/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMsg }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch {
      setTestResult({ reply: "Error connecting", parsed: {} });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ background: "#0E0A1F", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#fff", padding: "2rem 1rem 5rem" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: PURPLE, textTransform: "uppercase", margin: "0 0 0.5rem" }}>
            iPhone Integration
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "2rem", fontWeight: 500, margin: "0 0 0.5rem", lineHeight: 1.2 }}>
            Text Your Dashboard
          </h1>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Send a natural message from your iPhone — Aya reads it and updates your dashboard automatically.
          </p>
        </div>

        {/* How it works */}
        <div style={{ background: "rgba(124,92,252,0.08)", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(124,92,252,0.2)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: PURPLE, textTransform: "uppercase", margin: "0 0 1rem" }}>How It Works</p>
          {[
            ["1", "You text a contact named \"Dashboard\" on your iPhone (iMessage to yourself or a shortcut)"],
            ["2", "A Shortcuts automation on your phone catches the message and sends it to this dashboard"],
            ["3", "Claude reads your message, extracts weight, workout, sleep, steps, mood — updates everything"],
            ["4", "You get a smart reply back as a text within seconds"],
          ].map(([num, text]) => (
            <div key={num} style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{num}</div>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Example messages */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Example Messages</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => setTestMsg(ex)}
                style={{ textAlign: "left", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "0.75rem 1rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", cursor: "pointer", lineHeight: 1.5 }}>
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Test it */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "16px", padding: "1.5rem", marginBottom: "2rem", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: GOLD, textTransform: "uppercase", margin: "0 0 1rem" }}>Test It Now</p>
          <textarea
            value={testMsg}
            onChange={e => setTestMsg(e.target.value)}
            placeholder="Type a message like you'd send it from your phone..."
            rows={3}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#fff", outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <button onClick={runTest} disabled={!testMsg.trim() || testing}
            style={{ marginTop: "0.75rem", width: "100%", padding: "0.75rem", borderRadius: "10px", background: PURPLE, color: "#fff", fontWeight: 600, fontSize: "0.85rem", border: "none", cursor: "pointer", opacity: testing ? 0.6 : 1 }}>
            {testing ? "Interpreting…" : "Interpret Message"}
          </button>

          {testResult && (
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ background: "rgba(124,92,252,0.12)", borderRadius: "10px", padding: "0.75rem 1rem", border: "1px solid rgba(124,92,252,0.2)" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: PURPLE, margin: "0 0 0.35rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Aya&apos;s Reply</p>
                <p style={{ fontSize: "0.85rem", color: "#fff", margin: 0, lineHeight: 1.6 }}>{testResult.reply}</p>
              </div>
              <div style={{ background: "rgba(232,197,71,0.08)", borderRadius: "10px", padding: "0.75rem 1rem", border: "1px solid rgba(232,197,71,0.15)" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: GOLD, margin: "0 0 0.5rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>What Was Extracted</p>
                {Object.entries(testResult.parsed).filter(([k]) => k !== "reply").map(([k, v]) => v !== null && v !== undefined && (
                  <div key={k} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.8rem" }}>
                    <span style={{ color: GOLD, fontWeight: 600, textTransform: "capitalize", minWidth: 70 }}>{k}:</span>
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shortcut setup */}
        <div style={{ background: "rgba(232,168,124,0.08)", borderRadius: "16px", padding: "1.5rem", border: "1px solid rgba(232,168,124,0.2)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: PEACH, textTransform: "uppercase", margin: "0 0 1rem" }}>iPhone Shortcut Setup</p>
          <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem", lineHeight: 1.6 }}>
            Set this up once and texting your dashboard becomes instant. Takes about 3 minutes.
          </p>
          {[
            ["Open Shortcuts app", "Tap + to create a new shortcut"],
            ["Add trigger", "Tap Automation → New Automation → Message → From: yourself (or a contact named \"Dashboard\") → Message contains: nothing (catch all)"],
            ["Add action: Get Contents of URL", `URL: ${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard.vercel.app"}/api/sms/interpret\nMethod: POST\nHeaders: Content-Type = application/json\nBody (JSON): { "message": [Shortcut Input / Message Content] }`],
            ["Add action: Send Message", "Send the \"reply\" field from the response back to yourself"],
            ["Turn off Ask Before Running", "Toggle it off so it runs silently in the background"],
          ].map(([title, detail], i) => (
            <div key={i} style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: PEACH, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#000", flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <div>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: "0 0 0.2rem" }}>{title}</p>
                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
