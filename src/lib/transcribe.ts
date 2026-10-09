import { getAppKey } from "@/lib/appkeys";

// Two supported transcription providers, auto-detected from the key format:
//   sk-…   → OpenAI Whisper      (sync, api.openai.com)
//   wai_…  → whisper-api.com     (async job + polling, api.whisper-api.com)
// Both run the same underlying Whisper model.

export type Provider = "openai" | "whisperapi";

export function detectProvider(key: string): Provider {
  return key.startsWith("wai_") ? "whisperapi" : "openai";
}

export async function getTranscriptionKey(): Promise<string | null> {
  return getAppKey("TRANSCRIPTION_API_KEY") ?? null;
}

async function transcribeOpenAI(key: string, audio: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.text()).trim();
}

async function transcribeWhisperApi(key: string, audio: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), filename);

  const res = await fetch("https://api.whisper-api.com/transcribe", {
    method: "POST",
    headers: { "X-API-Key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper-api ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const job = await res.json();
  if (job.status === "completed" && job.result) return String(job.result).trim();

  const taskId = job.task_id;
  if (!taskId) throw new Error("whisper-api returned no task_id");

  // Poll until done — a 5-minute chunk typically finishes well inside this
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await fetch(`https://api.whisper-api.com/status/${taskId}`, {
      headers: { "X-API-Key": key },
    });
    if (!poll.ok) continue;
    const data = await poll.json();
    if (data.status === "completed" && data.result) return String(data.result).trim();
    if (data.status === "failed" || data.status === "error") {
      throw new Error(`whisper-api job failed: ${JSON.stringify(data).slice(0, 200)}`);
    }
  }
  throw new Error("whisper-api transcription timed out");
}

export async function transcribeAudio(key: string, audio: Uint8Array, filename: string): Promise<string> {
  return detectProvider(key) === "whisperapi"
    ? transcribeWhisperApi(key, audio, filename)
    : transcribeOpenAI(key, audio, filename);
}

// Validate a key at save time so a bad paste fails immediately
export async function verifyKey(key: string): Promise<{ ok: boolean; provider: Provider; error?: string }> {
  const provider = detectProvider(key);
  try {
    if (provider === "whisperapi") {
      const res = await fetch("https://api.whisper-api.com/me", { headers: { "X-API-Key": key } });
      return res.ok
        ? { ok: true, provider }
        : { ok: false, provider, error: `whisper-api.com rejected that key (${res.status}).` };
    }
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    return res.ok
      ? { ok: true, provider }
      : { ok: false, provider, error: `OpenAI rejected that key (${res.status}). Check it copied fully and has credit.` };
  } catch (e) {
    return { ok: false, provider, error: String(e).slice(0, 200) };
  }
}
