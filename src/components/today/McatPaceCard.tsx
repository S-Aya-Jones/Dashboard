"use client";

import { GraduationCap, TrendingUp, TrendingDown, Target } from "lucide-react";
import { DashboardData } from "@/types/dashboard";
import { computeMcatPace } from "@/lib/mcatPace";

interface Props {
  data: DashboardData;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  "on-track": { label: "On pace", color: "#71816D" },
  "ahead": { label: "Ahead of pace", color: "#71816D" },
  "behind": { label: "Behind pace", color: "#DA667B" },
  "test-passed": { label: "Test date passed", color: "#A8967E" },
  "no-date": { label: "No test date set", color: "#A8967E" },
};

export function McatPaceCard({ data }: Props) {
  const pace = computeMcatPace(data);
  const meta = STATUS_META[pace.status];

  return (
    <div
      className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #2B1F4A 0%, #5B3FA8 55%, #9A5CFC 100%)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap size={20} />
          <h2 className="font-serif text-xl">MCAT Pace</h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
          {meta.label}
        </span>
      </div>

      {pace.status === "no-date" ? (
        <p className="text-sm mt-3 text-white/80">Set your MCAT test date on the MCAT page to get a science-backed weekly study target.</p>
      ) : pace.status === "test-passed" ? (
        <p className="text-sm mt-3 text-white/80">Your saved test date has passed — update it on the MCAT page if you are still prepping.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div>
              <p className="text-2xl font-serif">{pace.daysRemaining}</p>
              <p className="text-[11px] text-white/70">days to test</p>
            </div>
            <div>
              <p className="text-2xl font-serif">{pace.weeklyHourTarget}h</p>
              <p className="text-[11px] text-white/70">target / week</p>
            </div>
            <div>
              <p className="text-2xl font-serif">{pace.hoursLoggedThisWeek}h</p>
              <p className="text-[11px] text-white/70">logged this week</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
              <span>This week&apos;s progress</span>
              <span>{Math.min(999, Math.round((pace.hoursLoggedThisWeek / (pace.weeklyHourTarget || 1)) * 100))}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (pace.hoursLoggedThisWeek / (pace.weeklyHourTarget || 1)) * 100)}%`,
                  background: pace.onTrack ? "#A7D4A0" : "#F2B8C6",
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3 text-xs text-white/80">
            {pace.onTrack ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <span>
              {pace.hoursRemaining}h left of ~{pace.totalRecommendedHours}h recommended prep — based on {pace.weeksRemaining} weeks remaining, capped near 25h/wk to avoid burnout.
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-xs text-white/60">
            <Target size={12} />
            <span>{pace.hoursLoggedTotal}h logged total across study sessions and timer</span>
          </div>
        </>
      )}
    </div>
  );
}
