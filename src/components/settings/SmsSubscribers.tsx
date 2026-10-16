"use client";

import { useEffect, useState } from "react";
import { Users, ExternalLink, Check } from "lucide-react";

// Who is subscribed to texts.
//
// Two jobs. For Aya it answers "did that actually work" after someone opts in.
// For the A2P review it is the other half of the consent story: the opt-in page
// takes consent, and this shows the application holding it — a list with
// timestamps, reachable from inside the product rather than a standalone page
// that exists only for a reviewer.

interface Sub {
  id: number;
  name: string | null;
  phone: string;
  role: "self" | "partner";
  consentAt: string;
}

interface Payload {
  counts: { active: number; optedOut: number; self: number; partner: number };
  subscribers: Sub[];
}

export function SmsSubscribers() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/sms/subscribers", { cache: "no-store" })
      .then(r => r.json())
      .then(d => (d.error ? setErr(true) : setData(d)))
      .catch(() => setErr(true));
  }, []);

  if (err) return null;

  const n = data?.counts.active ?? 0;

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Users size={15} style={{ color: "var(--purple)" }} />
        <h3 className="section-title">Text subscribers</h3>
        {data && (
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--text-light)" }}>
            {n} active{data.counts.optedOut > 0 ? ` · ${data.counts.optedOut} opted out` : ""}
          </span>
        )}
      </div>

      {!data ? (
        <p className="text-xs" style={{ color: "var(--text-light)" }}>Loading…</p>
      ) : n === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Nobody is subscribed yet. Texts can&apos;t go anywhere until at least one number
          has opted in through the consent page — and an empty list is the first thing an
          A2P reviewer would notice.
        </p>
      ) : (
        <div className="space-y-1 mb-2">
          {data.subscribers.map(s => (
            <div key={s.id} className="flex items-baseline gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg)" }}>
              <Check size={12} className="flex-shrink-0" style={{ color: "#0F8A55" }} />
              <span className="text-sm" style={{ color: "var(--text)" }}>{s.name ?? s.phone}</span>
              {s.name && <span className="text-[11px]" style={{ color: "var(--text-light)" }}>{s.phone}</span>}
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                style={{
                  background: s.role === "self" ? "rgba(180,85,47,0.12)" : "rgba(63,111,94,0.12)",
                  color: s.role === "self" ? "#B4552F" : "#3F6F5E",
                }}>
                {s.role === "self" ? "you" : "partner"}
              </span>
              <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: "var(--text-light)" }}>
                {new Date(s.consentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}

      <a href="/sms-opt-in"
        className="inline-flex items-center gap-1.5 text-xs font-semibold mt-1"
        style={{ color: "var(--purple)" }}>
        Open the subscribe page <ExternalLink size={11} />
      </a>
      <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-light)" }}>
        Consent, the timestamp and the address it came from are recorded for each number.
        Replying STOP removes that one number immediately and affects nobody else.
      </p>
    </div>
  );
}
