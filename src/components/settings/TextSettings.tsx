"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Check, Loader2 } from "lucide-react";

// Texting, and whether it is actually working.
//
// Everything the app sends goes out as a text. Twilio carries it when the A2P
// campaign is approved and the number is right; a carrier email gateway is the
// fallback, which delivers from the wrong number and truncates, so a send that
// only worked because of the fallback is reported as a failure here rather than
// as success.

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
  summary?: { working: boolean; line: string; detail: string | null };
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

  const summary = status?.summary;

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
      if (data.via === "carrier-gateway") {
        setErr(`${data.warning} ${data.twilioError ?? ""}`.trim());
      } else if (data.via === "twilio") {
        setMsg("Sent through Twilio — check your phone.");
      } else if (okMsg) setMsg(okMsg);
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
          <MessageSquare size={16} style={{ color: "var(--purple)" }} /> Texts
        </p>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every notification is sent as a text to your phone.
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
        <span className="text-sm" style={{ color: "var(--text)" }}>Send me texts</span>
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

      {summary && (
        <div className="rounded-xl px-3.5 py-3 mb-3"
          style={{
            background: summary.working ? "rgba(15,138,85,0.08)" : "rgba(192,80,60,0.08)",
            border: `1.5px solid ${summary.working ? "rgba(15,138,85,0.35)" : "rgba(192,80,60,0.35)"}`,
          }}>
          <p className="text-sm font-bold" style={{ color: summary.working ? "#0F8A55" : "#C0503C" }}>
            {summary.line}
          </p>
          {summary.detail && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {summary.detail}
            </p>
          )}
        </div>
      )}

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
              10DLC campaign is approved — that review is judged on the{" "}
              <a href="/sms-opt-in" style={{ color: "var(--purple)", fontWeight: 600 }}>consent page</a>,
              and on Twilio&apos;s inbound webhook pointing at{" "}
              <span style={{ color: "var(--text)" }}>/api/sms/inbound</span> so STOP and HELP are answered.
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
