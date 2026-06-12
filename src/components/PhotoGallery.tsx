"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Download, MessageSquare } from "lucide-react";
import { BodyScanPhoto, FormCheckPhoto } from "@/types/dashboard";
import { format, parseISO } from "date-fns";

type Photo = BodyScanPhoto | FormCheckPhoto;

interface Props {
  photos: Photo[];
  type: "bodyscan" | "formcheck";
  onDelete: (id: string) => void;
  onViewAnalysis?: (photo: BodyScanPhoto) => void;
  onCompare?: (photo1: BodyScanPhoto, photo2: BodyScanPhoto) => void;
}

const isBodyScanPhoto = (p: Photo): p is BodyScanPhoto => "angle" in p;

export function PhotoGallery({ photos, type, onDelete, onViewAnalysis, onCompare }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string | null>(null);

  if (photos.length === 0) return null;

  const sorted = [...photos].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const selected = sorted.find((p) => p.id === selectedId);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid rgba(124,92,252,0.15)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left border-b"
        style={{ borderColor: "rgba(124,92,252,0.1)" }}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {type === "bodyscan" ? "📸 Body Scan History" : "📹 Form Check History"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {photos.length} photo{photos.length > 1 ? "s" : ""} saved
            {compareMode && selectedForComparison ? " • Select 2 to compare" : ""}
          </p>
        </div>
        {type === "bodyscan" && photos.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (compareMode) {
                setCompareMode(false);
                setSelectedForComparison(null);
              } else {
                setCompareMode(true);
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold mr-2 active:scale-90 transition-transform"
            style={{
              background: compareMode ? "#7C5CFC" : "rgba(124,92,252,0.1)",
              color: compareMode ? "#fff" : "#7C5CFC",
            }}>
            📊 Compare
          </button>
        )}
        {expanded ? <ChevronUp size={18} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={18} style={{ color: "var(--text-muted)" }} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Timeline grid */}
          <div className="grid grid-cols-3 gap-2">
            {sorted.map((photo) => {
              const isSelected = selectedId === photo.id;
              const isCompareSelected = selectedForComparison === photo.id;
              return (
                <button
                  key={photo.id}
                  onClick={() => {
                    if (compareMode && isBodyScanPhoto(photo)) {
                      const newSelection = isCompareSelected ? null : photo.id;
                      setSelectedForComparison(newSelection);

                      // Check if we have two photos selected for comparison
                      if (selectedForComparison && newSelection && selectedForComparison !== newSelection) {
                        const photo1 = sorted.find((p) => p.id === selectedForComparison) as BodyScanPhoto;
                        const photo2 = photo as BodyScanPhoto;
                        if (onCompare && photo1.analysis && photo2.analysis) {
                          onCompare(photo1, photo2);
                        }
                      }
                    } else {
                      setSelectedId(isSelected ? null : photo.id);
                    }
                  }}
                  className="rounded-lg overflow-hidden relative group active:scale-95 transition-transform"
                  style={{
                    aspectRatio: "1",
                    border: compareMode && isCompareSelected ? "3px solid #7C5CFC" : isSelected ? "2px solid #7C5CFC" : "1px solid rgba(124,92,252,0.2)",
                    opacity: compareMode && selectedForComparison && !isCompareSelected && selectedForComparison !== photo.id ? 0.5 : 1,
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.photoData}
                    alt={`${type} ${format(parseISO(photo.timestamp), "MMM dd, yyyy")}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Date label */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <p className="text-xs text-white font-semibold">{format(parseISO(photo.timestamp), "MMM d")}</p>
                  </div>
                  {compareMode && isCompareSelected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(124,92,252,0.2)" }}>
                      <p className="text-xl font-bold text-white">✓</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected photo details */}
          {selected && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(124,92,252,0.05)" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {format(parseISO(selected.timestamp), "EEEE, MMMM dd, yyyy · h:mm a")}
                </p>
                <button
                  onClick={() => onDelete(selected.id)}
                  className="p-1 rounded-lg active:scale-90 transition-transform"
                  style={{ color: "#DA667B", background: "rgba(218,102,123,0.1)" }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {isBodyScanPhoto(selected) && (
                <>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Angle: <span className="font-semibold" style={{ color: "var(--text)" }}>{selected.angle === "all" ? "Multiple" : selected.angle}</span>
                  </p>
                  {selected.analysis ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2" style={{ background: "rgba(124,92,252,0.1)" }}>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Body Fat</p>
                          <p className="text-xs font-bold" style={{ color: "#7C5CFC" }}>
                            {selected.analysis.bodyFat.low}–{selected.analysis.bodyFat.high}%
                          </p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: "rgba(124,92,252,0.1)" }}>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Score</p>
                          <p className="text-xs font-bold" style={{ color: "#7C5CFC" }}>
                            {selected.analysis.compositionScore}/10
                          </p>
                          {selected.analysis.potentialScore && (
                            <p className="text-[9px]" style={{ color: "var(--text-light)" }}>
                              (Potential: {selected.analysis.potentialScore}/10)
                            </p>
                          )}
                        </div>
                      </div>
                      {selected.analysis.honestAssessment && (
                        <div className="rounded-lg p-2" style={{ background: "rgba(218,102,123,0.08)" }}>
                          <p className="text-[10px] font-semibold" style={{ color: "#DA667B" }}>Assessment</p>
                          <p className="text-xs mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>
                            {selected.analysis.honestAssessment.substring(0, 120)}...
                          </p>
                        </div>
                      )}
                      {onViewAnalysis && (
                        <button
                          onClick={() => onViewAnalysis(selected as BodyScanPhoto)}
                          className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                          style={{ background: "rgba(124,92,252,0.15)", color: "#7C5CFC" }}>
                          <MessageSquare size={12} />
                          View Full Analysis & Chat
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-light)" }}>
                      (Analysis pending - check back later)
                    </p>
                  )}
                </>
              )}

              {!isBodyScanPhoto(selected) && (
                <>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Exercise: <span className="font-semibold" style={{ color: "var(--text)" }}>{selected.exerciseName}</span>
                  </p>
                  {selected.formScore !== undefined && (
                    <div className="rounded-lg p-2" style={{ background: "rgba(124,92,252,0.1)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Form Score</p>
                      <p className="text-xs font-bold" style={{ color: "#7C5CFC" }}>
                        {selected.formScore}/100
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Download button */}
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = selected.photoData;
                  link.download = `photo-${selected.id}.jpg`;
                  link.click();
                }}
                className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                style={{ background: "rgba(124,92,252,0.08)", color: "#7C5CFC" }}>
                <Download size={12} />
                Download
              </button>
            </div>
          )}

          {/* Progress note */}
          {sorted.length > 1 && (
            <div className="rounded-lg p-3 text-xs text-center" style={{ background: "rgba(218,102,123,0.08)", color: "#DA667B" }}>
              📊 {sorted.length} photos span {Math.round((parseISO(sorted[0].timestamp).getTime() - parseISO(sorted[sorted.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          )}
        </div>
      )}
    </div>
  );
}
