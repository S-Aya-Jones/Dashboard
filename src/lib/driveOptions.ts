import type { Place, Bridge, TrackView } from "@/lib/driving";
import { routeLink } from "@/lib/driving";

// Three places to drive today, by name.
//
// The ladder describes shapes — "a route that runs alongside a highway", "a
// weekend drive somewhere you actually want to go". That is the right way to
// think about progression and the wrong thing to receive at 7:45 in the
// morning, because it leaves her to do the choosing, and choosing is the part
// she said she wants to stop doing.
//
// So this turns the shape into named options: a place, a route, a link. Three
// of them, in a fixed order, so the decision is which one rather than what.
//
// Everything here comes from what she has saved. The code names no roads: it
// cannot verify a street in Nashville and will not invent one.

export interface Option {
  tier: "known" | "today" | "stretch";
  label: string;
  detail: string;
  link: string | null;
}

export interface OptionsResult {
  options: Option[];
  /** What's missing, when there isn't enough saved to choose from. */
  missing: string | null;
}

const TIER_WORD: Record<Option["tier"], string> = {
  known: "Easy",
  today: "Today's rung",
  stretch: "Stretch",
};

/**
 * Pick three.
 *
 * Ordered easiest first on purpose. A list that opens with the hard one is a
 * list she closes.
 */
export function driveOptions(opts: {
  places: Place[];
  bridges: Bridge[];
  tracks: TrackView[];
  /** Destination keys she has already driven, most recent first. */
  drivenKeys: string[];
}): OptionsResult {
  const home = opts.places.find(p => p.key === "home");
  const destinations = opts.places.filter(p => p.kind === "destination");

  if (!home) {
    return { options: [], missing: "No home address saved yet — text: set home <address>" };
  }
  if (!destinations.length && !opts.bridges.length) {
    return { options: [], missing: "Nowhere saved to drive to yet — text: add place <name> <address>" };
  }

  const driven = new Set(opts.drivenKeys);
  const out: Option[] = [];

  // Easy: somewhere she has already been, by the route that avoids interstates.
  // The point of this one is that it is not a test.
  const familiar = destinations.find(d => driven.has(d.key)) ?? destinations[0];
  if (familiar) {
    out.push({
      tier: "known",
      label: familiar.label,
      detail: driven.has(familiar.key) ? "You've driven this one" : "No interstates",
      link: routeLink(home.address, familiar.address),
    });
  }

  // Today's rung: the next bridge if there is one owing, because bridges are
  // the track she named as the one she wants back.
  const nextBridge = opts.bridges.find(b => b.reps < b.target);
  if (nextBridge) {
    out.push({
      tier: "today",
      label: nextBridge.label,
      detail: nextBridge.doneBefore
        ? `You've driven this before — ${nextBridge.target - nextBridge.reps} more to make it ordinary`
        : `${nextBridge.target - nextBridge.reps} more to go`,
      link: null,
    });
  } else {
    const driving = opts.tracks.find(t => t.track === "driving");
    if (driving?.current) {
      out.push({ tier: "today", label: driving.current.title, detail: driving.current.why, link: driving.current.link });
    }
  }

  // Stretch: somewhere she hasn't been, same no-interstate route. One rung up
  // is a new place, not a new kind of road — changing both at once is how a
  // stretch becomes a stop.
  const unfamiliar = destinations.find(d => !driven.has(d.key) && d.key !== familiar?.key);
  if (unfamiliar) {
    out.push({
      tier: "stretch",
      label: unfamiliar.label,
      detail: "Somewhere new, still no interstate",
      link: routeLink(home.address, unfamiliar.address),
    });
  }

  return { options: out.slice(0, 3), missing: null };
}

/** The same three, as a text message. */
export function optionsText(r: OptionsResult): string {
  if (r.missing) return r.missing;
  if (!r.options.length) return "Nothing to suggest yet. Add a place or a bridge and I'll have options.";

  return r.options
    .map(o => `${TIER_WORD[o.tier]}: ${o.label}. ${o.detail}.${o.link ? ` ${o.link}` : ""}`)
    .join("\n");
}
