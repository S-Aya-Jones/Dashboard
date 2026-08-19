"use client";

// The client half of the coach's voice.
//
// The old code asked /api/tts and, on any failure, dropped straight to
// `new SpeechSynthesisUtterance(text)` with no voice chosen — which on most
// devices is the flat default. That is the robotic voice.
//
// This does three things differently: it remembers whether a real voice
// exists so it stops asking after the first failure, it caches every clip so
// a repeated cue costs nothing, and when it genuinely has to use the system
// voice it picks the best one on the device rather than the first one.

type Style = "cue" | "rest" | "count";

const cache = new Map<string, string>();
let realVoice: boolean | null = null;     // null = not yet known
let current: HTMLAudioElement | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
  if (v) stopSpeaking();
}

export function isMuted() {
  return muted;
}

export function stopSpeaking() {
  if (current) {
    current.pause();
    current = null;
  }
  try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ }
}

/** Whether a real (non-system) voice is available. */
export async function hasRealVoice(): Promise<boolean> {
  if (realVoice !== null) return realVoice;
  try {
    const res = await fetch("/api/tts", { cache: "no-store" });
    const data = await res.json();
    realVoice = Boolean(data.real);
  } catch {
    realVoice = false;
  }
  return realVoice;
}

// iOS and macOS ship genuinely good voices, but they are never the default.
// Anything labelled Enhanced or Premium is the neural one.
const PREFERRED = [
  "Samantha", "Ava", "Allison", "Susan", "Zoe",
  "Google US English", "Microsoft Aria", "Microsoft Jenny",
];

function systemVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;

  const enhanced = pool.find((v) => /enhanced|premium|neural/i.test(v.name));
  if (enhanced) return enhanced;

  for (const name of PREFERRED) {
    const hit = pool.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return pool.find((v) => v.localService) ?? pool[0];
}

function speakSystem(text: string, style: Style) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = systemVoice();
    if (v) u.voice = v;
    u.rate = style === "rest" ? 0.94 : 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch { /* blocked */ }
}

/** Say a line out loud. Silent when muted. */
export async function say(text: string, style: Style = "cue"): Promise<void> {
  if (muted || typeof window === "undefined" || !text.trim()) return;

  const key = `${style}:${text}`;
  const cached = cache.get(key);
  if (cached) {
    stopSpeaking();
    current = new Audio(cached);
    current.play().catch(() => {});
    return;
  }

  if (await hasRealVoice()) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style }),
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        cache.set(key, url);
        stopSpeaking();
        current = new Audio(url);
        current.play().catch(() => {});
        return;
      }
      // 503 means no voice is configured — stop asking for the rest of the session.
      if (res.status === 503) realVoice = false;
    } catch { /* fall through */ }
  }

  speakSystem(text, style);
}

/**
 * Fetch a clip ahead of time so it plays the instant it's needed. Used for
 * the next exercise's cue while the current set is still running.
 */
export async function prewarm(text: string, style: Style = "cue"): Promise<void> {
  if (muted || !text.trim()) return;
  const key = `${style}:${text}`;
  if (cache.has(key)) return;
  if (!(await hasRealVoice())) return;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, style }),
    });
    if (res.ok) cache.set(key, URL.createObjectURL(await res.blob()));
  } catch { /* not important enough to surface */ }
}

// Some browsers populate the voice list asynchronously; nudging it early
// means the first cue already has a good voice to pick from.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

/** A short rising tone. Used for set start and rest-over. */
export function tone(freq = 880, dur = 0.3) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(muted ? 0 : 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch { /* blocked */ }
}
