// The break plan, 24 September 2026.
//
// Two lists that matter more than the timeline: the cleanup, which is money
// leaking right now, and the open items, which are the questions that have to
// be answered before anything else can be decided.
//
// Both are tickable, and the ticks live in the database rather than here, so
// this file stays the plan and her progress stays hers.

export interface Phase {
  id: string;
  from: string;
  to?: string;
  /** A single date, for the ones that are an event rather than a stretch. */
  on?: string;
  title: string;
  kind: "focus" | "money" | "checkpoint" | "school" | "legal";
  detail: string;
}

export const TIMELINE: Phase[] = [
  { id: "recover", from: "2026-09-24", to: "2026-10-06", kind: "focus", title: "Recover",
    detail: "Rest, sleep, food, therapy, short walks. Nothing scheduled beyond the cleanup list. Physical recovery is the job." },
  { id: "storage", from: "2026-09-28", to: "2026-10-04", kind: "legal", title: "Storage case",
    detail: "Find attorneys who handle consumer arbitration and property tort — negligent bailment, conversion. Three to five consult calls. Pick one. Confirm the Consumer Protection Act deadline with whoever you retain." },
  { id: "electric", from: "2026-10-02", on: "2026-10-02", kind: "money", title: "Short check lands",
    detail: "Pay the $341 electric catch-up the same day." },
  { id: "phobia", from: "2026-10-07", to: "2026-12-31", kind: "focus", title: "Phobia and foundations",
    detail: "Driving exposures 3×/week. Bio and gen chem an hour a day, weekdays, on Khan Academy. Job search 3 days a week. Shadowing a half day a week from November. Journalling daily. Ladder 4×/week." },
  { id: "firstcheck", from: "2026-10-16", on: "2026-10-16", kind: "money", title: "First full check",
    detail: "The first $792 savings transfer. Two-account system goes live." },
  { id: "nov1", from: "2026-11-01", on: "2026-11-01", kind: "checkpoint", title: "Checkpoint",
    detail: "Ladder stays only if 8+ workouts happened in October. YMCA cancelled. Review spending against the plan." },
  { id: "school", from: "2027-01-05", on: "2027-01-05", kind: "school", title: "Back to school",
    detail: "The MHS programme plus prereqs. No MCAT while school is on." },
  { id: "goal", from: "2027-01-08", on: "2027-01-08", kind: "money", title: "Savings goal check",
    detail: "$5,000 target, $5,544 projected." },
  { id: "rent", from: "2027-02-01", on: "2027-02-01", kind: "money", title: "Rent starts",
    detail: "$1,200 a month, $600 a check. Savings drops to about $192 a check." },
  { id: "mcat", from: "2027-06-01", to: "2027-08-31", kind: "school", title: "MCAT",
    detail: "Full structured prep, Namrah back on. Test late August or early September 2027." },
  { id: "cycle", from: "2027-09-01", kind: "school", title: "School and the application cycle",
    detail: "Back in the programme with a score in hand." },
];

export interface Task {
  id: string;
  text: string;
  /** Anything that makes the task doable without going to find it. */
  detail?: string;
}

/** This week. Every one of these is money leaving the account. */
export const CLEANUP: Task[] = [
  { id: "goodrx-call", text: "Call GoodRx Gold and cancel", detail: "(855) 449-0865 · 8am–7pm CT. Cancel by name and by card." },
  { id: "drafts", text: "Send the GoodRx and Clipto cancellation drafts in Gmail", detail: "Clipto has already replied." },
  { id: "hbo", text: "Cancel HBO Max" },
  { id: "chatgpt", text: "Cancel ChatGPT" },
  { id: "ymca", text: "Cancel YMCA", detail: "Ask about the notice period and the last charge date." },
  { id: "spotify", text: "Start Spotify Student + Hulu ($5.99), then cancel Paramount+" },
  { id: "ladder", text: "Start Ladder", detail: "Free trial first if it's offered." },
  { id: "apps", text: "Delete Bank of America, Uber Eats and Target from your phone", detail: "Through January. Bills autopay from BofA regardless." },
  { id: "savings-acct", text: "Open a savings account not linked to the joint account", detail: "Set the $792 transfer for the 16th." },
  { id: "claude-billing", text: "Confirm Claude usage-based charges are off", detail: "Off, not just the plan downgraded — those are two different switches." },
  { id: "electric", text: "Pay the $341 electric on October 2" },
];

/** The questions. Nothing downstream gets decided until these have answers. */
export const OPEN_ITEMS: Task[] = [
  { id: "storage-counsel", text: "Storage case: get an attorney who will take on the arbitration clause",
    detail: "Chase the callbacks — John Day, Perry Craft, Lafferty, Aubrey Givens. The arbitration clause is the filter: not every firm will touch one." },
  { id: "carnote", text: "Find where the $510 car note is actually paid from",
    detail: "Not visible in Bank of America, Capital One or Cash App. Until it's found, the budget has a hole in it." },
  { id: "minimums", text: "Get the Capital One and Discover balances and minimums",
    detail: "So the $120 extra-debt line can be checked. If the minimums sit outside it, the plan is short every month." },
  { id: "erickson", text: "Erickson: whether he can stay the weekend of Sept 26–27",
    detail: "His answer is the data." },
];

/**
 * The storage case.
 *
 * Separated out because it is the only thing in this plan with a clock on it
 * that someone else set. Everything else can slip a week; a limitation period
 * cannot.
 *
 * The dates here are the plan's own wording — "likely", "about", "confirm with
 * counsel" — and they are carried through deliberately rather than hardened
 * into something that reads like legal advice. An approximate deadline she
 * knows is approximate is useful. One she thinks is exact is dangerous.
 */
export const STORAGE_CASE = {
  facility: "SROA, Goodlettsville",
  approxValue: 79000,
  claims: [
    { name: "Consumer Protection Act", note: "Likely expires around March 2027 — roughly one year. This is the one with the clock on it.", expires: "2027-03-01", approximate: true },
    { name: "Property tort", note: "Negligent bailment and conversion. Runs longer than the CPA claim, but confirm how much longer with counsel.", expires: null, approximate: true },
  ],
  /** What makes this hard to place, and the thing to lead every call with. */
  filter: "The contract has an arbitration clause. Not every firm will take one on — ask in the first minute, not the last.",
  contacts: [
    { id: "john-day",      name: "John Day" },
    { id: "perry-craft",   name: "Perry Craft" },
    { id: "lafferty",      name: "Lafferty" },
    { id: "aubrey-givens", name: "Aubrey Givens" },
  ],
  target: "Three to five consult calls, then pick one.",
};

/** Days until a claim runs out, or null when there is no date to count to. */
export function daysUntil(dateStr: string, from: string): number | null {
  if (!dateStr) return null;
  return Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
  );
}

export function phaseOn(date: string): Phase | null {
  return TIMELINE.find(p => {
    if (p.on) return p.on === date;
    return date >= p.from && (!p.to || date <= p.to);
  }) ?? null;
}

/** The stretch she's in, ignoring the single-date markers. */
export function currentPhase(date: string): Phase | null {
  return TIMELINE.find(p => !p.on && date >= p.from && (!p.to || date <= p.to)) ?? null;
}

export function nextUp(date: string, limit = 3): Phase[] {
  return TIMELINE.filter(p => (p.on ?? p.from) > date).slice(0, limit);
}
