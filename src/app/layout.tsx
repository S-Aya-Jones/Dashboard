import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aya's Dashboard",
  description: "A personal life dashboard — calm, clear, and grounded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
