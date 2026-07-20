"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";

interface Props {
  onPhotoCapture: (photoData: string) => void;
  label?: string;
  maxSizeMB?: number;
}

export function PhotoCapture({ onPhotoCapture, label = "Capture Photo", maxSizeMB = 5 }: Props) {
  const [mode, setMode] = useState<"none" | "camera" | "upload">("none");
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setMode("camera");
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Camera access denied. Try uploading a photo instead.");
    }
  };

  // Capture frame from camera
  const captureFromCamera = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      const photoData = canvasRef.current.toDataURL("image/jpeg", 0.9);
      setPreview(photoData);
      stopCamera();
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      setMode("none");
    }
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File too large. Max ${maxSizeMB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoData = e.target?.result as string;
      setPreview(photoData);
      setMode("none");
    };
    reader.readAsDataURL(file);
  };

  // Submit photo
  const submitPhoto = async () => {
    if (!preview) return;
    setIsProcessing(true);
    try {
      onPhotoCapture(preview);
      setPreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel
  const cancel = () => {
    if (mode === "camera") stopCamera();
    setPreview(null);
    setMode("none");
  };

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      {mode === "none" && !preview && (
        <div className="flex gap-2">
          <button
            onClick={startCamera}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: "#7C5CFC", color: "#fff" }}>
            <Camera size={16} />
            Camera
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: "rgba(124,92,252,0.08)", color: "#7C5CFC", border: "1px solid rgba(124,92,252,0.2)" }}>
            <Upload size={16} />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
        </div>
      )}

      {/* Camera view */}
      {mode === "camera" && (
        <div className="space-y-2">
          <div className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={captureFromCamera}
              className="flex-1 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ background: "#7C5CFC", color: "#fff" }}>
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-3 rounded-xl active:scale-95 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-2">
          <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: 300 }}>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{label}</p>
          <div className="flex gap-2">
            <button
              onClick={submitPhoto}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              style={{ background: "#7C5CFC", color: "#fff", opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? "Processing..." : "Use This Photo"}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-3 rounded-xl active:scale-95 transition-transform"
              style={{ background: "var(--surface2)", color: "var(--text)" }}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
