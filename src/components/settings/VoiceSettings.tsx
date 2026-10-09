"use client";

import { useEffect, useState } from "react";
import { Volume2, Check, Loader2, ExternalLink } from "lucide-react";
import { say } from "@/lib/coachVoice";

// The coach's voice was labelled "Aya — Custom Voice" while actually being the
// browser's default speech synthesis, because the ElevenLabs env vars were
// never set and every request fell through. This says what is really playing
// and gives one field to fix it.

const SAMPLE = "Drive through your heels and squeeze hard at the top. Two more reps.";

interface Status {
  provider: "elevenlabs" | "openai" | null;
  elevenlabs: { configured: boolean };
  voiceId: { configured: boolean };
  openai: { configured: boolean };
  transcription: { configured: boolean };
}

const LABELS: Record<string, string> = {
  elevenlabs: "ElevenLabs",
  openai: "OpenAI",
};

export function VoiceSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [elevenKey, setElevenKey] = useState("");
  const [voiceId, setVoiceId]     = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = () =>
    fetch("/api/settings/voice", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});

  useEffect(() => { load(); }, []);

  async function save(body: Record<string, string>) {
    setBusy(true);
    setErr(null);
    try {
      const res  = await fetch("/api/settings/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That key didn't work");
      setOpenaiKey(""); setElevenKey(""); setVoiceId("");
      setOpen(false);
      await load();
      // Reload so the client stops assuming there's no real voice.
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That key didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const real = status.provider !== null;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-serif text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
            <Volume2 size={16} style={{ color: "var(--purple)" }} /> Coaching voice
          </p>
          <p className="text-sm mt-1" style={{ color: real ? "var(--green)" : "var(--red)" }}>
            {real
              ? `${LABELS[status.provider!]} — a real voice`
              : "Your phone's built-in voice — this is the robotic one"}
          </p>
        </div>
        <button
          onClick={() => say(SAMPLE)}
          className="text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          Hear it
        </button>
      </div>

      {!real && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Cues are being read by your phone&apos;s default speech synthesiser, which is
          why it sounds the way it does. An OpenAI key fixes it — the same one the
          lecture transcription uses, if you have that set up. Pennies per session.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-semibold"
          style={{ color: "var(--purple)" }}
        >
          {real ? "Change the voice" : "Set up a real voice"}
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              OpenAI — the easy one
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={status.openai.configured ? "Already set — paste to replace" : "sk-…"}
                className="flex-1"
                style={{ minWidth: 0 }}
              />
              <button
                onClick={() => save({ openaiKey })}
                disabled={busy || !openaiKey.trim()}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 flex-shrink-0 flex items-center gap-2"
                style={{ background: "var(--text)", color: "var(--surface)" }}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : null} Save
              </button>
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold inline-flex items-center gap-1.5 mt-2"
              style={{ color: "var(--purple)" }}
            >
              Get a key <ExternalLink size={11} />
            </a>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              ElevenLabs — if you want to clone a specific voice
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={elevenKey}
                onChange={(e) => setElevenKey(e.target.value)}
                placeholder={status.elevenlabs.configured ? "Already set — paste to replace" : "ElevenLabs API key"}
              />
              <input
                type="text"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder={status.voiceId.configured ? "Already set — paste to replace" : "Voice ID"}
              />
              <button
                onClick={() => save({ elevenKey, voiceId })}
                disabled={busy || !elevenKey.trim() || !voiceId.trim()}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40"
                style={{ background: "var(--text)", color: "var(--surface)" }}
              >
                Save
              </button>
            </div>
          </div>

          {err && <p className="text-xs" style={{ color: "var(--red)" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
