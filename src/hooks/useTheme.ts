"use client";

import { useEffect, useState } from "react";
import { Theme, applyTheme, getStoredTheme } from "@/lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return { theme, toggle };
}
