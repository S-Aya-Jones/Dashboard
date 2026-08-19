"use client";

import { useState } from "react";
import { X, Camera, Scale } from "lucide-react";
import { SeventyFiveHardData } from "@/types/dashboard";

interface PhotoGalleryProps {
  hardData: SeventyFiveHardData;
}

interface LogWithPhotos {
  date: string;
  progressPhotoUrl?: string;
  weightPhotoUrl?: string;
}

export function PhotoGallery({ hardData }: PhotoGalleryProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const logsWithPhotos = (hardData.logs as LogWithPhotos[])
    .filter(l => l.progressPhotoUrl || l.weightPhotoUrl)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (logsWithPhotos.length === 0) return null;

  return (
    <>
      <div className="mt-6">
        <h2 className="font-semibold text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Photo Timeline
        </h2>
        <div className="space-y-3">
          {logsWithPhotos.map(log => (
            <div key={log.date} className="rounded-2xl p-3" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                {new Date(log.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex gap-2">
                {log.progressPhotoUrl && (
                  <button onClick={() => setLightbox(log.progressPhotoUrl!)} className="relative group">
                    <img src={log.progressPhotoUrl} alt="Progress"
                      className="w-24 h-32 object-cover rounded-xl transition-all group-hover:opacity-90" />
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      <Camera size={10} color="#fff" />
                      <span className="text-[10px] text-white font-medium">Progress</span>
                    </div>
                  </button>
                )}
                {log.weightPhotoUrl && (
                  <button onClick={() => setLightbox(log.weightPhotoUrl!)} className="relative group">
                    <img src={log.weightPhotoUrl} alt="Scale"
                      className="w-24 h-32 object-cover rounded-xl transition-all group-hover:opacity-90" />
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      <Scale size={10} color="#fff" />
                      <span className="text-[10px] text-white font-medium">Weight</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <X size={20} color="#fff" />
          </button>
          <img src={lightbox} alt="Photo" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}
