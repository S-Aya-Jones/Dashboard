// When it gets dark, and when the roads are quiet.
//
// Her two conditions for a practice drive: not in traffic, and not in the dark.
// Both move. Sunset in Nashville slides from about 6:10pm in mid-October to
// 4:35pm around the solstice, and on November 1 it jumps back an hour in a
// single night — so a drive that was comfortably in daylight on Saturday is a
// night drive the following Saturday, and nothing in the app would have said
// so.
//
// Computed rather than fetched. It is arithmetic the sky has been doing for
// four billion years; it does not need an API key, a network call or a quota,
// and it works when everything else is down.
//
// The NOAA sunrise equation, to the minute. Good to well under a minute at this
// latitude, which is far better than a text message needs.

const NASHVILLE = { lat: 36.1627, lon: -86.7816 };
const TZ = "America/Chicago";

const rad = Math.PI / 180;
const sin = (d: number) => Math.sin(d * rad);
const cos = (d: number) => Math.cos(d * rad);

/** Sun altitude at the moment we call it sunrise or sunset: the disc half under. */
const SUNSET_ANGLE = -0.833;

function julianOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000 + 2440587.5;
}

function dateOf(julian: number): Date {
  return new Date((julian - 2440587.5) * 86_400_000);
}

/** Sunrise and sunset as instants, or null on the days a latitude has neither. */
function solarEvents(dateStr: string): { rise: Date; set: Date } | null {
  const n = Math.round(julianOf(dateStr) - 2451545.0 + 0.0008);
  const meanNoon = n - NASHVILLE.lon / 360;

  const M = (357.5291 + 0.98560028 * meanNoon) % 360;
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
  const lambda = (M + C + 180 + 102.9372) % 360;

  const transit = 2451545.0 + meanNoon + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
  const declination = Math.asin(sin(lambda) * sin(23.4397)) / rad;

  const cosOmega =
    (sin(SUNSET_ANGLE) - sin(NASHVILLE.lat) * sin(declination)) /
    (cos(NASHVILLE.lat) * cos(declination));
  // Nashville never sees either, but the maths does not know that.
  if (cosOmega > 1 || cosOmega < -1) return null;

  const omega = Math.acos(cosOmega) / rad;
  return { rise: dateOf(transit - omega / 360), set: dateOf(transit + omega / 360) };
}

/**
 * Local clock time of an instant, as minutes past midnight in Chicago.
 *
 * Via Intl rather than a fixed offset, so the hour that daylight saving takes
 * back on November 1 is taken back here too.
 */
function chicagoMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at);
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}

export function clockOf(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")}${h24 < 12 ? "am" : "pm"}`;
}

export interface Daylight {
  /** Minutes past local midnight. */
  sunrise: number;
  sunset: number;
  sunriseLabel: string;
  sunsetLabel: string;
}

export function daylight(dateStr: string): Daylight | null {
  const ev = solarEvents(dateStr);
  if (!ev) return null;
  const sunrise = chicagoMinutes(ev.rise);
  const sunset = chicagoMinutes(ev.set);
  return {
    sunrise, sunset,
    sunriseLabel: clockOf(sunrise),
    sunsetLabel: clockOf(sunset),
  };
}

// Nashville's rush, roughly. Not measured — a stated assumption, which is why
// it is one named constant rather than scattered through the message builders.
const MORNING_RUSH_END = 9 * 60;
const EVENING_RUSH_START = 16 * 60;

/** Saturday and Sunday, when the clock that matters is the sun and not the commute. */
function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00`).getDay();
  return d === 0 || d === 6;
}

export interface DriveWindow {
  /** Minutes past midnight, or null when the day offers no usable window. */
  from: number | null;
  to: number | null;
  label: string | null;
  /** Said only when the light going is the thing worth knowing. */
  note: string | null;
}

/**
 * When to go.
 *
 * Deliberately different on different days, because the constraint is
 * different. On a weekday the roads are the problem and the window is the gap
 * between the two rushes. At the weekend the traffic is not the problem and the
 * light is, so the whole lit day is open and what matters is when it ends.
 *
 * An earlier version applied the weekday rushes every day, which produced the
 * same "9am to 4pm" in every text in every season — advice that is the same
 * every week is not advice, it is furniture.
 */
export function driveWindow(dateStr: string): DriveWindow {
  const light = daylight(dateStr);
  if (!light) return { from: null, to: null, label: null, note: null };

  // A half hour inside sunrise and sunset at each end, because the first and
  // last of it is low sun straight down the road, which is its own problem.
  const open = light.sunrise + 30;
  const close = light.sunset - 30;

  const weekend = isWeekend(dateStr);
  const from = weekend ? open : Math.max(open, MORNING_RUSH_END);
  const to = weekend ? close : Math.min(close, EVENING_RUSH_START);

  // Worth saying once the evening commute runs past sunset, which in Nashville
  // happens the week the clocks change and stays true until February.
  const note = light.sunset < 17 * 60 + 30
    ? `Dark by ${light.sunsetLabel} now — after work is a night drive.`
    : null;

  if (to <= from) return { from: null, to: null, label: null, note };
  return { from, to, label: `${clockOf(from)} to ${clockOf(to)}`, note };
}

/**
 * One line about timing, or nothing.
 *
 * Returning null is the common case and the point of the function: most days
 * there is nothing to say about when to go, and a text that says something
 * anyway is a text she skims.
 */
export function driveTiming(dateStr: string): string | null {
  const light = daylight(dateStr);
  if (!light) return null;
  const w = driveWindow(dateStr);

  if (isWeekend(dateStr)) {
    // Setting off an hour and a half before the light goes leaves room for the
    // drive and for sitting in the car afterwards, which is half of it.
    const leaveBy = clockOf(Math.max(light.sunset - 90, light.sunrise + 60));
    return light.sunset < 17 * 60
      ? `Light goes at ${light.sunsetLabel} — set off by ${leaveBy}.`
      : `Light until ${light.sunsetLabel}.`;
  }

  return w.label ? `Roads are quietest ${w.label}, and light the whole way.` : w.note;
}
