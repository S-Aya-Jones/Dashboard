import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In — Aya's Dashboard",
  description: "SMS notification consent and opt-in page for Aya's personal wellness dashboard.",
  robots: { index: true, follow: true },
};

export default function SmsOptInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
