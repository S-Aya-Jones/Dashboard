"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The number is read at runtime rather than baked in at build, so saving a
// Twilio number in settings updates this page without a redeploy. A carrier
// reviewing the A2P campaign has to see a real number here — a placeholder
// reads as an unfinished page and is a documented rejection reason.
export function OptInForm() {
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sms/number", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPhone(d.display ?? null))
      .catch(() => {});
  }, []);

  const PHONE = phone ?? "our messaging number";

  if (confirmed) {
    return (
      <div>
        <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(113,200,129,0.3)", boxShadow: "0 4px 24px rgba(113,200,129,0.12)", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1C1613", margin: "0 0 0.5rem" }}>
            You&apos;re opted in!
          </p>
          <p style={{ fontSize: "0.85rem", color: "#6B5D53", margin: 0, lineHeight: 1.6 }}>
            You will receive daily wellness briefings from {PHONE}.<br />
            Reply <strong style={{ color: "#1C1613" }}>STOP</strong> at any time to unsubscribe.
          </p>
        </div>
        <div style={{ fontSize: "0.78rem", color: "#9C8D81", textAlign: "center" }}>
          <Link href="/terms" style={{ color: "#B4552F", textDecoration: "none" }}>Terms of Service</Link>
          <span style={{ margin: "0 0.5rem" }}>·</span>
          <Link href="/privacy" style={{ color: "#B4552F", textDecoration: "none" }}>Privacy Policy</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(180,85,47,0.15)", boxShadow: "0 4px 24px rgba(180,85,47,0.10)" }}>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#1C1613", margin: "0 0 1.25rem" }}>
          Aya&apos;s Dashboard sends automated SMS reminders including daily workout alerts,
          wellness check-ins, and fitness updates to users who register their phone number
          and provide consent below.
        </p>

        <label style={{ display: "block", fontSize: "0.8rem", color: "#6B5D53", marginBottom: "0.4rem" }}>
          You will receive messages from
        </label>
        <div style={{ background: "#F7F2EC", border: "1px solid rgba(180,85,47,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.95rem", color: "#1C1613", fontWeight: 500, marginBottom: "1.25rem", letterSpacing: "0.02em" }}>
          {PHONE}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            id="consent"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#B4552F", cursor: "pointer" }}
          />
          <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1C1613", cursor: "pointer" }}>
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
            background: checked ? "#B4552F" : "rgba(180,85,47,0.25)",
            color: checked ? "#FFFFFF" : "rgba(180,85,47,0.5)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: checked ? "pointer" : "not-allowed",
            transition: "all 0.15s ease",
            marginBottom: "1.25rem",
          }}
        >
          Confirm Opt-In
        </button>

        <div style={{ fontSize: "0.78rem", lineHeight: 1.7, color: "#6B5D53", borderTop: "1px solid rgba(180,85,47,0.12)", paddingTop: "1rem" }}>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1C1613" }}>Message Frequency:</strong> Up to 2 messages per day.</p>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1C1613" }}>Rates:</strong> Msg &amp; data rates may apply.</p>
          <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1C1613" }}>Stop:</strong> Reply STOP to cancel at any time. Reply HELP for help.</p>
          <p style={{ margin: 0 }}>
            Consent is not a condition of using this application.{" "}
            <Link href="/privacy" style={{ color: "#B4552F", textDecoration: "none" }}>Privacy Policy</Link>
            {" "}·{" "}
            <Link href="/terms" style={{ color: "#B4552F", textDecoration: "none" }}>Terms of Service</Link>
          </p>
        </div>
      </div>

      <div style={{ fontSize: "0.78rem", color: "#9C8D81", textAlign: "center" }}>
        <Link href="/terms" style={{ color: "#B4552F", textDecoration: "none" }}>Terms of Service</Link>
        <span style={{ margin: "0 0.5rem" }}>·</span>
        <Link href="/privacy" style={{ color: "#B4552F", textDecoration: "none" }}>Privacy Policy</Link>
      </div>
    </div>
  );
}
