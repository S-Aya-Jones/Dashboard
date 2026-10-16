"use client";

import { useEffect, useState } from "react";

// Who's paused, fetched once per page load.
//
// Both the sidebar and the floating docks need this, and several pages mount
// the sidebar outside DashboardShell so they can't be handed the list. Caching
// the in-flight promise at module scope means two components asking together
// make one request rather than two.

let cached: Promise<string[] | null> | null = null;

function fetchPaused(): Promise<string[] | null> {
  cached ??= fetch("/api/modules", { cache: "no-store" })
    .then(r => r.json())
    .then(d => (Array.isArray(d?.paused) ? (d.paused as string[]) : null))
    // A failed lookup means the defaults apply, which is the right answer for a
    // sidebar. It must never take the page down with it.
    .catch(() => null);
  return cached;
}

/** Drop the cache so a change on /modules shows without a reload. */
export function invalidatePaused() {
  cached = null;
}

/**
 * @param given A list the caller already has, which wins over the fetch.
 *   Note that `undefined` is a real value here — "she has never touched the
 *   switches" — so it can't be used to mean "nothing was passed".
 */
export function usePausedModules(given?: string[], hasGiven = false): string[] | undefined {
  const [fetched, setFetched] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    if (hasGiven) return;
    let live = true;
    fetchPaused().then(p => { if (live) setFetched(p); });
    return () => { live = false; };
  }, [hasGiven]);

  return hasGiven ? given : fetched ?? undefined;
}
