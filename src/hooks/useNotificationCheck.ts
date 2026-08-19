"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function useNotificationCheck() {
  const lastCheck = useRef(0);

  const runCheck = () => {
    const now = Date.now();
    if (now - lastCheck.current < 60000) return; // debounce 1 min
    lastCheck.current = now;
    fetch("/api/push/check").catch(() => {});
  };

  useEffect(() => {
    // Check on mount (slight delay so page loads first)
    const t = setTimeout(runCheck, 3000);

    // Check every 10 minutes
    const interval = setInterval(runCheck, CHECK_INTERVAL);

    // Check when user comes back to the tab
    const onFocus = () => runCheck();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") runCheck();
    });

    return () => {
      clearTimeout(t);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
