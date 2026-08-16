"use client";

import { useEffect, useState } from "react";
import { Droplet } from "lucide-react";

// The bottle, found rather than photographed.
//
// She asked to see the products without having to shoot them herself. This
// looks each one up in Open Beauty Facts by name and brand and shows the
// community photo if — and only if — the match is confident. A picture of the
// wrong bottle is worse than no picture, because the whole point is being able
// to recognise what to reach for at 8pm.
//
// Results are cached in sessionStorage so a routine of seven products doesn't
// make seven network calls every time she opens the page.

interface Props {
  name: string;
  brand?: string;
  size?: number;
}

const CACHE = "product-photo:";

export function ProductPhoto({ name, brand, size = 48 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!name.trim()) { setTried(true); return; }
    const key = `${CACHE}${brand ?? ""}|${name}`;

    try {
      const hit = sessionStorage.getItem(key);
      if (hit !== null) { setSrc(hit || null); setTried(true); return; }
    } catch { /* private mode — just fetch */ }

    let live = true;
    const q = new URLSearchParams({ name, ...(brand ? { brand } : {}) });
    fetch(`/api/skincare/photo?${q}`)
      .then(r => r.json())
      .then(d => {
        if (!live) return;
        const image: string | null = d.image ?? null;
        setSrc(image);
        setTried(true);
        try { sessionStorage.setItem(key, image ?? ""); } catch { /* ignore */ }
      })
      .catch(() => { if (live) setTried(true); });

    return () => { live = false; };
  }, [name, brand]);

  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: 12, flexShrink: 0,
    background: "var(--bg)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  };

  if (src) {
    return (
      <div style={box}>
        {/* Plain img: these are remote URLs from an open database, and running
            them through the image optimiser would mean allow-listing a host
            whose images can move. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} width={size} height={size}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={() => setSrc(null)} />
      </div>
    );
  }

  return (
    <div style={box} title={tried ? "No photo found for this one" : "Looking…"}>
      <Droplet size={Math.round(size * 0.4)} style={{ color: "var(--text-light)", opacity: tried ? 0.5 : 0.25 }} />
    </div>
  );
}
