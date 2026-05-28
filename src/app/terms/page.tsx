import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Aya's Dashboard",
};

export default function TermsPage() {
  return (
    <div
      style={{
        background: "#111111",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#FFFFFF",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            color: "#DA667B",
            textDecoration: "none",
            marginBottom: "2.5rem",
            letterSpacing: "0.02em",
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1.5rem" }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 500,
              color: "#FFFFFF",
              margin: "0 0 0.5rem",
              lineHeight: 1.15,
            }}
          >
            Terms of Service
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#A8967E", margin: 0 }}>
            Last updated: May 23, 2026
          </p>
        </div>

        <div style={{ lineHeight: 1.8, fontSize: "0.95rem" }}>

          <Section title="About This Application">
            <p>
              This Terms of Service governs the use of this personal productivity dashboard
              (the &quot;Application&quot;). The Application is a private, single-user system built
              and operated solely for the personal use of the account holder,{" "}
              <strong>Aya Jones</strong>. It is not a commercial service offered to the
              general public, and no one other than the account holder is authorized to use
              it.
            </p>
          </Section>

          <Section title="Acceptance of Terms">
            <p>
              By using this Application, the account holder agrees to these Terms of
              Service. Because this is a personal-use application, these terms exist
              primarily to satisfy regulatory and compliance requirements (including SMS
              registration) and to document how the application operates.
            </p>
          </Section>

          <Section title="Permitted Use">
            <p>
              This Application is provided exclusively for the personal productivity use of
              the account holder. The account holder may use the Application to track tasks,
              habits, goals, health data, study progress, and other personal information.
              Access by any other individual is not permitted.
            </p>
          </Section>

          <Section title="SMS Messaging Terms">
            <p>
              The account holder may register their own phone number to receive automated
              SMS messages from this Application. By entering their phone number and
              enabling SMS features, the account holder agrees to the following:
            </p>
            <ul>
              <li>
                <strong>Message content:</strong> Automated daily productivity briefings,
                including task summaries, habit progress, and other personal dashboard data
              </li>
              <li>
                <strong>Message frequency:</strong> Up to 1 message per day, plus responses
                to account-holder-initiated commands or HELP requests
              </li>
              <li>
                <strong>Message and data rates:</strong> Standard message and data rates
                from the account holder&apos;s mobile carrier may apply
              </li>
              <li>
                <strong>Opt-out:</strong> The account holder may opt out at any time by
                replying <strong>STOP</strong> to any message. No further messages will be
                sent after an opt-out is received
              </li>
              <li>
                <strong>Help:</strong> The account holder may reply <strong>HELP</strong>{" "}
                at any time to receive assistance information
              </li>
              <li>
                <strong>Cancellation:</strong> The account holder may also cancel SMS
                delivery at any time by removing their phone number from the Application
                settings
              </li>
            </ul>
            <p>
              Phone numbers used for SMS are never shared with third parties or used for
              any purpose other than delivering these personal productivity messages to the
              account holder.
            </p>
          </Section>

          <Section title="No Warranty">
            <p>
              This Application is provided <strong>&quot;as is&quot;</strong> without warranty of
              any kind, express or implied. The account holder acknowledges that:
            </p>
            <ul>
              <li>The Application may be unavailable at times due to maintenance, infrastructure issues, or other factors</li>
              <li>Data may be lost in the event of database failure or misconfiguration</li>
              <li>The Application is a personal project and is not maintained to commercial service standards</li>
            </ul>
            <p>
              The account holder uses the Application at their own risk and is encouraged
              to maintain their own backups of important data.
            </p>
          </Section>

          <Section title="Accuracy of Data">
            <p>
              The account holder is solely responsible for the accuracy and completeness of
              all information entered into the Application. The Application does not verify,
              validate, or endorse any data entered by the account holder. Medical,
              financial, and other sensitive data entered into the Application should not be
              relied upon as a substitute for professional advice.
            </p>
          </Section>

          <Section title="Modifications to the Service">
            <p>
              The account holder may modify, update, suspend, or discontinue this
              Application at any time, for any reason, without notice to any party. Because
              this is a single-user personal application, there are no other users who would
              be affected by such changes.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              To the fullest extent permitted by applicable law, the account holder (as
              operator of this Application) shall not be liable for any indirect,
              incidental, special, or consequential damages arising from the use or
              inability to use the Application, including but not limited to loss of data.
            </p>
          </Section>

          <Section title="Governing Law">
            <p>
              These Terms of Service are governed by the laws of the State of Tennessee,
              United States, without regard to conflict of law principles.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              These Terms may be updated at any time by the account holder. The &quot;Last
              updated&quot; date at the top of this page reflects when the terms were most
              recently revised.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these Terms of Service may be directed to the account holder.
              As this is a personal single-user application, no formal legal or support
              team exists — all inquiries go to the individual who owns and operates this
              dashboard.
            </p>
          </Section>

        </div>

        <div
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: "0.8rem",
            color: "#A8967E",
            textAlign: "center",
          }}
        >
          Aya&apos;s Dashboard · Personal Productivity System · Single-user application
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "1.35rem",
          fontWeight: 500,
          color: "#FFFFFF",
          margin: "0 0 0.75rem",
          paddingBottom: "0.35rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#FFFFFF" }}>
        {children}
      </div>
    </div>
  );
}
