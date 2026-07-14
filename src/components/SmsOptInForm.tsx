"use client";
import { useState } from "react";

export function SmsOptInForm() {
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem", background: "rgba(124,92,252,0.06)", borderRadius: "12px", border: "1px solid rgba(124,92,252,0.2)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✓</div>
        <p style={{ fontWeight: 600, color: "#1E1340", margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Opt-in confirmed.</p>
        <p style={{ fontSize: "0.85rem", color: "#7C6FAE", margin: 0 }}>
          You&apos;ll receive up to 2 messages per day. Reply <strong>STOP</strong> at any time to cancel.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1.25rem", padding: "1rem", background: "rgba(124,92,252,0.04)", borderRadius: "10px", border: "1px solid rgba(124,92,252,0.12)" }}>
        <input
          type="checkbox"
          id="consent"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#7C5CFC", cursor: "pointer" }}
        />
        <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1E1340", cursor: "pointer" }}>
          Yes, I consent to receive automated text messages from Aya&apos;s Dashboard
          (operated by Shaniqua Jones) about my daily workout reminders, wellness
          check-ins, and fitness updates. I understand I will receive up to <strong>2 messages per day</strong>.
          Consent is not a condition of use.
        </label>
      </div>

      <button
        onClick={() => checked && setConfirmed(true)}
        disabled={!checked}
        style={{
          width: "100%",
          padding: "0.85rem 1.5rem",
          background: checked ? "#7C5CFC" : "#D4CCFF",
          color: "#fff",
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
