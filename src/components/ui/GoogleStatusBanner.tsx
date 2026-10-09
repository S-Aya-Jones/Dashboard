"use client";

import { useEffect, useState } from "react";
import { Unplug, ChevronDown } from "lucide-react";

// Says out loud when Google has dropped, and why.
//
// Before this the only signal was calendar and email quietly going empty,
// which reads as "the app is broken" rather than "the connection expired and
// here is the setting that stops it expiring". Only rendered when something is
// actually wrong, and only after it has been checked — no banner on a good day.

interface Status {
  connected: boolean;
  everConnected: boolean;
  email?: string | null;
  diagnosis?: {
    reason: string;
    detail: string;
    fix: string;
    recurring: boolean;
  } | null;
}

export function GoogleStatusBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    fetch("/api/google/status", { cache: "no-store" })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => { /* a failed check isn't itself news */ });
  }, []);

  // Never nag about a connection that was never made — that's a setup step,
  // not a fault.
  if (hidden || !status || status.connected || !status.everConnected) return null;

  const d = status.diagnosis;

  return (
    <div className="px-4 py-2.5 text-sm" style={{ background: "#7A4A1F", color: "#FFF6EE" }} role="alert">
      <div className="flex items-start gap-2">
        <Unplug size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <button onClick={() => setOpen(v => !v)} className="text-left w-full">
            <span className="font-semibold">
              {d?.reason ?? "Google is disconnected"}
              {status.email ? ` — ${status.email}` : ""}
            </span>
            {d?.recurring && (
              <span className="ml-2 text-xs font-bold uppercase tracking-wider" style={{ opacity: 0.85 }}>
                will keep happening
              </span>
            )}
            <ChevronDown
              size={14}
              className="inline ml-1.5 align-middle"
              style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
            />
          </button>

          {open && d && (
            <div className="mt-2 space-y-2 text-[13px] leading-relaxed" style={{ opacity: 0.95 }}>
              <p>{d.detail}</p>
              <p><strong>Fix:</strong> {d.fix}</p>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <a
              href="/api/google/auth"
              className="underline font-semibold"
              style={{ color: "#FFF6EE" }}
            >
              Reconnect Google
            </a>
            <button onClick={() => setHidden(true)} className="text-xs" style={{ opacity: 0.8 }}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
