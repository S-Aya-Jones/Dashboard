import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/PwaRegistration";
import { VoiceButton } from "@/components/VoiceButton";

export const metadata: Metadata = {
  title: "Aya's Dashboard",
  description: "A personal life dashboard — calm, clear, and grounded.",
  appleWebApp: {
    capable: true,
    title: "Aya's",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#7C5CFC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PwaRegistration />
        {children}
        <VoiceButton />
      </body>
    </html>
  );
}
