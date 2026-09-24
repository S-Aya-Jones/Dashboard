"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserPlus, Copy, Check, Trash2, RefreshCw, Camera, Loader2 } from "lucide-react";
import { shareOrigin } from "@/lib/siteUrl";

// Setting up study partners. The link is the whole credential, so the two
// things that matter here are being able to copy it easily and being able to
// kill it instantly.

interface Partner {
  id: string;
  name: string;
  role: "quizmaster" | "accountability";
  mediaId: string | null;
  token: string;
  seeScores: boolean;
  active: boolean;
  lastSeenAt: string | null;
}

const ROLES = [
  { id: "quizmaster",     label: "Quiz me",      hint: "Sees your questions and the answers, and can mark you" },
  { id: "accountability", label: "Check on me",  hint: "Sees whether you've been studying. No material." },
] as const;

export function PartnersView() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName]   = useState("");
  const [role, setRole]   = useState<Partner["role"]>("quizmaster");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partners", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load your study partners");
      setPartners(body.partners ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load your study partners");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function pickPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      // Shrink before upload — a full phone photo is megabytes and this is a
      // 64px circle. That mistake is what took the database down last week.
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) { setPhoto(raw); return; }
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        setPhoto(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => setPhoto(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, photo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't add them");
      setName(""); setPhoto(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add them");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, fields: Record<string, unknown>) {
    await fetch("/api/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/partners?id=${id}`, { method: "DELETE" });
    load();
  }

  function copy(token: string, id: string) {
    // Always the production domain — a link copied off a preview deployment
    // lands her friends on Vercel's sign-in page.
    const url = `${shareOrigin()}/partner/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Add someone */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
        <p className="font-serif text-lg" style={{ color: "var(--text)" }}>Add a study partner</p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
            style={{ width: 64, height: 64, background: "var(--surface2)", border: "2px dashed var(--border2)", color: "var(--text-light)" }}
          >
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt="" className="w-full h-full object-cover" />
              : <Camera size={20} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
            className="flex-1"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => {
            const on = role === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className="text-xs font-semibold px-3 py-2 rounded-full"
                style={{
                  background: on ? "var(--text)" : "transparent",
                  color:      on ? "var(--surface)" : "var(--text-muted)",
                  border:     `1px solid ${on ? "var(--text)" : "var(--border)"}`,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-light)" }}>
          {ROLES.find((r) => r.id === role)!.hint}
        </p>

        <button
          onClick={add}
          disabled={busy || !name.trim()}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 inline-flex items-center gap-2"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Create their link
        </button>
      </div>

      {/* Existing partners */}
      {partners.map((p) => (
        <div key={p.id} className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1.5px solid var(--border)", opacity: p.active ? 1 : 0.55 }}>
          <div className="flex items-center gap-3">
            {p.mediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${p.mediaId}`} alt={p.name} className="rounded-full object-cover flex-shrink-0"
                style={{ width: 48, height: 48, border: "2px solid var(--purple)" }} />
            ) : (
              <div className="rounded-full grid place-items-center flex-shrink-0 font-serif text-lg"
                style={{ width: 48, height: 48, background: "var(--surface2)", color: "var(--purple)", border: "2px solid var(--purple)" }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold" style={{ color: "var(--text)" }}>{p.name}</p>
              <p className="text-xs" style={{ color: "var(--text-light)" }}>
                {p.role === "quizmaster" ? "Quizzes you" : "Checks on you"}
                {p.lastSeenAt ? ` · last opened ${new Date(p.lastSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · not opened yet"}
              </p>
            </div>
            <button onClick={() => copy(p.token, p.id)} className="p-2 rounded-lg" title="Copy their link"
              style={{ color: copied === p.id ? "var(--green)" : "var(--text-muted)" }}>
              {copied === p.id ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button onClick={() => patch(p.id, { rotate: true })} className="p-2 rounded-lg" title="New link — the old one stops working"
              style={{ color: "var(--text-muted)" }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={() => remove(p.id)} className="p-2 rounded-lg" title="Remove"
              style={{ color: "var(--text-muted)" }}>
              <Trash2 size={15} />
            </button>
          </div>

          {/* Visible so she can check the link before sending it. */}
          <p className="text-[11px] mt-2 break-all font-mono" style={{ color: "var(--text-light)" }}>
            {shareOrigin()}/partner/{p.token}
          </p>

          {p.role === "quizmaster" && (
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={p.seeScores}
                onChange={(e) => patch(p.id, { seeScores: e.target.checked })}
                className="w-4 h-4"
                style={{ accentColor: "var(--purple)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Let them see what you&apos;ve been getting wrong
              </span>
            </label>
          )}
        </div>
      ))}

      {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}

      <p className="text-xs leading-relaxed" style={{ color: "var(--text-light)" }}>
        Their link only opens the study screen. Your finances, credit, therapy, felt-safety
        and schedule aren&apos;t hidden from it — they aren&apos;t reachable from it at all.
      </p>
    </div>
  );
}
