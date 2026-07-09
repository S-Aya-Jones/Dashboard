import type { Metadata } from "next";
import { OptInForm } from "./OptInForm";

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
            Aya&apos;s Dashboard · Personal Productivity Platform
          </p>
        </div>

        <OptInForm />

      </div>
    </div>
  );
}
