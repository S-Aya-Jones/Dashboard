"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";

interface Suggestion { description: string; main: string; secondary: string }

/** Address field with Google Places suggestions as you type. Falls back to a
 *  plain input if the Places API isn't enabled on the key. */
export function AddressInput({
  value, onChange, placeholder, saved = [],
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  saved?: Array<{ label: string; address: string }>;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  // Debounced lookup
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (value.trim().length < 3) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(value)}`);
        const d = await res.json();
        if (d.error === "PLACES_NOT_ENABLED") { setNotEnabled(true); setSuggestions([]); return; }
        setSuggestions(d.suggestions ?? []);
        setActive(-1);
      } catch { setSuggestions([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const savedMatches = value.trim().length > 0
    ? saved.filter(s => s.label.toLowerCase().includes(value.toLowerCase().trim())).slice(0, 3)
    : saved.slice(0, 3);

  const pick = (address: string) => {
    skipNext.current = true;
    onChange(address);
    setSuggestions([]);
    setOpen(false);
  };

  const rows = [
    ...savedMatches.map(s => ({ kind: "saved" as const, main: s.label, secondary: s.address, value: s.address })),
    ...suggestions.map(s => ({ kind: "place" as const, main: s.main, secondary: s.secondary, value: s.description })),
  ];

  return (
    <div ref={box} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!rows.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(rows[active].value); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
      />

      <AnimatePresence>
        {open && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1.5px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,.14)" }}>
            {rows.map((r, i) => (
              <button key={`${r.kind}-${i}`} type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.value)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
                style={{ background: active === i ? "rgba(180,85,47,.10)" : "transparent" }}>
                <MapPin size={13} className="flex-shrink-0 mt-0.5"
                  style={{ color: r.kind === "saved" ? "#2bb3a3" : "var(--purple)" }} />
                <span className="min-w-0">
                  <span className="block text-sm truncate" style={{ color: "var(--text)" }}>
                    {r.main}
                    {r.kind === "saved" && (
                      <span className="ml-1.5 text-[9px] font-bold uppercase" style={{ color: "#2bb3a3" }}>saved</span>
                    )}
                  </span>
                  {r.secondary && (
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{r.secondary}</span>
                  )}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {notEnabled && (
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          Suggestions need the <strong>Places API</strong> enabled on your key — typing the full address still works.
        </p>
      )}
    </div>
  );
}
