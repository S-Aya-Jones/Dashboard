import type { Metadata } from "next";
import Link from "next/link";
import { SmsOptInForm } from "@/components/SmsOptInForm";

export const metadata: Metadata = {
  title: "SMS Opt-In — Aya's Dashboard",
  description: "SMS notification consent and opt-in page for Aya's personal wellness dashboard.",
  robots: { index: true, follow: true },
};

export default function SmsOptInPage() {
  return (
    <div style={{ background: "#FAF6F1", minHeight: "100vh", overflowY: "auto", fontFamily: "'Inter', system-ui, sans-serif", color: "#1C1613" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        {/* Brand header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", color: "#B4552F", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
            Aya&apos;s Personal Dashboard
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.9rem", fontWeight: 500, margin: "0 0 0.4rem", color: "#1C1613", lineHeight: 1.2 }}>
            SMS Notifications
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#6B5D53", margin: 0 }}>
            Automated daily wellness &amp; schedule reminders
          </p>
        </div>

        {/* Optional, said first and said plainly. A reviewer reading this page
            top to bottom must not be able to mistake it for a gate. */}
        <div style={{ background: "rgba(63,111,94,0.08)", border: "1px solid rgba(63,111,94,0.25)", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#2F5547", margin: "0 0 0.35rem" }}>
            Text messages are completely optional.
          </p>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "#3F6F5E", margin: "0 0 0.75rem" }}>
            You do not need to subscribe to create an account, sign in, or use any part of
            Aya&apos;s Dashboard. Every notification sent by text is also shown inside the app.
            Subscribing only adds a second way to receive them.
          </p>
          <Link href="/" style={{ display: "inline-block", fontSize: "0.85rem", fontWeight: 600, color: "#3F6F5E", textDecoration: "underline" }}>
            Continue without text messages →
          </Link>
        </div>

        {/* Business info card */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "1.25rem", border: "1px solid rgba(180,85,47,0.15)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "#9C8D81", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Business Information</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {[
                ["Business Name",  "Aya’s Dashboard"],
                ["Owner / Operator", "Shaniqua Jones"],
                ["Business Type",  "Sole Proprietor — Personal Application"],
                ["Contact Email",  "shaniquaayajones@gmail.com"],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ paddingBottom: "0.5rem", paddingRight: "1rem", color: "#6B5D53", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: 500 }}>{label}</td>
                  <td style={{ paddingBottom: "0.5rem", color: "#1C1613" }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Program description */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.25rem", border: "1px solid rgba(180,85,47,0.15)", boxShadow: "0 4px 24px rgba(180,85,47,0.08)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "#9C8D81", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Program Description</p>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#1C1613", margin: "0 0 1rem" }}>
            This is a private, single-user personal wellness dashboard owned and operated by
            Shaniqua Jones. The SMS program sends automated daily reminders and briefings
            to the account holder&apos;s own registered mobile number only. No marketing messages,
            promotions, or third-party communications are sent.
          </p>

          {/* Message examples */}
          <div style={{ background: "#F7F2EC", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", border: "1px solid rgba(180,85,47,0.1)" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#B4552F", margin: "0 0 0.5rem" }}>Example messages:</p>
            <p style={{ fontSize: "0.8rem", color: "#1C1613", fontStyle: "italic", margin: "0 0 0.35rem" }}>&ldquo;Aya&apos;s Dashboard: Good morning. Today: work 7&ndash;2:30, therapy 11am, foundations 4pm, journal 7pm. Reply STOP to opt out.&rdquo;</p>
            <p style={{ fontSize: "0.8rem", color: "#1C1613", fontStyle: "italic", margin: "0 0 0.35rem" }}>&ldquo;Aya&apos;s Dashboard: 30 minutes &ndash; Ladder workout at 3pm. Reply STOP to opt out.&rdquo;</p>
            <p style={{ fontSize: "0.8rem", color: "#1C1613", fontStyle: "italic", margin: 0 }}>&ldquo;Aya&apos;s Dashboard: Reminder you set &ndash; pay the electric bill today. Reply HELP for help, STOP to cancel.&rdquo;</p>
          </div>

          {/* Interactive opt-in form */}
          <SmsOptInForm />

          {/* Required CTIA disclosures */}
          <div style={{ fontSize: "0.78rem", lineHeight: 1.8, color: "#6B5D53", borderTop: "1px solid rgba(180,85,47,0.12)", paddingTop: "1rem", display: "grid", gap: "0.35rem" }}>
            <p style={{ margin: 0 }}><strong style={{ color: "#1C1613" }}>Program Name:</strong> Aya&apos;s Dashboard — Personal Wellness Reminders</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1C1613" }}>Message Frequency:</strong> Recurring, up to 2 messages per day.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1C1613" }}>Msg &amp; Data Rates May Apply.</strong> Rates depend on your mobile carrier plan.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1C1613" }}>To Stop:</strong> Reply <strong>STOP</strong> to cancel all messages at any time.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1C1613" }}>For Help:</strong> Reply <strong>HELP</strong> or email <a href="mailto:shaniquaayajones@gmail.com" style={{ color: "#B4552F", textDecoration: "none" }}>shaniquaayajones@gmail.com</a>.</p>
            <p style={{ margin: 0 }}>Phone numbers are <strong>never shared with third parties</strong> or used for any purpose other than delivering these personal wellness messages.</p>
          </div>
        </div>

        {/* Footer links */}
        <div style={{ fontSize: "0.78rem", color: "#9C8D81", textAlign: "center" }}>
          <Link href="/terms" style={{ color: "#B4552F", textDecoration: "none" }}>Terms of Service</Link>
          <span style={{ margin: "0 0.5rem" }}>·</span>
          <Link href="/privacy" style={{ color: "#B4552F", textDecoration: "none" }}>Privacy Policy</Link>
          <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#9C8D81" }}>
            Aya&apos;s Dashboard · Sole Proprietor · shaniquaayajones@gmail.com
          </p>
        </div>

      </div>
    </div>
  );
}
