"use client";
import { useEffect, useState } from "react";

// The number is read at runtime rather than baked in at build, so saving a
// Twilio number in settings updates this page without a redeploy. A carrier
// reviewing the A2P campaign has to see a real number here — a placeholder
// reads as an unfinished page and is a documented rejection reason.
export function SmsOptInForm() {
  const [checked,   setChecked]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phone,     setPhone]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sms/number", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setPhone(d.display ?? null))
      .catch(() => {});
  }, []);

  if (confirmed) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem", background: "rgba(180,85,47,0.06)", borderRadius: "12px", border: "1px solid rgba(180,85,47,0.2)", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", color: "#3F6F5E" }}>✓</div>
        <p style={{ fontWeight: 600, color: "#1C1613", margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Opt-in confirmed.</p>
        <p style={{ fontSize: "0.85rem", color: "#6B5D53", margin: 0, lineHeight: 1.6 }}>
          {phone ? <>You&apos;ll receive messages from <strong style={{ color: "#1C1613" }}>{phone}</strong>, up to 2 per day.</> : <>You&apos;ll receive up to 2 messages per day.</>}
          {" "}Reply <strong style={{ color: "#1C1613" }}>STOP</strong> at any time to cancel.
        </p>
      </div>
    );
  }

  return (
    <>
      <label style={{ display: "block", fontSize: "0.8rem", color: "#6B5D53", marginBottom: "0.4rem", fontWeight: 500 }}>
        You will receive messages from
      </label>
      <div style={{ background: "#F7F2EC", border: "1px solid rgba(180,85,47,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.95rem", color: "#1C1613", fontWeight: 600, marginBottom: "1.25rem", letterSpacing: "0.02em" }}>
        {phone ?? "Loading…"}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1rem", padding: "1rem", background: "rgba(180,85,47,0.04)", borderRadius: "10px", border: "1px solid rgba(180,85,47,0.12)" }}>
        <input
          type="checkbox"
          id="consent"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#B4552F", cursor: "pointer" }}
        />
        <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1C1613", cursor: "pointer" }}>
          Yes, I consent to receive automated text messages from Aya&apos;s Dashboard
          (operated by Shaniqua Jones) about my daily workout reminders, wellness
          check-ins, and fitness updates. I understand I will receive up to <strong>2 messages per day</strong>.
          Msg &amp; data rates may apply. Reply STOP to cancel, HELP for help.
          Consent is not a condition of use.
        </label>
      </div>

      <button
        onClick={() => checked && setConfirmed(true)}
        disabled={!checked}
        style={{
          width: "100%",
          padding: "0.85rem 1.5rem",
          background: checked ? "#B4552F" : "rgba(180,85,47,0.25)",
          color: checked ? "#fff" : "rgba(180,85,47,0.55)",
          border: "none",
          borderRadius: "10px",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: checked ? "pointer" : "not-allowed",
          transition: "background 0.2s",
          marginBottom: "1.25rem",
          letterSpacing: "0.02em",
        }}
      >
        Confirm Opt-In
      </button>
    </>
  );
}
