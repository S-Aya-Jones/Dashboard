import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Opt-In — Aya's Dashboard",
};

export default function SmsOptInPage() {
  return (
    <div style={{ background: "#F4F0FE", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E1340" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.8rem", fontWeight: 500, margin: "0 0 0.5rem", color: "#1E1340" }}>
            SMS Notifications
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#7C6FAE", margin: 0 }}>
            Aya&apos;s Personal Dashboard · Single-user application
          </p>
        </div>

        <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(124,92,252,0.15)", boxShadow: "0 4px 24px rgba(124,92,252,0.10)" }}>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#1E1340", margin: "0 0 1.25rem" }}>
            This dashboard sends automated daily wellness and fitness reminders to the account holder&apos;s registered mobile phone number via SMS using Twilio.
          </p>

          <label style={{ display: "block", fontSize: "0.8rem", color: "#7C6FAE", marginBottom: "0.4rem" }}>
            Mobile Phone Number
          </label>
          <div style={{ background: "#FAF8FF", border: "1px solid rgba(124,92,252,0.15)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.9rem", color: "#A89ECC", marginBottom: "1.25rem" }}>
            Entered in the dashboard settings
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <input type="checkbox" id="consent" style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#7C5CFC" }} />
            <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1E1340" }}>
              Yes, I would like to receive automated text messages from Aya&apos;s Dashboard about my daily workout reminders, wellness check-ins, and fitness updates. I understand I will receive up to 2 messages per day.
            </label>
          </div>

          <div style={{ fontSize: "0.78rem", lineHeight: 1.7, color: "#7C6FAE", borderTop: "1px solid rgba(124,92,252,0.12)", paddingTop: "1rem" }}>
            <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Message Frequency:</strong> Up to 2 messages per day.</p>
            <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Standard Rates:</strong> Message and data rates may apply depending on your mobile service plan.</p>
            <p style={{ margin: "0 0 0.4rem" }}><strong style={{ color: "#1E1340" }}>Help &amp; Stop:</strong> Reply HELP for help or STOP to cancel at any time.</p>
            <p style={{ margin: 0 }}>By providing your phone number and checking the box above, you agree to receive text messages from this personal dashboard. Consent is not required to use the application.</p>
          </div>
        </div>

        <div style={{ fontSize: "0.78rem", color: "#A89ECC", textAlign: "center" }}>
          <Link href="/terms" style={{ color: "#7C5CFC", textDecoration: "none" }}>Terms of Service</Link>
          <span style={{ margin: "0 0.5rem" }}>·</span>
          <Link href="/privacy" style={{ color: "#7C5CFC", textDecoration: "none" }}>Privacy Policy</Link>
        </div>

      </div>
    </div>
  );
}
