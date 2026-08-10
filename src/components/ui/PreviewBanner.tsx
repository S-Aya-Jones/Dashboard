"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SITE_URL } from "@/lib/siteUrl";

// Vercel keeps every deployment alive at its own URL, and those URLs end up in
// browser history and open tabs. Landing on one means running a build from days
// ago: fixes appear not to have shipped, old bugs appear to have come back, and
// nothing on the page says so. That has cost several rounds of debugging
// something that was already fixed.
//
// Rendered client-side because the host is only knowable in the browser.
export function PreviewBanner() {
  const [previewHost, setPreviewHost] = useState<string | null>(null);

  useEffect(() => {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
    if (SITE_URL.includes(hostname)) return;
    setPreviewHost(hostname);
  }, []);

  if (!previewHost) return null;

  return (
    <div
      className="flex items-start gap-2 px-4 py-2.5 text-sm"
      style={{ background: "#8C3F22", color: "#FFF6EE" }}
      role="alert"
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>
        This is an old preview build, not your dashboard — anything fixed recently
        won&apos;t be here.{" "}
        <a
          href={SITE_URL}
          className="underline font-semibold"
          style={{ color: "#FFF6EE" }}
        >
          Open the real one
        </a>
        .
      </span>
    </div>
  );
}
