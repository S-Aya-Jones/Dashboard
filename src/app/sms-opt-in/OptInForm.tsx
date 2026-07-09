"use client";

import { useState } from "react";
import Link from "next/link";

const PHONE = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "+1 (XXX) XXX-XXXX";

export function OptInForm() {
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div>
        <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(113,200,129,0.3)", boxShadow: "0 4px 24px rgba(113,200,129,0.12)", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1E1340", margin: "0 0 0.5rem" }}>
            You&apos;re opted in!
          </p>
          <p style={{ fontSize: "0.85rem", color: "#7C6FAE", margin: 0, lineHeight: 1.6 }}>
            You will receive daily wellness briefings from {PHONE}.<br />
            Reply <strong style={{ color: "#1E1340" }}>STOP</strong> at any time to unsubscribe.
          </p>
        </div>
        <div style={{ fontSize: "0.78rem", color: "#A89ECC", textAlign: "center" }}>
          <Link href="/terms" style={{ color: "#7C5CFC", textDecoration: "none" }}>Terms of Service</Link>
          <span style={{ margin: "0 0.5rem" }}>·</span>
          <Link href="/privacy" style={{ color: "#7C5CFC", textDecoration: "none" }}>Privacy Policy</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(124,92,252,0.15)", boxShadow: "0 4px 24px rgba(124,92,252,0.10)" }}>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#1E1340", margin: "0 0 1.25rem" }}>
          Aya&apos;s Dashboard sends automated SMS reminders including daily workout alerts,
          wellness check-ins, and fitness updates to users who register their phone number
          and provide consent below.
        </p>

        <label style={{ display: "block", fontSize: "0.8rem", color: "#7C6FAE", marginBottom: "0.4rem" }}>
          You will receive messages from
        </label>
        <div style={{ background: "#FAF8FF", border: "1px solid rgba(124,92,252,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.95rem", color: "#1E1340", fontWeight: 500, marginBottom: "1.25rem", letterSpacing: "0.02em" }}>
          {PHONE}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            id="consent"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#7C5CFC", cursor: "pointer" }}
          />
          <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1E1340", cursor: "pointer" }}>
            By checking this box, I consent to receive recurring automated SMS messages from
            Aya&apos;s Dashboard, including daily workout reminders, wellness check-ins, and
            fitness updates. Up to 2 messages per day. Msg &amp; data rates may apply. Reply
            STOP to cancel, HELP for help.
          </label>
        </div>

        <button
          onClick={() => checked && setConfirmed(true)}
          disabled={!checked}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "10px",
            border: "none",
            background: checked ? "#7C5CFC" : "rgba(124,92,252,0.25)",
            color: checked ? "#FFFFFF" : "rgba(124,92,252,0.5)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: checked ? "pointer" : "not-allowed",
            transition: "all 0.15s ease",
            marginBottom: "1.25rem",
          }}
        >
          Confirm Opt-In
        </button>

        <div style={{ fontSize: "0.78rem", lineHeight: 1.7, color: "#7C6FAE", borderTop: "1px solid rgba(124,92,252,0.12)", paddingTop: "1rem" }}>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Message Frequency:</strong> Up to 2 messages per day.</p>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Rates:</strong> Msg &amp; data rates may apply.</p>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Stop:</strong> Reply STOP to cancel at any time. Reply HELP for help.</p>
          <p style={{ margin: 0 }}>
            Consent is not a condition of using this application.{" "}
            <Link href="/privacy" style={{ color: "#7C5CFC", textDecoration: "none" }}>Privacy Policy</Link>
            {" "}·{" "}
            <Link href="/terms" style={{ color: "#7C5CFC", textDecoration: "none" }}>Terms of Service</Link>
          </p>
        </div>
      </div>

      <div style={{ fontSize: "0.78rem", color: "#A89ECC", textAlign: "center" }}>
        <Link href="/terms" style={{ color: "#7C5CFC", textDecoration: "none" }}>Terms of Service</Link>
        <span style={{ margin: "0 0.5rem" }}>·</span>
        <Link href="/privacy" style={{ color: "#7C5CFC", textDecoration: "none" }}>Privacy Policy</Link>
      </div>
    </div>
  );
}
