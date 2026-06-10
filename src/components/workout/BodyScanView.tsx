"use client";

import { useState } from "react";
import { DashboardData, BodyScanPhoto } from "@/types/dashboard";
import { PhotoCapture } from "@/components/PhotoCapture";
import { PhotoGallery } from "@/components/PhotoGallery";
import { id } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function BodyScanView({ data, update }: Props) {
  const [selectedAngle, setSelectedAngle] = useState<"front" | "back" | "left" | "right" | "all">("front");

  const w = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [], bodyScanPhotos: [] };
  const bodyScanPhotos = w.bodyScanPhotos ?? [];

  const handlePhotoCapture = (photoData: string) => {
    const newPhoto: BodyScanPhoto = {
      id: id(),
      date: format(new Date(), "yyyy-MM-dd"),
      timestamp: new Date().toISOString(),
      angle: selectedAngle,
      photoData,
    };

    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return {
        ...d,
        workout: {
          ...wd,
          bodyScanPhotos: [...(wd.bodyScanPhotos ?? []), newPhoto],
        },
      };
    });
  };

  const handleDelete = (photoId: string) => {
    update((d) => {
      const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      return {
        ...d,
        workout: {
          ...wd,
          bodyScanPhotos: (wd.bodyScanPhotos ?? []).filter((p) => p.id !== photoId),
        },
      };
    });
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-5">
        {/* Capture section */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>📸 Body Scan Photos</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Track your progress with weekly body scans</p>
        </div>

        {/* Angle selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Select angle</p>
          <div className="grid grid-cols-5 gap-2">
            {(["front", "back", "left", "right", "all"] as const).map((angle) => (
              <button
                key={angle}
                onClick={() => setSelectedAngle(angle)}
                className="py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: selectedAngle === angle ? "#7C5CFC" : "var(--bg2)",
                  color: selectedAngle === angle ? "#fff" : "var(--text-muted)",
                  border: selectedAngle === angle ? "none" : "1px solid var(--border)",
                }}>
                {angle === "all" ? "360°" : angle.charAt(0).toUpperCase() + angle.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Photo capture */}
        <PhotoCapture
          onPhotoCapture={handlePhotoCapture}
          label={`${selectedAngle === "all" ? "Multiple angles" : selectedAngle.charAt(0).toUpperCase() + selectedAngle.slice(1)} angle photo`}
          maxSizeMB={10}
        />
      </div>

        {/* Photo gallery */}
        <PhotoGallery photos={bodyScanPhotos} type="bodyscan" onDelete={handleDelete} />
      </div>
    </div>
  );
}
