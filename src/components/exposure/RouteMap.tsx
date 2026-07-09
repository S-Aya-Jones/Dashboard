"use client";

interface RouteMapProps {
  origin: string;
  destination: string;
  className?: string;
}

export function RouteMap({ origin, destination, className = "" }: RouteMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return (
      <div className={`rounded-xl flex items-center justify-center text-xs text-sand-dark bg-cream-dark p-4 text-center ${className}`}>
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable embedded route maps.
      </div>
    );
  }

  if (!origin.trim() || !destination.trim()) {
    return (
      <div className={`rounded-xl flex items-center justify-center text-xs text-sand-dark bg-cream-dark p-4 text-center ${className}`}>
        Enter both a start and end point to preview the route.
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`;

  return (
    <iframe
      title={`Route from ${origin} to ${destination}`}
      className={`rounded-xl border-0 ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={src}
    />
  );
}
