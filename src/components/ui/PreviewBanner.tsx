"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SITE_URL } from "@/lib/siteUrl";

// Vercel keeps every deployment alive at its own URL, and those URLs end up in
// browser history, in open tabs, and — worst — in a home-screen icon, which
// pins one build forever. Landing on one means running a build from days ago:
// fixes appear not to have shipped, old bugs appear to have come back.
//
// This used to be a warning with a link. She kept ending up here anyway and
// reporting fixed bugs as broken, because a banner asking you to notice it and
// tap something is a thing you have to think about. It now just moves her,
// carrying the path so she lands where she meant to be.
//
// The escape hatch is `?stay=1`, which is remembered for the tab — that is how
// a preview gets tested deliberately.

const STAY_KEY = "stay-on-preview";

export function PreviewBanner() {
  const [state, setState] = useState<"none" | "moving" | "staying">("none");

  useEffect(() => {
    const { hostname, pathname, search, hash } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
    if (SITE_URL.includes(hostname)) return;

    const params = new URLSearchParams(search);
    if (params.get("stay") === "1") sessionStorage.setItem(STAY_KEY, "1");
    if (sessionStorage.getItem(STAY_KEY) === "1") { setState("staying"); return; }

    setState("moving");
    // The path comes along, so a deep link into a preview lands on the same
    // page in production rather than dumping her on the home screen.
    window.location.replace(`${SITE_URL}${pathname}${search}${hash}`);
  }, []);

  if (state === "none") return null;

  return (
    <div
      className="flex items-start gap-2 px-4 py-2.5 text-sm"
      style={{ background: "#8C3F22", color: "#FFF6EE" }}
      role="alert"
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      {state === "moving" ? (
        <span>
          This is an old preview build — taking you to your real dashboard…{" "}
          <a href={SITE_URL} className="underline font-semibold" style={{ color: "#FFF6EE" }}>
            Go now
          </a>
          .
        </span>
      ) : (
        <span>
          Preview build, staying put because you asked.{" "}
          <a href={SITE_URL} className="underline font-semibold" style={{ color: "#FFF6EE" }}>
            Open the real one
          </a>
          .
        </span>
      )}
    </div>
  );
}
