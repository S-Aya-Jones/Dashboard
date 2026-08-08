import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Shown when APP_PIN has not been set. The site stays closed rather than open,
// so a missing setting can never quietly leave everything readable.
export default function LockedPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6" style={{ background: "var(--bg)" }}>
      <div className="w-full" style={{ maxWidth: "30rem" }}>
        <h1 className="font-serif text-3xl mb-2" style={{ color: "var(--text)" }}>One setting to go</h1>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>
          The dashboard is locked because no PIN has been set yet. It stays locked
          rather than open, so nothing personal is readable in the meantime.
        </p>

        <ol className="text-sm leading-relaxed space-y-2 mb-5" style={{ color: "var(--text)" }}>
          <li>1. Open your project on <strong>vercel.com</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
          <li>2. Add <code style={{ background: "var(--surface2)", padding: "1px 6px", borderRadius: 5 }}>APP_PIN</code> with the PIN you want. Any digits you&apos;ll remember.</li>
          <li>3. Go to <strong>Deployments</strong>, open the newest one, and choose <strong>Redeploy</strong>.</li>
        </ol>

        <p className="text-xs leading-relaxed" style={{ color: "var(--text-light)" }}>
          Study-partner links, the SMS opt-in page and the Twilio webhooks keep working
          throughout — they were never behind the PIN.
        </p>
      </div>
    </main>
  );
}
