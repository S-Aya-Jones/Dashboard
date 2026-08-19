"use client";

import { useRef, useState } from "react";
import { Camera, Scale, Upload, Check, Loader2, X } from "lucide-react";

interface PhotoUploadProps {
  type: "progress" | "weight";
  onSuccess?: (url: string, weight?: number) => void;
}

export function PhotoUpload({ type, onSuccess }: PhotoUploadProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isWeight = type === "weight";
  const color = isWeight ? "#38BDF8" : "#F472B6";
  const Icon = isWeight ? Scale : Camera;
  const label = isWeight ? "Weight Photo" : "Progress Photo";

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setStatus("uploading");

    const form = new FormData();
    form.append("photo", file);
    form.append("type", type);

    try {
      const res = await fetch("/api/photos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.message);
      setStatus("done");
      onSuccess?.(data.url, data.extractedWeight);
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setStatus("idle");
    setPreview(null);
    setResult("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      border: `1.5px solid ${color}30`,
      background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
    }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {status === "idle" && (
        <button onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-3 p-4 transition-all"
          style={{ color: "var(--text)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
            <Icon size={18} color={color} />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isWeight ? "Tap to photograph your scale" : "Tap to take today's photo"}
            </div>
          </div>
          <Upload size={16} color={color} />
        </button>
      )}

      {status === "uploading" && (
        <div className="flex items-center gap-3 p-4">
          {preview && (
            <img src={preview} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
          )}
          <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={16} className="animate-spin" color={color} />
            <span className="text-sm">{isWeight ? "Reading scale..." : "Uploading..."}</span>
          </div>
        </div>
      )}

      {(status === "done" || status === "error") && (
        <div className="flex items-center gap-3 p-4">
          {preview && (
            <img src={preview} alt="preview" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {status === "done"
                ? <Check size={14} color="#10B981" />
                : <X size={14} color="#EF4444" />}
              <span className="text-xs font-semibold" style={{ color: status === "done" ? "#10B981" : "#EF4444" }}>
                {status === "done" ? "Saved!" : "Error"}
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{result}</p>
          </div>
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-xl font-medium flex-shrink-0"
            style={{ background: `${color}20`, color }}>
            Retake
          </button>
        </div>
      )}
    </div>
  );
}
