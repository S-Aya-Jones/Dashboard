"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// The lock screen.
//
// Does the deciding that the middleware deliberately does not: asks once
// whether a PIN exists, and if none does, takes the session it is handed and
// gets out of the way. That is the path that keeps this from ever being a
// locked door with no key.

function Pad({ onPress }: { onPress: (d: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-5">
      {keys.map((k, i) =>
        k === "" ? <span key={i} /> : (
          <button
            key={i}
            type="button"
            onClick={() => onPress(k)}
            className="rounded-xl py-4 text-xl tabular-nums active:opacity-60"
            style={{ background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)" }}
          >
            {k}
          </button>
        ),
      )}
    </div>
  );
}

function LockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [state, setState] = useState<"checking" | "enter" | "create">("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/lock", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (!d.locked) { router.replace(next); return; }
        setState("enter");
      })
      .catch(() => setState("enter"));
  }, [router, next]);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state === "create" ? { newPin: value } : { pin: value }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Try again."); setPin(""); setBusy(false); return; }
      router.replace(next);
    } catch {
      setError("Could not reach the app.");
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    if (d === "⌫") { setPin(p => p.slice(0, -1)); return; }
    const value = (pin + d).slice(0, 8);
    setPin(value);
    // Four is the usual length, so it submits itself there. Longer PINs need
    // the button, which is a fair trade for not making four taps into five.
    if (value.length === 4 && state === "enter") submit(value);
  };

  if (state === "checking") return null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[300px]">
        <h1 className="font-serif text-3xl text-center" style={{ color: "var(--text)" }}>
          {state === "create" ? "Choose a PIN" : "Aya"}
        </h1>
        <p className="text-center text-sm mt-1 mb-5" style={{ color: "var(--text-muted)" }}>
          {state === "create" ? "At least 4 digits. Only you have it." : "Enter your PIN"}
        </p>

        <div className="flex justify-center gap-2.5" aria-live="polite">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 11, height: 11,
                background: i < pin.length ? "var(--purple)" : "var(--border2)",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-[13px] mt-3" style={{ color: "#C0392B" }}>{error}</p>
        )}

        <Pad onPress={press} />

        {(state === "create" || pin.length > 4) && (
          <button
            type="button"
            disabled={busy || pin.length < 4}
            onClick={() => submit(pin)}
            className="w-full rounded-xl py-3 mt-3 text-sm"
            style={{
              background: pin.length >= 4 ? "var(--purple)" : "var(--surface2)",
              color: pin.length >= 4 ? "#fff" : "var(--text-light)",
            }}
          >
            {state === "create" ? "Set PIN" : "Unlock"}
          </button>
        )}

        {state === "enter" && (
          <p className="text-center text-[11px] mt-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Forgotten it? Text: set pin 1234
          </p>
        )}
      </div>
    </main>
  );
}

export default function LockPage() {
  // useSearchParams needs a boundary, and the fallback is deliberately blank:
  // a flash of "Aya" before the real screen reads as a glitch on the one page
  // whose whole job is to look solid.
  return (
    <Suspense fallback={null}>
      <LockForm />
    </Suspense>
  );
}
