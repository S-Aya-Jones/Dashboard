"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardData, defaultDashboardData } from "@/types/dashboard";

const SAVE_DELAY = 1500; // ms before auto-save fires after last change

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(defaultDashboardData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Null while healthy. Set when the server couldn't be read or written.
  const [dataError, setDataError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saving is only ever allowed after a load that genuinely returned her data.
  //
  // This used to flip true even when the load failed. Combined with the API
  // returning defaults on a database error, that meant a failed load left the
  // app holding blank data with autosave armed — and the first successful
  // write would have overwritten her real records with empty ones. A read
  // failure must disable writing, not enable it.
  const loadedFromServer = useRef(false);
  // The updatedAt this tab loaded. Sent with every save so the server can tell
  // a genuine edit from a stale tab about to revert everything.
  const baseUpdatedAt = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const body = await res.json();

      if (!res.ok || body?.error) {
        loadedFromServer.current = false;
        setDataError(
          body?.overQuota
            ? "The database is over its data transfer quota. Your data is safe but can't be read right now — nothing you change here will be saved."
            : "Couldn't reach the database. Your data is safe but can't be read right now — nothing you change here will be saved."
        );
        return;
      }

      setData(body as DashboardData);
      baseUpdatedAt.current = (body as DashboardData).updatedAt ?? null;
      loadedFromServer.current = true;
      setDataError(null);
    } catch {
      loadedFromServer.current = false;
      setDataError("Couldn't reach the server. Nothing you change here will be saved.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback((newData: DashboardData) => {
    if (!loadedFromServer.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...newData, baseUpdatedAt: baseUpdatedAt.current }),
        });

        if (res.status === 409) {
          // This tab would have written its own copy over newer data. Stop
          // saving from here until it reloads, rather than reverting the lot.
          loadedFromServer.current = false;
          setDataError("This page is out of date — something changed on another device. Reload to see it; nothing from this page has been saved.");
          return;
        }

        if (!res.ok) {
          // Say so rather than letting her carry on believing it saved.
          setDataError("That didn't save — the database is unreachable. Don't rely on changes made now.");
        } else {
          // The save moved the clock on; this tab is now the current version.
          baseUpdatedAt.current = new Date().toISOString();
          setDataError(null);
        }
      } catch {
        setDataError("That didn't save — the server is unreachable.");
      } finally {
        setSaving(false);
      }
    }, SAVE_DELAY);
  }, []);

  const update = useCallback(
    (updater: (prev: DashboardData) => DashboardData) => {
      setData((prev) => {
        const next = updater(prev);
        save(next);
        return next;
      });
    },
    [save]
  );

  return { data, update, loading, saving, dataError, reload: load };
}
