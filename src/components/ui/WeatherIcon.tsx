// Line-art weather glyphs. Emoji render differently on every device and read
// as clip art next to the serif type; these inherit currentColor and sit on
// the same optical weight as the rest of the interface.

export type WxKind =
  | "clear" | "partly" | "cloudy" | "fog"
  | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather interpretation code → icon kind + plain-language label. */
export function wxFromCode(code: number): { kind: WxKind; label: string } {
  if (code === 0) return { kind: "clear",   label: "Clear skies" };
  if (code <= 2)  return { kind: "partly",  label: "Partly cloudy" };
  if (code === 3) return { kind: "cloudy",  label: "Overcast" };
  if (code <= 48) return { kind: "fog",     label: "Foggy" };
  if (code <= 55) return { kind: "drizzle", label: "Light drizzle" };
  if (code <= 65) return { kind: "rain",    label: "Rain today" };
  if (code <= 77) return { kind: "snow",    label: "Snow expected" };
  if (code <= 82) return { kind: "drizzle", label: "Rain showers" };
  return { kind: "storm", label: "Thunderstorms" };
}

const CLOUD = "M7 18h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 10.1 3.95 3.95 0 0 0 7 18Z";

export function WeatherIcon({
  kind,
  size = 28,
  className = "",
}: {
  kind: WxKind;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (kind) {
    case "clear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
        </svg>
      );
    case "partly":
      return (
        <svg {...common}>
          <circle cx="8.5" cy="8" r="3" />
          <path d="M8.5 2.5v1.4M3 8h1.4M4.6 4.1l1 1M12.4 4.1l-1 1" />
          <path d={CLOUD} />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...common}>
          <path d={CLOUD} />
          <path d="M5.5 13.2a3 3 0 0 1 1.2-5.6" opacity=".55" />
        </svg>
      );
    case "fog":
      return (
        <svg {...common}>
          <path d="M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 6.1 3.95 3.95 0 0 0 7 14Z" />
          <path d="M4 17.5h13M6.5 20.5h11" />
        </svg>
      );
    case "drizzle":
      return (
        <svg {...common}>
          <path d="M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 6.1 3.95 3.95 0 0 0 7 14Z" />
          <path d="M9 17.5v1.5M13 17.5v1.5M17 17.5v1.5" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 6.1 3.95 3.95 0 0 0 7 14Z" />
          <path d="M9 17l-1 4M13 17l-1 4M17 17l-1 4" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path d="M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 6.1 3.95 3.95 0 0 0 7 14Z" />
          <path d="M9 18h.01M13 18h.01M17 18h.01M11 21h.01M15 21h.01" strokeWidth="2" />
        </svg>
      );
    case "storm":
      return (
        <svg {...common}>
          <path d="M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 6.1 3.95 3.95 0 0 0 7 14Z" />
          <path d="M13.2 15.6l-2.6 3.3h2.4l-1.9 2.9" />
        </svg>
      );
  }
}
