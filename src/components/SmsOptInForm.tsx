"use client";
import { useEffect, useState } from "react";

// The opt-in form.
//
// This used to be a mock: it showed a checkbox, a button and a tick, and stored
// nothing. Anyone could "subscribe" and no number, consent or timestamp was
// ever written down — which is why the A2P campaign had no consent record to
// point at, and why a reviewer testing the form would have found it did
// nothing.
//
// It now posts to /api/sms/subscribe, which records the number, the moment
// consent was given and the address it came from, then sends the confirmation
// message. The checkbox wording here is the same text stored against each
// subscriber and quoted in the campaign registration; changing one means
// changing all three.

type State = "idle" | "saving" | "done" | "error";

export function SmsOptInForm() {
  const [checked, setChecked] = useState(false);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sms/number", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setFrom(d.display ?? null))
      .catch(() => {});
  }, []);

  const digits = number.replace(/\D/g, "").replace(/^1/, "");
  const valid = digits.length === 10;

  const submit = async () => {
    if (!checked || !valid || state === "saving") return;
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/sms/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, name: name.trim() || null, consent: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't subscribe that number."); setState("error"); return; }
      setConfirmationSent(Boolean(d.confirmationSent));
      setState("done");
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem", background: "rgba(180,85,47,0.06)", borderRadius: "12px", border: "1px solid rgba(180,85,47,0.2)", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", color: "#3F6F5E" }}>✓</div>
        <p style={{ fontWeight: 600, color: "#1C1613", margin: "0 0 0.35rem", fontSize: "1.05rem" }}>You&apos;re subscribed.</p>
        <p style={{ fontSize: "0.85rem", color: "#6B5D53", margin: 0, lineHeight: 1.6 }}>
          {confirmationSent
            ? <>A confirmation text is on its way to <strong style={{ color: "#1C1613" }}>{number}</strong>.</>
            : <>Your consent is recorded. The confirmation text couldn&apos;t be sent just now — messaging may not be live yet.</>}
          {from ? <> Recurring messages come from <strong style={{ color: "#1C1613" }}>{from}</strong>, up to 2 per day.</> : <> Recurring, up to 2 messages per day.</>}
          {" "}Reply <strong style={{ color: "#1C1613" }}>STOP</strong> at any time to cancel.
        </p>
      </div>
    );
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "0.75rem 1rem", fontSize: "0.95rem", color: "#1C1613",
    background: "#fff", border: "1px solid rgba(180,85,47,0.25)", borderRadius: "10px",
    marginBottom: "0.9rem", outline: "none", fontFamily: "inherit",
  };

  return (
    <>
      <label htmlFor="sms-name" style={{ display: "block", fontSize: "0.8rem", color: "#6B5D53", marginBottom: "0.4rem", fontWeight: 500 }}>
        Your name <span style={{ color: "#9C8D81" }}>(optional)</span>
      </label>
      <input id="sms-name" type="text" value={name} autoComplete="name"
        onChange={e => setName(e.target.value)} placeholder="Deandra" style={field} />

      <label htmlFor="sms-phone" style={{ display: "block", fontSize: "0.8rem", color: "#6B5D53", marginBottom: "0.4rem", fontWeight: 500 }}>
        Your mobile number
      </label>
      <input id="sms-phone" type="tel" value={number} autoComplete="tel" inputMode="tel"
        onChange={e => setNumber(e.target.value)} placeholder="(615) 555-0123" style={field} />

      {from && (
        <p style={{ fontSize: "0.78rem", color: "#6B5D53", margin: "0 0 1.1rem", lineHeight: 1.5 }}>
          Messages will come from <strong style={{ color: "#1C1613" }}>{from}</strong>.
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1rem", padding: "1rem", background: "rgba(180,85,47,0.04)", borderRadius: "10px", border: "1px solid rgba(180,85,47,0.12)" }}>
        <input
          type="checkbox"
          id="consent"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          style={{ marginTop: "3px", flexShrink: 0, width: 16, height: 16, accentColor: "#B4552F", cursor: "pointer" }}
        />
        <label htmlFor="consent" style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#1C1613", cursor: "pointer" }}>
          Yes, I agree to receive <strong>recurring automated SMS messages</strong> from
          Aya&apos;s Dashboard (operated by Shaniqua Jones): schedule reminders, a daily
          summary, reminders I set in the app, and accountability updates. I understand
          this is <strong>up to 2 messages per day</strong> and that{" "}
          <strong>message and data rates may apply</strong>. I can reply STOP at any time
          to cancel, or HELP for help.{" "}
          <strong>Consent is not required to create an account or to use any part of the
          application.</strong>{" "}
          See the{" "}
          <a href="/terms" style={{ color: "#B4552F", fontWeight: 600 }}>Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: "#B4552F", fontWeight: 600 }}>Privacy Policy</a>.
        </label>
      </div>

      {error && (
        <p style={{ fontSize: "0.82rem", color: "#B23A2E", margin: "0 0 0.9rem" }}>{error}</p>
      )}

      <button
        onClick={submit}
        disabled={!checked || !valid || state === "saving"}
        style={{
          width: "100%",
          padding: "0.85rem 1.5rem",
          background: checked && valid ? "#B4552F" : "rgba(180,85,47,0.25)",
          color: checked && valid ? "#fff" : "rgba(180,85,47,0.55)",
          border: "none",
          borderRadius: "10px",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: checked && valid && state !== "saving" ? "pointer" : "not-allowed",
          transition: "background 0.2s",
          marginBottom: "1.25rem",
          letterSpacing: "0.02em",
        }}
      >
        {state === "saving" ? "Subscribing…" : "Subscribe"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#6B5D53", margin: "0 0 1.25rem" }}>
        Don&apos;t want texts?{" "}
        <a href="/" style={{ color: "#3F6F5E", fontWeight: 600 }}>Continue to the app without subscribing</a>
        {" "}— nothing is withheld.
      </p>
    </>
  );
}
