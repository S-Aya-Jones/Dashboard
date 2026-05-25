import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Aya's Dashboard",
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        background: "#F1E0C5",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#342A21",
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
        <div style={{ marginBottom: "2.5rem", borderBottom: "1px solid rgba(201,183,156,0.4)", paddingBottom: "1.5rem" }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 500,
              color: "#342A21",
              margin: "0 0 0.5rem",
              lineHeight: 1.15,
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#A8967E", margin: 0 }}>
            Last updated: May 23, 2026
          </p>
        </div>

        <div style={{ lineHeight: 1.8, fontSize: "0.95rem" }}>

          <Section title="Overview">
            <p>
              This Privacy Policy describes how data is collected, used, and stored by this
              personal productivity dashboard. This application is a single-user system owned
              and operated solely by the account holder, <strong>Aya Jones</strong>, a sole
              proprietor. It is not a commercial product offered to the public.
            </p>
          </Section>

          <Section title="What Data Is Collected">
            <p>
              This dashboard collects only information that the account holder enters
              directly. This may include:
            </p>
            <ul>
              <li>Daily tasks and to-do items</li>
              <li>Habit tracking logs and goals</li>
              <li>Personal goals (quarterly and yearly)</li>
              <li>Exposure therapy logs and anxiety check-ins</li>
              <li>Fitness sessions and sleep logs</li>
              <li>MCAT study sessions and practice test scores</li>
              <li>Skincare routine and product notes</li>
              <li>Financial summaries (credit card balances, savings goals)</li>
              <li>Connection logs (who the account holder spent time with)</li>
              <li>Books read, wins, shadowing sessions, and other personal notes</li>
              <li>
                <strong>Phone number:</strong> the account holder&apos;s own phone number,
                stored solely to deliver automated daily productivity briefing messages to
                that same account holder via SMS
              </li>
            </ul>
            <p>
              No data is collected from any person other than the account holder.
            </p>
          </Section>

          <Section title="How Data Is Used">
            <p>All data collected is used exclusively to power this dashboard&apos;s features for the account holder. Specifically:</p>
            <ul>
              <li>To display personal productivity information across dashboard views</li>
              <li>
                To send automated daily SMS briefings to the account holder&apos;s own
                registered phone number (up to once per day)
              </li>
              <li>To persist data between sessions</li>
            </ul>
            <p>Data is never used for advertising, profiling, or any purpose beyond the account holder&apos;s personal use.</p>
          </Section>

          <Section title="SMS Messaging & Phone Number">
            <p>
              The account holder may optionally provide their phone number to receive
              automated daily productivity briefing messages. By providing a phone number,
              the account holder consents to receive these messages.
            </p>
            <ul>
              <li>Message frequency: up to 1 message per day, plus responses to account-holder-initiated commands</li>
              <li>Standard message and data rates may apply</li>
              <li>Reply <strong>STOP</strong> at any time to opt out of messages</li>
              <li>Reply <strong>HELP</strong> for assistance</li>
            </ul>
            <p>
              <strong>
                Phone numbers collected for SMS purposes are never shared with third parties,
                affiliates, or any other person or organization for marketing, promotional,
                or any other purpose.
              </strong>{" "}
              The phone number is used solely to send productivity messages to the account
              holder who provided it.
            </p>
          </Section>

          <Section title="Data Sharing">
            <p>
              No personal data collected by this application is sold, rented, traded, or
              shared with any third party. This includes but is not limited to:
            </p>
            <ul>
              <li>Advertisers or marketing companies</li>
              <li>Data brokers</li>
              <li>Analytics providers</li>
              <li>Any other individuals or organizations</li>
            </ul>
            <p>
              The only external services involved in operating this application are the
              infrastructure providers described below, and they process data only as
              necessary to host and run the application.
            </p>
          </Section>

          <Section title="Data Storage">
            <p>
              All dashboard data is stored in a PostgreSQL database hosted by{" "}
              <strong>Neon</strong> (neon.tech), a cloud database provider. Data is
              transmitted over encrypted connections. The account holder is responsible for
              maintaining the security of their Vercel deployment and database credentials.
            </p>
            <p>
              The application is hosted on <strong>Vercel</strong> (vercel.com). Vercel may
              collect standard server access logs (IP addresses, request timestamps) as part
              of normal hosting operations. Refer to Vercel&apos;s privacy policy for details
              on their data practices.
            </p>
          </Section>

          <Section title="Cookies & Tracking">
            <p>
              This application does not use advertising cookies, tracking pixels, or
              third-party analytics scripts. No behavioral tracking or cross-site tracking
              of any kind is implemented.
            </p>
            <p>
              Next.js, the framework powering this application, may set minimal functional
              cookies necessary for the application to operate (such as session continuity).
              No personal data is stored in these cookies.
            </p>
          </Section>

          <Section title="Data Deletion">
            <p>
              The account holder may delete their data at any time. Individual entries
              (tasks, habits, logs, etc.) can be deleted directly within the dashboard
              interface. To delete all stored data, the account holder may clear the
              database record associated with their user ID directly in the Neon database
              console.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              As this is a personal application, this policy may be updated at any time by
              the account holder. The &quot;Last updated&quot; date at the top of this page reflects
              the date of the most recent revision.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions or concerns about this Privacy Policy can be directed to the account
              holder directly. As this is a personal single-user application, no formal data
              protection officer or privacy team exists — inquiries go to the individual who
              owns and operates this dashboard.
            </p>
          </Section>

        </div>

        <div
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(201,183,156,0.4)",
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
          color: "#342A21",
          margin: "0 0 0.75rem",
          paddingBottom: "0.35rem",
          borderBottom: "1px solid rgba(201,183,156,0.3)",
        }}
      >
        {title}
      </h2>
      <div
        style={{ color: "#342A21" }}
      >
        {children}
      </div>
    </div>
  );
}
