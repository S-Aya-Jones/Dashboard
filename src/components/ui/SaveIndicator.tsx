"use client";

import { Cloud } from "lucide-react";

export function SaveIndicator({ saving }: { saving: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
      {saving ? (
        <>
          <div
            className="w-3 h-3 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--border2)", borderTopColor: "var(--purple)" }}
          />
          <span>saving…</span>
        </>
      ) : (
        <>
          <Cloud size={13} style={{ color: "var(--purple)" }} />
          <span>saved</span>
        </>
      )}
    </div>
  );
}
