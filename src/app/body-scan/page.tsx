"use client";

import { useState } from "react";
import { PhotoCapture } from "@/components/PhotoCapture";
import { BodyScanChatSidebar } from "@/components/BodyScanChatSidebar";
import { useDashboard } from "@/hooks/useDashboard";
import { BodyScanPhoto } from "@/types/dashboard";
import { ChevronRight, Loader, AlertCircle } from "lucide-react";

type AngleType = "front" | "back" | "left" | "right";

const ANGLES: { key: AngleType; label: string; hint: string }[] = [
  { key: "front", label: "Front", hint: "Face camera, arms relaxed" },
  { key: "back", label: "Back", hint: "Facing away from camera" },
  { key: "left", label: "Left Side", hint: "Turn 90° left" },
  { key: "right", label: "Right Side", hint: "Turn 90° right" },
];

interface PhotoData {
  angle: AngleType;
  imageBase64: string;
  mimeType: string;
}

interface Analysis {
  bodyType: string;
  visualAssessment: string;
  bodyFatEstimate: { low: number; high: number; category: string; note: string };
  muscleDefinition: number;
  compositionScore: number;
  potentialScore: number;
  visibleMuscle: Array<{ group: string; development: string; note: string }>;
  posture?: string;
  strengths: string[];
  areas: string[];
  honestAssessment: string;
  protocol: { training: string[]; diet: string[]; recovery: string[] };
  roadmap: {
    thirtyDay: { focus: string; expectedChange: string; actions: string[] };
    ninetyDay: { focus: string; expectedChange: string; actions: string[] };
    sixMonth: { focus: string; expectedChange: string; actions: string[] };
  };
}

export default function BodyScanPage() {
  const { data, updateData } = useDashboard();
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const currentAngle = ANGLES[currentAngleIndex];
  const photoTaken = photos.some((p) => p.angle === currentAngle.key);

  const handlePhotoCapture = (photoData: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.angle !== currentAngle.key);
      return [
        ...filtered,
        {
          angle: currentAngle.key,
          imageBase64: photoData.split(",")[1] || photoData,
          mimeType: "image/jpeg",
        },
      ];
    });

    // Move to next angle
    if (currentAngleIndex < ANGLES.length - 1) {
      setCurrentAngleIndex(currentAngleIndex + 1);
    }
  };

  const handleAnalyze = async () => {
    if (photos.length === 0) {
      setError("Please capture at least one photo");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/body/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: photos,
          height: height || undefined,
          weight: weight || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze photos");
      }

      const result = await response.json();
      setAnalysis(result.analysis);

      // Save to dashboard
      const scanPhoto: BodyScanPhoto = {
        id: `scan-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        timestamp: new Date().toISOString(),
        angle: "all",
        photoData: photos[0].imageBase64,
        height: height ? parseInt(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        analysis: result.analysis,
      };

      updateData((prev) => ({
        ...prev,
        workout: {
          ...prev.workout,
          bodyScanPhotos: [...(prev.workout.bodyScanPhotos || []), scanPhoto],
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhotos([]);
    setAnalysis(null);
    setCurrentAngleIndex(0);
    setError(null);
  };

  // Show analysis + chatbot
  if (analysis) {
    return (
      <div className="min-h-screen p-4" style={{ background: "var(--bg)" }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <button
              onClick={handleReset}
              className="text-sm font-semibold mb-4"
              style={{ color: "#7C5CFC" }}
            >
              ← New Scan
            </button>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
              Your Body Scan Analysis
            </h1>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {/* Analysis display */}
              <div
                className="rounded-2xl p-6 space-y-4"
                style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}
              >
                {/* Composition Score */}
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
                    Composition Score
                  </p>
                  <div className="flex items-end gap-2">
                    <div
                      className="text-4xl font-bold"
                      style={{
                        color:
                          analysis.compositionScore >= 8
                            ? "#E8C547"
                            : analysis.compositionScore >= 6
                              ? "#9B7FFF"
                              : "#E8A87C",
                      }}
                    >
                      {analysis.compositionScore}
                    </div>
                    <p
                      className="text-sm mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      / 10
                    </p>
                  </div>
                </div>

                {/* Body Fat */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(124,92,252,0.1)" }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                    Estimated Body Fat
                  </p>
                  <p className="text-xl font-bold" style={{ color: "var(--text)" }}>
                    {analysis.bodyFatEstimate.low}–{analysis.bodyFatEstimate.high}%
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {analysis.bodyFatEstimate.category}
                  </p>
                </div>

                {/* Assessment */}
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
                    Assessment
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {analysis.honestAssessment}
                  </p>
                </div>

                {/* 30-Day Roadmap */}
                <div
                  className="p-4 rounded-xl border"
                  style={{ borderColor: "rgba(124,92,252,0.15)" }}
                >
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
                    30-Day Focus
                  </p>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                    {analysis.roadmap.thirtyDay.focus}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "#7C5CFC" }}>
                    Expected: {analysis.roadmap.thirtyDay.expectedChange}
                  </p>
                </div>
              </div>
            </div>

            {/* Chatbot */}
            <div className="lg:col-span-1">
              <BodyScanChatSidebar analysis={analysis} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Photo capture UI
  return (
    <div className="min-h-screen p-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
            Body Scan
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Capture photos from 4 angles for a complete body composition analysis
          </p>
        </div>

        {/* Angle Progress */}
        <div className="space-y-3">
          {ANGLES.map((angle, idx) => (
            <div
              key={angle.key}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                idx === currentAngleIndex
                  ? "border-2"
                  : photoTaken
                    ? "opacity-60"
                    : "opacity-40"
              }`}
              style={{
                background: "var(--surface)",
                borderColor: idx === currentAngleIndex ? "#7C5CFC" : "transparent",
              }}
              onClick={() => setCurrentAngleIndex(idx)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color: "var(--text)" }}>
                    {angle.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {angle.hint}
                  </p>
                </div>
                {photoTaken ? (
                  <div className="text-xl">✓</div>
                ) : (
                  <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Photo Capture */}
        <div>
          <PhotoCapture
            onPhotoCapture={handlePhotoCapture}
            label={`Capture ${currentAngle.label}`}
          />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>
              Height (inches)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>
              Weight (lbs)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface)", color: "var(--text)" }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="p-4 rounded-lg flex gap-3"
            style={{ background: "rgba(218, 102, 123, 0.1)", borderLeft: "3px solid #DA667B" }}
          >
            <AlertCircle size={16} style={{ color: "#DA667B", flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: "#DA667B" }}>
              {error}
            </p>
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={photos.length === 0 || loading}
          className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "#7C5CFC" }}
        >
          {loading ? (
            <>
              <Loader size={16} className="animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              Get Analysis
              <ChevronRight size={16} />
            </>
          )}
        </button>

        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          {photos.length} of {ANGLES.length} photos captured
        </p>
      </div>
    </div>
  );
}
