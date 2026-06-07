"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pw,      setPw]      = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setError("Wrong password.");
        setPw("");
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "0 1.5rem" }}>
        <p style={{ color: "#C8FF00", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 8 }}>
          AYA DASHBOARD
        </p>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Welcome back.</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 32 }}>Enter your password to continue.</p>

        <form onSubmit={submit}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              display: "block", width: "100%", background: "#111",
              border: `1px solid ${error ? "#DA667B" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 14, padding: "14px 16px", color: "#fff",
              fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box",
            }}
          />
          {error && (
            <p style={{ color: "#DA667B", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={!pw || loading}
            style={{
              width: "100%", background: pw && !loading ? "#C8FF00" : "rgba(200,255,0,0.3)",
              color: "#000", border: "none", borderRadius: 14,
              padding: "14px 0", fontSize: 15, fontWeight: 700,
              cursor: pw && !loading ? "pointer" : "not-allowed", transition: "all 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}
