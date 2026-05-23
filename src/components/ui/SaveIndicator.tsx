"use client";

import { Cloud } from "lucide-react";

export function SaveIndicator({ saving }: { saving: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-sand-dark">
      {saving ? (
        <>
          <div className="w-3 h-3 border-2 border-sand rounded-full border-t-terracotta animate-spin" />
          <span>saving…</span>
        </>
      ) : (
        <>
          <Cloud size={13} className="text-sage" />
          <span>saved</span>
        </>
      )}
    </div>
  );
}
