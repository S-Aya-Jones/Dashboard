"use client";

import { useRef, useState } from "react";
import { PhotoCapture } from "@/components/PhotoCapture";
import { computeFaceMetrics, FaceMetrics } from "@/lib/faceMetrics";
import { RefreshCw, AlertCircle, Loader, ScanFace } from "lucide-react";

const PURPLE = "#9B7FFF";
const GOLD = "#E8C547";
const PEACH = "#E8A87C";
const ROSE = "#DA667B";

function Metric({ label, value, sub, color = PURPLE }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(124,92,252,0.06)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function ResultView({ metrics, photo, onReset }: { metrics: FaceMetrics; photo: string; onReset: () => void }) {
  const symColor = metrics.symmetryScore >= 90 ? GOLD : metrics.symmetryScore >= 75 ? PURPLE : PEACH;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
      <div className="p-4 flex gap-4" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <img src={photo} alt="Analyzed face" className="w-20 h-24 rounded-xl object-cover flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>FACE GEOMETRY SCAN</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold" style={{ color: symColor }}>{metrics.symmetryScore}<span className="text-sm font-normal">/100</span></p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>symmetry</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{metrics.symmetryNote}</p>
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>FACIAL THIRDS</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Classic ideal splits the face evenly into forehead / mid-face / lower face. {metrics.facialThirds.mostEven ? "Yours is close to an even split." : "Yours has some unevenness between the three — totally normal."}</p>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Upper" value={`${metrics.facialThirds.upper}%`} color={GOLD} />
          <Metric label="Middle" value={`${metrics.facialThirds.middle}%`} color={PURPLE} />
          <Metric label="Lower" value={`${metrics.facialThirds.lower}%`} color={PEACH} />
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>EYES</p>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Eye spacing ratio" value={metrics.eyes.interocularRatio.toFixed(2)} sub="~1.0 = one eye-width apart" />
          <Metric label="Left canthal tilt" value={`${metrics.eyes.leftCanthalTiltDeg}°`} color={PEACH} />
          <Metric label="Right canthal tilt" value={`${metrics.eyes.rightCanthalTiltDeg}°`} color={PEACH} />
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>JAW</p>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Jaw-to-face width" value={metrics.jaw.jawWidthToFaceWidthRatio.toFixed(2)} color={ROSE} />
          <Metric label="Jaw angle" value={`${metrics.jaw.jawAngleDeg}°`} color={ROSE} />
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ borderBottom: "1px solid rgba(124,92,252,0.1)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>PROPORTIONS</p>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Width : height" value={metrics.proportions.faceWidthToHeightRatio.toFixed(2)} />
          <Metric label="vs. golden ratio" value={`${metrics.proportions.goldenRatioDeviationPct}% off`} sub="1.618 height:width is the classic neoclassical ideal — not a fact about beauty" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(124,92,252,0.04)", color: "var(--text-muted)" }}>
          These are direct geometric measurements from your photo&apos;s facial landmarks — real numbers, not an attractiveness score.
          There&apos;s no scientifically valid way to turn face geometry into a single &quot;attractiveness rating&quot; or to predict who
          finds a face attractive, so this won&apos;t pretend to offer one.
        </div>
        <button onClick={onReset} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(124,92,252,0.08)", color: "var(--text-muted)" }}>
          <RefreshCw size={14} /> New Scan
        </button>
      </div>
    </div>
  );
}

export default function FaceAnalysisPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FaceMetrics | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").FaceLandmarker | null>(null);

  const analyze = async (photoData: string) => {
    setPhoto(photoData);
    setError(null);
    setAnalyzing(true);
    setMetrics(null);
    try {
      if (!landmarkerRef.current) {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      }

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load the photo."));
        img.src = photoData;
      });

      const result = landmarkerRef.current.detect(img);
      if (!result.faceLandmarks?.length) {
        setError("No face detected — try a clear, front-facing, well-lit photo.");
        setAnalyzing(false);
        return;
      }

      const metrics = computeFaceMetrics(result.faceLandmarks[0]);
      setMetrics(metrics);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Face analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setMetrics(null);
    setError(null);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex items-center gap-2 mb-1">
            <ScanFace size={22} style={{ color: PURPLE }} />
            <h1 className="font-serif text-2xl" style={{ color: "var(--text)" }}>Face Analysis</h1>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Real, landmark-based facial geometry — symmetry, facial thirds, eye spacing, jaw proportions.
            No attractiveness score, no percentile, no demographic guesses — those aren&apos;t real measurements.
          </p>

          {metrics && photo ? (
            <ResultView metrics={metrics} photo={photo} onReset={reset} />
          ) : analyzing ? (
            <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
              <Loader size={22} className="animate-spin" style={{ color: PURPLE }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Detecting facial landmarks…</p>
            </div>
          ) : (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-4 text-xs" style={{ background: "rgba(218,102,123,0.08)", color: ROSE }}>
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Use a clear, front-facing, well-lit photo for the most accurate measurements.
              </p>
              <PhotoCapture onPhotoCapture={analyze} label="Capture or Upload Face Photo" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
