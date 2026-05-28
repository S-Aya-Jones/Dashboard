"use client";

import { useState, useRef } from "react";
import { X, Camera, Link as LinkIcon } from "lucide-react";
import { ShetritionImage, NutritionData } from "@/types/dashboard";

export function ShetritionBoard({
  nutrition,
  onUpdate,
}: {
  nutrition: NutritionData;
  onUpdate: (n: NutritionData) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [caption, setCaption]   = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const { url } = await res.json();
        if (url) addImage(url);
      } catch {}
    }
    setUploading(false);
  }

  function addImage(src: string) {
    const img: ShetritionImage = {
      id: crypto.randomUUID(),
      src,
      caption: caption.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    onUpdate({ ...nutrition, shetritionImages: [img, ...nutrition.shetritionImages] });
    setCaption("");
    setUrlInput("");
  }

  function addUrl() {
    const u = urlInput.trim();
    if (u) addImage(u);
  }

  function updateCaption(id: string, text: string) {
    onUpdate({
      ...nutrition,
      shetritionImages: nutrition.shetritionImages.map((img) =>
        img.id === id ? { ...img, caption: text || undefined } : img
      ),
    });
  }

  function remove(id: string) {
    onUpdate({ ...nutrition, shetritionImages: nutrition.shetritionImages.filter((img) => img.id !== id) });
  }

  const inputStyle = {
    background: "#1C1C1C",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#FFFFFF",
    padding: "8px 12px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      {/* Upload controls */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: "#141414", border: "1px solid rgba(201,183,156,0.4)" }}
      >
        <h3 className="font-serif text-lg mb-3" style={{ color: "#FFFFFF", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Add Inspiration
        </h3>
        <div className="space-y-3">
          <input
            style={inputStyle}
            placeholder="Caption (optional)…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              style={{ ...inputStyle, fontSize: "13px", padding: "7px 12px" }}
              placeholder="Paste image URL…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
            />
            <button
              type="button"
              onClick={addUrl}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: "rgba(113,129,109,0.12)", color: "#71816D" }}
            >
              <LinkIcon size={14} /> Add URL
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white w-full justify-center"
            style={{ background: "#71816D" }}
          >
            <Camera size={15} />
            {uploading ? "Uploading…" : "Upload Screenshot or Photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFile(e.target.files)}
          />
        </div>
      </div>

      {nutrition.shetritionImages.length === 0 ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.35)" }}>
          <p className="font-serif text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Your board is blank
          </p>
          <p className="text-sm">Upload diet plans, macros screenshots, or nutrition inspiration.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {nutrition.shetritionImages.map((img) => (
            <div key={img.id} className="break-inside-avoid mb-4 group">
              <div
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: "#141414",
                  border: "1px solid rgba(201,183,156,0.35)",
                  boxShadow: "0 3px 14px rgba(52,42,33,0.09)",
                }}
              >
                <div className="relative">
                  <img src={img.src} alt={img.caption ?? ""} className="w-full object-cover" />
                  <button
                    onClick={() => remove(img.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    style={{ background: "rgba(52,42,33,0.65)" }}
                  >
                    <X size={12} color="white" />
                  </button>
                </div>
                <div className="px-3 py-2">
                  <input
                    className="w-full text-xs bg-transparent border-none outline-none italic"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    placeholder="Add a caption…"
                    defaultValue={img.caption ?? ""}
                    onBlur={(e) => updateCaption(img.id, e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
