"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setErr((await res.json().catch(() => ({}))).error ?? "That didn't work.");
        setPin("");
        inputRef.current?.focus();
        return;
      }
      // A full navigation, so the middleware re-runs with the new cookie.
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6" style={{ background: "var(--bg)" }}>
      <form onSubmit={submit} className="w-full" style={{ maxWidth: "22rem" }}>
        <h1 className="font-serif text-3xl mb-1" style={{ color: "var(--text)" }}>Aya&apos;s Dashboard</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Enter your PIN.</p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="••••"
          className="w-full text-center tracking-[0.5em] rounded-xl px-4 py-4 text-xl"
          style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
        />

        {err && <p className="text-sm mt-3" style={{ color: "var(--red)" }}>{err}</p>}

        <button
          type="submit"
          disabled={busy || !pin.trim()}
          className="w-full mt-4 py-3 rounded-xl font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Unlock
        </button>

        <p className="text-xs mt-6 leading-relaxed" style={{ color: "var(--text-light)" }}>
          Study-partner links and the SMS pages stay open — they don&apos;t need this.
        </p>
      </form>
    </main>
  );
}
