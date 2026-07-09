import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Opt-In — Aya's Dashboard",
  description: "SMS notification consent and opt-in page for Aya's personal wellness dashboard.",
  robots: { index: true, follow: true },
};

export default function SmsOptInPage() {
  return (
    <div style={{ background: "#F4F0FE", minHeight: "100vh", overflowY: "auto", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E1340" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        {/* Brand header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", color: "#7C5CFC", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
            Aya&apos;s Personal Dashboard
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.9rem", fontWeight: 500, margin: "0 0 0.4rem", color: "#1E1340", lineHeight: 1.2 }}>
            SMS Notifications
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#7C6FAE", margin: 0 }}>
            Automated daily wellness &amp; fitness reminders
          </p>
        </div>

        {/* Business info card */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "1.25rem", border: "1px solid rgba(124,92,252,0.15)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "#A89ECC", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Business Information</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {[
                ["Business Name", "Aya's Dashboard"],
                ["Owner / Operator", "Shaniqua Jones"],
                ["Business Type", "Sole Proprietor — Personal Application"],
                ["Contact Email", "shaniquaayajones@gmail.com"],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ paddingBottom: "0.5rem", paddingRight: "1rem", color: "#7C6FAE", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: 500 }}>{label}</td>
                  <td style={{ paddingBottom: "0.5rem", color: "#1E1340" }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Program description */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.25rem", border: "1px solid rgba(124,92,252,0.15)", boxShadow: "0 4px 24px rgba(124,92,252,0.08)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "#A89ECC", textTransform: "uppercase", margin: "0 0 0.75rem" }}>Program Description</p>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#1E1340", margin: "0 0 1rem" }}>
            This is a private, single-user personal wellness dashboard owned and operated by
            Shaniqua Jones. The SMS program sends automated daily reminders and briefings
            to the account holder&apos;s own registered mobile number only. No marketing messages,
            promotions, or third-party communications are sent.
          </p>

          {/* Message examples */}
          <div style={{ background: "#FAF8FF", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid rgba(124,92,252,0.1)" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7C5CFC", margin: "0 0 0.5rem" }}>Example messages:</p>
            <p style={{ fontSize: "0.8rem", color: "#1E1340", fontStyle: "italic", margin: "0 0 0.35rem" }}>&ldquo;Good morning! Your workout today: Upper Body Push. 3 habits completed yesterday. Stay on track! 💪&rdquo;</p>
            <p style={{ fontSize: "0.8rem", color: "#1E1340", fontStyle: "italic", margin: 0 }}>&ldquo;Daily check-in: 4/5 habits done, 7.5 hrs sleep, 2L water. You&apos;re killing it.&rdquo;</p>
          </div>

          {/* Opt-in consent */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1.25rem", padding: "1rem", background: "rgba(124,92,252,0.04)", borderRadius: "10px", border: "1px solid rgba(124,92,252,0.12)" }}>
            <input type="checkbox" id="consent" defaultChecked style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#7C5CFC" }} />
            <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1E1340" }}>
              Yes, I consent to receive automated text messages from Aya&apos;s Dashboard
              (operated by Shaniqua Jones) about my daily workout reminders, wellness
              check-ins, and fitness updates. I understand I will receive up to <strong>2 messages per day</strong>.
              Consent is not a condition of use.
            </label>
          </div>

          {/* Required CTIA disclosures */}
          <div style={{ fontSize: "0.78rem", lineHeight: 1.8, color: "#7C6FAE", borderTop: "1px solid rgba(124,92,252,0.12)", paddingTop: "1rem", display: "grid", gap: "0.35rem" }}>
            <p style={{ margin: 0 }}><strong style={{ color: "#1E1340" }}>Program Name:</strong> Aya&apos;s Dashboard — Personal Wellness Reminders</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1E1340" }}>Message Frequency:</strong> Up to 2 messages per day.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1E1340" }}>Msg &amp; Data Rates May Apply.</strong> Rates depend on your mobile carrier plan.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1E1340" }}>To Stop:</strong> Reply <strong>STOP</strong> to cancel all messages at any time.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#1E1340" }}>For Help:</strong> Reply <strong>HELP</strong> or email <a href="mailto:shaniquaayajones@gmail.com" style={{ color: "#7C5CFC", textDecoration: "none" }}>shaniquaayajones@gmail.com</a>.</p>
            <p style={{ margin: 0 }}>Phone numbers are <strong>never shared with third parties</strong> or used for any purpose other than delivering these personal wellness messages.</p>
          </div>
        </div>

        {/* Footer links */}
        <div style={{ fontSize: "0.78rem", color: "#A89ECC", textAlign: "center" }}>
          <Link href="/terms" style={{ color: "#7C5CFC", textDecoration: "none" }}>Terms of Service</Link>
          <span style={{ margin: "0 0.5rem" }}>·</span>
          <Link href="/privacy" style={{ color: "#7C5CFC", textDecoration: "none" }}>Privacy Policy</Link>
          <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#C4B8E8" }}>
            Aya&apos;s Dashboard · Sole Proprietor · shaniquaayajones@gmail.com
          </p>
        </div>

      </div>
    </div>
  );
}
