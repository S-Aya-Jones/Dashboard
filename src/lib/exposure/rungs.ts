// The rungs, as she wrote them.
//
// Verbatim where she gave wording, because these are her routes and her words
// for them. Nothing here is generated or paraphrased: a route description that
// drifts from what she actually drives is worse than no description.
//
// Her home address and two waypoints on her street are in this file. That was
// put to her directly, with the repository being public, and this is the shape
// she asked for.
//
// No dashes anywhere in any string here. That is a standing instruction for
// every outgoing text, and there is a sanitiser at the send path as a backstop,
// but the right place to not write one is here.

const DEST = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=1809+Morena+St+Nashville+TN+37208&waypoints=";

export type TrackKey = "A" | "B" | "C" | "DMON" | "DTHU";

export interface Rung {
  id: string;
  /** The line she reads. Already includes distance where she gave one. */
  text: string;
  link: string | null;
}

// ── A: the drive home at 2:30 ────────────────────────────────────────────────

export const A_RUNGS: Rung[] = [
  {
    id: "A1",
    text: "Usual route home, loose: left foot flat, hands soft, any lane, say the scary thought out loud once.",
    link: null,
  },
  {
    id: "A2",
    text: "Lefts and reds: 25th Ave N, Charlotte Ave, left on D.B. Todd, left on Morena. Stay in your lane at reds. 1.7 mi.",
    link: `${DEST}36.156510,-86.806440%7C36.160230,-86.801670`,
  },
  {
    id: "A3",
    text: "West End loop: 31st Ave N, West End Ave east, Elliston Pl, 25th Ave N, Charlotte, D.B. Todd, Morena. 3.1 mi.",
    link: `${DEST}36.147001,-86.816328%7C36.144800,-86.812840%7C36.156510,-86.806440`,
  },
  {
    id: "A4",
    text: "Connector bridge: the 28th Ave connector over the railroad, right on Charlotte, left on D.B. Todd, left on Morena. 2.1 mi.",
    link: `${DEST}36.151370,-86.819210%7C36.156510,-86.806440`,
  },
  {
    id: "A5",
    text: "Past the interstate: connector, 28th Ave N across Charlotte and across I-40, right on Jefferson St past the I-40 ramps (stay on Jefferson), right on D.B. Todd, Morena. 2.5 mi.",
    link: `${DEST}36.151370,-86.819210%7C36.167770,-86.819820`,
  },
  {
    // Terminal. Not a route of its own: it picks among A3, A4 and A5.
    id: "A6",
    text: "Rotate A3, A4, A5.",
    link: null,
  },
];

/** The A6 rotation pool, and never the same one two office days running. */
export const A6_POOL = ["A3", "A4", "A5"];

/** Monday has its own route. It is logged and it never advances the track. */
export const MONDAY_RUNG: Rung = {
  id: "MON",
  text: "Capitol View home: Charlotte Ave west under I-40, right on D.B. Todd, left on Morena. Foot loose.",
  link: `${DEST}36.158813,-86.798171%7C36.160230,-86.801670`,
};

// ── B: the Sunday big drive ──────────────────────────────────────────────────

export const B_RUNGS: Rung[] = [
  {
    id: "B1",
    text: "KAHAWA, 120 21st Ave N, by Charlotte and 21st Ave N. Home the wide way: right on West End Ave, right on 25th Ave N, Charlotte, D.B. Todd.",
    link: "https://www.google.com/maps/dir/?api=1&destination=120+21st+Ave+N+Nashville+TN+37203&travelmode=driving",
  },
  {
    id: "B2",
    text: "Germantown: Steadfast Coffee, 603 Taylor St, by Jefferson St. Their lot or the street.",
    link: "https://www.google.com/maps/dir/?api=1&destination=603+Taylor+St+Nashville+TN+37208&waypoints=36.173028,-86.792414&travelmode=driving",
  },
  {
    id: "B3",
    text: "Over the Cumberland: Jefferson St straight across the Jefferson Street Bridge to East Park Donuts and Coffee, 700 Main St. Cross there and back, then one more round trip.",
    link: "https://www.google.com/maps/dir/?api=1&destination=700+Main+St+Nashville+TN+37206&waypoints=36.175920,-86.780795&travelmode=driving",
  },
  {
    id: "B4",
    text: "Bridge walk 1: John Seigenthaler Pedestrian Bridge, downtown end on 3rd Ave S. Walk to the first overlook, 3 min at the rail, walk back. Check for closures first.",
    link: "https://www.google.com/maps/search/?api=1&query=John+Seigenthaler+Pedestrian+Bridge+Nashville",
  },
  {
    id: "B5",
    text: "Bridge walk 2: all the way across, 5 min at the middle overlook, walk back. Check for closures first.",
    link: null,
  },
  {
    id: "B6",
    text: "Two bridges: out over the Jefferson Street Bridge to Haraz Coffee House, 901 Woodland St (lot next door), back over the Woodland Street Bridge, home on Charlotte.",
    link: "https://www.google.com/maps/dir/?api=1&destination=901+Woodland+St+Nashville+TN+37206&waypoints=36.175920,-86.780795&travelmode=driving",
  },
  {
    id: "B7",
    text: "Dusk: the B1 route as a loop, no stop, leaving at sunset.",
    link: "https://www.google.com/maps/dir/?api=1&destination=120+21st+Ave+N+Nashville+TN+37203&travelmode=driving",
  },
  {
    id: "B8",
    text: "Dark: the B1 loop, then the connector bridge.",
    link: "https://www.google.com/maps/dir/?api=1&destination=120+21st+Ave+N+Nashville+TN+37203&travelmode=driving",
  },
  {
    id: "B9",
    text: "Passenger: I-40 West from Jefferson St at 28th Ave (Exit 207) to 46th Ave (Exit 205), right lanes, surface streets home.",
    link: null,
  },
  {
    id: "B10",
    text: "Same stretch, me driving, with my therapist.",
    link: null,
  },
];

/** Sent at their own times on Sunday rather than at nine in the morning. */
export const DUSK_RUNG = "B7";
export const DARK_RUNG = "B8";
/** Only once the light has gone early enough to make them real. */
export const SUNSET_BEFORE_MIN = 17 * 60;
/** Held until she texts "therapist ok". */
export const THERAPIST_GATED = ["B9", "B10"];
/** Held until T1 has been done clean. */
export const A4_NEEDS = "T1";

// ── C: the three minute height rep ───────────────────────────────────────────
//
// {comfort} is the floor she sets with "set floor". The rungs are written
// against it rather than against absolute floors, so the ladder means the same
// thing in whichever building she is standing in.

export interface CRung { id: string; text: (comfort: number) => string }

export const C_RUNGS: CRung[] = [
  { id: "C1", text: c => `Elevator to floor ${c + 1}. Stand 2 min away from windows, feet flat. Ride down.` },
  { id: "C2", text: c => `Floor ${c + 1}, at a window 2 min. Last 30 seconds, look straight down.` },
  { id: "C3", text: c => `Floor ${c + 2}, at a window, look down 1 min.` },
  { id: "C4", text: () => "Top floor of Building 3, at a window, look down 1 min." },
  { id: "C5", text: () => "Stairwell, highest landing I can reach, look down the gap 1 min." },
];

export const C_POOL = ["C3", "C4", "C5"];

/** Wednesday she is at home, so Wednesday has its own. */
export const C_WEDNESDAY = "Top floor of my building, at a window or the stair rail.";

// ── D Thursday: Park Plaza ───────────────────────────────────────────────────

export const T_RUNGS: Rung[] = [
  { id: "T1", text: "Walk onto the 28th Ave connector from Park Plaza, 2 min at the railing over the tracks, walk back.", link: null },
  { id: "T2", text: "Walk the whole connector and back, 3 min at the middle.", link: null },
  { id: "T3", text: "Top level of the garage at 2555 Park Plaza, 2 min looking over the edge wall.", link: null },
  { id: "T4", text: "Top floor of Building 3, 15 min at a window.", link: null },
  { id: "T5", text: "Escalator, one level, up and down 3 times (weekend mall is fine).", link: null },
];

export const T_POOL = ["T2", "T3", "T4", "T5"];

// ── Dates and limits ─────────────────────────────────────────────────────────

export const C_STARTS = "2026-10-26";
/** From here C drops to Tue, Wed and Fri, and D begins. */
export const D_STARTS = "2026-11-02";
export const DECK_CAP = 8;

/** Titans home Sundays. Downtown is unusable and the bridge walks are downtown. */
export const TITANS_SUNDAYS = [
  "2026-10-25", "2026-11-15", "2026-12-06", "2026-12-20", "2027-01-03",
];

export const TITANS_LINE = "Titans home game at noon. Leave by 8:15, off downtown streets by 10.";
export const DOWNTOWN_RUNGS = ["B4", "B5", "B6"];

export const TWO_ROUGH_LINE = "Two rough ones. Stay here and bring the log to your therapist.";

export function rungById(list: Rung[], id: string): Rung | null {
  return list.find(r => r.id === id) ?? null;
}
