"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardData, defaultDashboardData } from "@/types/dashboard";

const SAVE_DELAY = 1500; // ms before auto-save fires after last change

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(defaultDashboardData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // Load on mount
  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
        initialized.current = true;
      })
      .catch(() => {
        setLoading(false);
        initialized.current = true;
      });
  }, []);

  // Auto-save with throttle
  const save = useCallback((newData: DashboardData) => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newData),
        });
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

  return { data, update, loading, saving };
}
