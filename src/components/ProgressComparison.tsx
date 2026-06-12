"use client";

import { X } from "lucide-react";
import { BodyScanPhoto } from "@/types/dashboard";
import { differenceInDays, parseISO, format } from "date-fns";

interface Props {
  before: BodyScanPhoto;
  after: BodyScanPhoto;
  onClose: () => void;
}

export function ProgressComparison({ before, after, onClose }: Props) {
  const beforeFat = before.analysis?.bodyFat;
  const afterFat = after.analysis?.bodyFat;
  const beforeScore = before.analysis?.compositionScore || 0;
  const afterScore = after.analysis?.compositionScore || 0;

  const daysBetween = differenceInDays(parseISO(after.timestamp), parseISO(before.timestamp));
  const fatChangeNum = beforeFat && afterFat ? (afterFat.low + afterFat.high) / 2 - (beforeFat.low + beforeFat.high) / 2 : 0;
  const scoreChangeNum = afterScore - beforeScore;

  const scoreChange = scoreChangeNum.toFixed(1);

  const fatPercent = beforeFat && afterFat ? (((fatChangeNum / ((beforeFat.low + beforeFat.high) / 2)) * 100) || 0).toFixed(0) : 0;
  const improved = scoreChangeNum > 0;

  return (
    <div className="fixed inset-0 flex items-end z-70" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl" style={{ color: "var(--text)" }}>
              Progress Comparison
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {daysBetween} days of transformation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl active:scale-90"
            style={{ color: "var(--text-light)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Timeline</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 rounded-lg p-3" style={{ background: "rgba(124,92,252,0.1)" }}>
              <p className="text-xs font-semibold" style={{ color: "#7C5CFC" }}>Before</p>
              <p className="text-xs mt-1" style={{ color: "var(--text)" }}>
                {format(parseISO(before.timestamp), "MMM d, yyyy")}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {before.angle === "all" ? "Multiple angles" : before.angle}
              </p>
            </div>
            <div style={{ color: "var(--text-light)", fontSize: "0.75rem" }}>
              <p className="font-semibold">{daysBetween}</p>
              <p>days</p>
            </div>
            <div className="flex-1 rounded-lg p-3" style={{ background: improved ? "rgba(124,92,252,0.15)" : "rgba(218,102,123,0.1)" }}>
              <p className="text-xs font-semibold" style={{ color: improved ? "#7C5CFC" : "#DA667B" }}>After</p>
              <p className="text-xs mt-1" style={{ color: "var(--text)" }}>
                {format(parseISO(after.timestamp), "MMM d, yyyy")}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {after.angle === "all" ? "Multiple angles" : after.angle}
              </p>
            </div>
          </div>
        </div>

        {/* Body Fat Progress */}
        {beforeFat && afterFat && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Body Fat Progress
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-2 text-center" style={{ background: "rgba(124,92,252,0.1)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Before</p>
                <p className="font-bold mt-1" style={{ color: "#7C5CFC" }}>
                  {((beforeFat.low + beforeFat.high) / 2).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: fatChangeNum < 0 ? "rgba(124,92,252,0.1)" : "rgba(218,102,123,0.1)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Change</p>
                <p className="font-bold mt-1" style={{ color: fatChangeNum < 0 ? "#7C5CFC" : "#DA667B" }}>
                  {fatChangeNum < 0 ? "-" : "+"}{Math.abs(fatChangeNum).toFixed(1)}%
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-light)" }}>
                  ({fatPercent}%)
                </p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: "rgba(124,92,252,0.1)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>After</p>
                <p className="font-bold mt-1" style={{ color: "#7C5CFC" }}>
                  {((afterFat.low + afterFat.high) / 2).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-8 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.07)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(10, Math.min(100, ((afterFat.low + afterFat.high) / 2) * 1.5))}%`,
                  background: fatChangeNum < 0 ? "linear-gradient(90deg, #7C5CFC, #9B7FFF)" : "linear-gradient(90deg, #DA667B, #C99A5C)",
                }}
              />
            </div>
            <p className="text-xs text-center" style={{ color: fatChangeNum < 0 ? "#7C5CFC" : "#DA667B" }}>
              {fatChangeNum < 0 ? "✓ Decreasing" : "⚠ Increasing"}
            </p>
          </div>
        )}

        {/* Composition Score Progress */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Composition Score
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-2 text-center" style={{ background: "rgba(124,92,252,0.1)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Before</p>
              <p className="font-serif text-xl mt-1" style={{ color: "#7C5CFC" }}>
                {beforeScore}/10
              </p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: improved ? "rgba(124,92,252,0.1)" : "rgba(218,102,123,0.1)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Change</p>
              <p className="font-bold mt-1" style={{ color: improved ? "#7C5CFC" : "#DA667B" }}>
                {improved ? "+" : ""}{scoreChange}
              </p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: "rgba(124,92,252,0.1)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>After</p>
              <p className="font-serif text-xl mt-1" style={{ color: "#7C5CFC" }}>
                {afterScore}/10
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-8 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.07)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(10, (afterScore / 10) * 100)}%`,
                background: improved ? "linear-gradient(90deg, #7C5CFC, #9B7FFF)" : "linear-gradient(90deg, #DA667B, #C99A5C)",
              }}
            />
          </div>
          <p className="text-xs text-center" style={{ color: improved ? "#7C5CFC" : "#DA667B" }}>
            {improved ? "✓ Improving" : "→ Steady"}
          </p>
        </div>

        {/* Measurements */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(124,92,252,0.05)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Measurements</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {before.height && (
              <div>
                <p style={{ color: "var(--text-muted)" }}>Height</p>
                <p style={{ color: "var(--text)" }}>{before.height.toFixed(1)}&quot;</p>
              </div>
            )}
            {before.weight && after.weight && (
              <>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Weight (Before)</p>
                  <p style={{ color: "var(--text)" }}>{before.weight.toFixed(1)} lbs</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Weight (After)</p>
                  <p style={{ color: "var(--text)" }}>{after.weight.toFixed(1)} lbs</p>
                  {before.weight && (
                    <p className="text-[10px]" style={{ color: after.weight < before.weight ? "#7C5CFC" : "#DA667B" }}>
                      {after.weight < before.weight ? "-" : "+"}{Math.abs(after.weight - before.weight).toFixed(1)} lbs
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold"
          style={{ background: "#7C5CFC", color: "#fff" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
