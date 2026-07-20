"use client";

import { useState } from "react";
import { Loader } from "lucide-react";
import { DashboardData, BodyScanPhoto } from "@/types/dashboard";
import { PhotoCapture } from "@/components/PhotoCapture";
import { PhotoGallery } from "@/components/PhotoGallery";
import { BodyScanChat } from "@/components/BodyScanChat";
import { ProgressComparison } from "@/components/ProgressComparison";
import { id } from "@/lib/utils";
import { format } from "date-fns";

interface AnalysisData {
  bodyType: string;
  visualAssessment: string;
  bodyFatEstimate: {
    low: number;
    high: number;
    category: string;
    note: string;
  };
  muscleDefinition: number;
  compositionScore: number;
  potentialScore: number;
  visibleMuscle: Array<{ group: string; development: string; note: string }>;
  posture: string;
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

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function BodyScanView({ data, update }: Props) {
  const [selectedAngle, setSelectedAngle] = useState<"front" | "back" | "left" | "right" | "all">("front");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [comparisonPhotos, setComparisonPhotos] = useState<{ before: BodyScanPhoto; after: BodyScanPhoto } | null>(null);

  const w = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [], bodyScanPhotos: [] };
  const bodyScanPhotos = w.bodyScanPhotos ?? [];

  const handlePhotoCapture = async (photoData: string) => {
    if (!height) {
      alert("Please enter your height first");
      return;
    }

    const photoId = id();
    const newPhoto: BodyScanPhoto = {
      id: photoId,
      date: format(new Date(), "yyyy-MM-dd"),
      timestamp: new Date().toISOString(),
      angle: selectedAngle,
      photoData,
      height: parseFloat(height),
      weight: weight ? parseFloat(weight) : undefined,
    };

    // Store the photo (without analysis yet)
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

    // Analyze the photo
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/body/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [
            {
              imageBase64: photoData.split(",")[1] || photoData,
              mimeType: "image/jpeg",
              label: selectedAngle === "all" ? "Multiple angles" : selectedAngle.charAt(0).toUpperCase() + selectedAngle.slice(1),
            },
          ],
          height: parseFloat(height),
          weight: weight ? parseFloat(weight) : undefined,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      const analysis = data.analysis;

      setAnalysisResult(analysis);
      setShowChat(true);

      // Update photo with analysis data
      update((d) => {
        const wd = d.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        const photos = (wd.bodyScanPhotos ?? []).map((p) =>
          p.id === photoId
            ? {
                ...p,
                analysis: {
                  bodyFat: analysis.bodyFatEstimate,
                  compositionScore: analysis.compositionScore,
                  potentialScore: analysis.potentialScore,
                  honestAssessment: analysis.honestAssessment,
                  strengths: analysis.strengths,
                  areas: analysis.areas,
                  roadmap: analysis.roadmap,
                },
              }
            : p
        );
        return {
          ...d,
          workout: { ...wd, bodyScanPhotos: photos },
        };
      });
    } catch (e) {
      console.error("Analysis error:", e);
      alert("Could not analyze photo. Try again.");
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleViewAnalysis = (photo: BodyScanPhoto) => {
    if (photo.analysis) {
      // Reconstruct analysis data from stored photo analysis
      const reconstructedAnalysis: AnalysisData = {
        bodyType: "Mixed",
        visualAssessment: "",
        bodyFatEstimate: {
          low: photo.analysis.bodyFat.low,
          high: photo.analysis.bodyFat.high,
          category: photo.analysis.bodyFat.category || "Average",
          note: photo.analysis.bodyFat.note || "Based on visual assessment",
        },
        muscleDefinition: 5,
        compositionScore: photo.analysis.compositionScore,
        potentialScore: photo.analysis.potentialScore || 8,
        visibleMuscle: [],
        posture: "Neutral",
        strengths: photo.analysis.strengths || [],
        areas: photo.analysis.areas || [],
        honestAssessment: photo.analysis.honestAssessment || "Analysis available",
        protocol: { training: [], diet: [], recovery: [] },
        roadmap: {
          thirtyDay: photo.analysis.roadmap?.thirtyDay || { focus: "Progress review", expectedChange: "See gallery for changes", actions: [] },
          ninetyDay: photo.analysis.roadmap?.ninetyDay || { focus: "Progress review", expectedChange: "See gallery for changes", actions: [] },
          sixMonth: photo.analysis.roadmap?.sixMonth || { focus: "Progress review", expectedChange: "See gallery for changes", actions: [] },
        },
      };
      setAnalysisResult(reconstructedAnalysis);
      setShowChat(true);
    }
  };

  const handleCompare = (photo1: BodyScanPhoto, photo2: BodyScanPhoto) => {
    // Ensure photo1 is before photo2
    const before = new Date(photo1.timestamp) < new Date(photo2.timestamp) ? photo1 : photo2;
    const after = new Date(photo1.timestamp) < new Date(photo2.timestamp) ? photo2 : photo1;
    setComparisonPhotos({ before, after });
  };

  return (
    <>
      <div className="h-full overflow-y-auto no-scrollbar">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-5">
          {/* Capture section */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>📸 Body Scan Analysis</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Height-based AI feedback on your body composition</p>
            </div>

            {/* Height & Weight inputs */}
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Your measurements</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Height (inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 68"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      padding: "0.5rem",
                      color: "var(--text)",
                      fontSize: "0.875rem",
                      marginTop: "0.25rem",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Weight (lbs) - optional</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g., 155"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      padding: "0.5rem",
                      color: "var(--text)",
                      fontSize: "0.875rem",
                      marginTop: "0.25rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
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
            <div className="relative">
              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <div className="flex flex-col items-center gap-2">
                    <Loader size={32} className="animate-spin" style={{ color: "#7C5CFC" }} />
                    <p className="text-sm font-semibold text-white">Analyzing your body composition...</p>
                  </div>
                </div>
              )}
              <PhotoCapture
                onPhotoCapture={handlePhotoCapture}
                label={`${selectedAngle === "all" ? "Multiple angles" : selectedAngle.charAt(0).toUpperCase() + selectedAngle.slice(1)} angle photo`}
                maxSizeMB={10}
              />
            </div>

            {/* Info box */}
            <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(124,92,252,0.05)" }}>
              <p style={{ color: "var(--text-muted)" }}>
                📊 AI Coach will analyze your body composition, provide honest feedback, and give you a personalized roadmap for 30, 90, and 180 days.
              </p>
            </div>
          </div>

          {/* Photo gallery */}
          <PhotoGallery photos={bodyScanPhotos} type="bodyscan" onDelete={handleDelete} onViewAnalysis={handleViewAnalysis} onCompare={handleCompare} />
        </div>
      </div>

      {/* Chat with AI Coach */}
      {showChat && analysisResult && <BodyScanChat analysis={analysisResult} onClose={() => setShowChat(false)} />}

      {/* Progress comparison */}
      {comparisonPhotos && <ProgressComparison before={comparisonPhotos.before} after={comparisonPhotos.after} onClose={() => setComparisonPhotos(null)} />}
    </>
  );
}
