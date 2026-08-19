"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Check, Loader2 } from "lucide-react";

// Telegram can't forward to SMS, and iOS Shortcuts can't trigger on a
// third-party app's notifications — so there is no way to route Telegram into
// Messages from the phone. What works instead is the dashboard sending both:
// Telegram as it always has, plus a plain-text copy through the carrier's
// email-to-SMS gateway. No Twilio account, no A2P campaign.

const CARRIER_LABELS: Record<string, string> = {
  tmobile: "T-Mobile",
  att: "AT&T",
  verizon: "Verizon",
  sprint: "Sprint",
  googlefi: "Google Fi",
  uscellular: "US Cellular",
  boost: "Boost",
  cricket: "Cricket",
  metro: "Metro",
};

interface Status {
  enabled: boolean;
  carrier: string;
  mailReady: boolean;
  twilio: boolean;
  provider: "twilio" | "carrier" | null;
  phoneHint: string | null;
  ready: boolean;
  carriers?: string[];
}

export function TextSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [phone, setPhone]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [showTwilio, setShowTwilio] = useState(false);
  const [sid, setSid]       = useState("");
  const [token, setToken]   = useState("");
  const [from, setFrom]     = useState("");
  const [msg, setMsg]       = useState<string | null>(null);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/sms", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function post(body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res  = await fetch("/api/settings/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      setStatus((s) => ({ ...(s as Status), ...data }));
      if (okMsg) setMsg(okMsg);
      if (body.phone) setPhone("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const carriers = status.carriers ?? Object.keys(CARRIER_LABELS);

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
    >
      <div>
        <p className="font-serif text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
          <MessageSquare size={16} style={{ color: "var(--purple)" }} /> Send it as a text too
        </p>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every notification goes to Telegram first — that copy is always kept. Switch
          this on and it lands in Messages too.
        </p>
        <p className="text-xs mt-1.5" style={{ color: status.provider ? "var(--green)" : "var(--text-light)" }}>
          {status.provider === "twilio"
            ? "Sending through Twilio"
            : status.provider === "carrier"
            ? `Sending through the ${CARRIER_LABELS[status.carrier] ?? status.carrier} gateway`
            : "No way to send yet"}
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={status.enabled}
          onChange={(e) => post({ enabled: e.target.checked })}
          disabled={busy}
          className="w-4 h-4"
          style={{ accentColor: "var(--purple)" }}
        />
        <span className="text-sm" style={{ color: "var(--text)" }}>Text me too</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone.trim() && post({ phone }, "Number saved")}
          placeholder={status.phoneHint ?? "Your mobile number"}
        />
        <select
          value={status.carrier}
          onChange={(e) => post({ carrier: e.target.value }, "Carrier saved")}
          disabled={busy}
        >
          {carriers.map((c) => (
            <option key={c} value={c}>{CARRIER_LABELS[c] ?? c}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => post({ test: true }, "Sent — it should land in a few seconds.")}
          disabled={busy}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-2"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
          Send me a test text
        </button>
        {status.ready && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--green)" }}>
            <Check size={12} /> Ready
          </span>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        {!showTwilio ? (
          <button onClick={() => setShowTwilio(true)} className="text-sm font-semibold" style={{ color: "var(--purple)" }}>
            {status.twilio ? "Change Twilio credentials" : "Use Twilio instead"}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Twilio is more reliable than the carrier gateway and actually reports
              whether a message arrived. US carriers only accept it once your A2P
              10DLC campaign is approved — that review is judged on the consent page
              at <span style={{ color: "var(--text)" }}>/sms-opt-in</span>.
            </p>
            <input type="text" value={sid} onChange={(e) => setSid(e.target.value)}
              placeholder={status.twilio ? "Account SID — already set" : "Account SID (AC…)"} />
            <input type="text" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder={status.twilio ? "Auth token — already set" : "Auth token"} />
            <input type="text" value={from} onChange={(e) => setFrom(e.target.value)}
              placeholder="Your Twilio number, e.g. +16155551234" />
            <button
              onClick={() => post(
                { twilioSid: sid, twilioToken: token, twilioFrom: from },
                "Twilio saved"
              ).then(() => { setSid(""); setToken(""); setFrom(""); })}
              disabled={busy}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--surface)" }}
            >
              Save Twilio
            </button>
          </div>
        )}
      </div>

      {!status.mailReady && !status.twilio && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Without Twilio, the fallback sends through Gmail and needs GMAIL_USER and
          GMAIL_APP_PASSWORD set in Vercel. That is the one part that can&apos;t be
          done from this screen.
        </p>
      )}
      {msg && <p className="text-xs" style={{ color: "var(--green)" }}>{msg}</p>}
      {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
    </div>
  );
}
