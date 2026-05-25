"use client";

import { useEffect, useState } from "react";

export function DashboardVoice({ stats }: { stats: string[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (stats.length === 0) return;
    setIdx(Math.floor(Math.random() * stats.length));
  }, [stats.length]);

  if (stats.length === 0) return null;

  return (
    <div className="text-center py-1">
      <p className="text-[13px] text-sand-dark tracking-wide">{stats[idx]}</p>
    </div>
  );
}
