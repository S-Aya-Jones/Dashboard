import type { Cat } from "@/lib/weekPlan";

// Temporary schedules.
//
// weekPlan.ts is the recurring week. This is what sits on top of it for a
// handful of named dates and then gets out of the way — a catch-up weekend, an
// exam week, the week she's away. Every change carries a date, so a temporary
// week expires by itself rather than quietly becoming the new normal.
//
// Two things feed the same shape: the weeks written here, and the one-off
// changes she saves by voice on /schedule (table `schedule_overrides`). Both
// render identically wherever a schedule is shown.

export interface DatedChange {
  /** Stable enough for a React key; not a database id. */
  id: string;
  /** The single day this applies to, YYYY-MM-DD. */
  date: string;
  /** A move is a cancel plus an add — two entries, not a third verb. */
  kind: "add" | "cancel";
  /** For add: what to call it. For cancel: which block to strike. */
  label: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  cat?: Cat;
}

export interface TempWeek {
  id: string;
  name: string;
  /** One line, shown at the top of the day. Why today doesn't look normal. */
  why: string;
  from: string;
  to: string;
  changes: DatedChange[];
}

function add(
  date: string, start: string, end: string, label: string, cat: Cat, note?: string,
): DatedChange {
  return { id: `${date}-${start}-add`, date, kind: "add", label, startTime: start, endTime: end, note: note ?? null, cat };
}

function cut(date: string, label: string, note?: string): DatedChange {
  return { id: `${date}-${label}-cut`, date, kind: "cancel", label, startTime: null, endTime: null, note: note ?? null };
}

// ── Recovery, Sep 24 to Oct 6 ─────────────────────────────────────────────
//
// From the break plan: "Rest, sleep, food, therapy, short walks. Nothing
// scheduled beyond the cleanup list. Physical recovery is the job."
//
// So this strips the Oct-7 week back to work, therapy, food, sleep and the
// journal, and puts a walk where the workout would be. It is written as a
// temporary week rather than as the normal one because it expires by itself on
// October 7 — which is the only way a rest fortnight doesn't quietly become the
// new baseline, and the only way the real plan starts on time without her
// having to remember to switch it on.

const RECOVERY: DatedChange[] = (() => {
  const out: DatedChange[] = [];
  const from = new Date("2026-09-24T12:00:00");
  const to = new Date("2026-10-06T12:00:00");

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dow = d.getDay();

    // Everything the plan says to stop doing for a fortnight.
    out.push(cut(date, "Bio and gen chem foundations", "Not this fortnight. Recovery is the job."));
    out.push(cut(date, "Job search", "Starts October 7."));
    out.push(cut(date, "Ladder workout", "Walks instead until the 7th."));
    out.push(cut(date, "Driving exposure", "Exposures restart October 7."));
    out.push(cut(date, "Shadowing", "From November."));
    out.push(cut(date, "Cleaning reset"));

    // Weekdays: a walk after work, then nothing asked of her.
    if (dow >= 1 && dow <= 5) {
      out.push(add(date, "15:00", "15:30", "Short walk", "gym", "Outside, no pace, no distance. That's the whole thing."));
      // Friday hands over to Deandra at six, so the empty stretch ends there.
      out.push(add(date, "15:30", dow === 5 ? "18:00" : "18:30", "Nothing scheduled", "rest",
        "On purpose. Sleep, food, sitting down all count."));
    }
    if (dow === 6) {
      out.push(add(date, "09:00", "09:30", "Short walk", "gym"));
      out.push(add(date, "13:00", "18:00", "Nothing scheduled", "rest", "The whole afternoon. Don't fill it."));
    }
  }

  // The dated things that do have to happen.
  out.push(add("2026-10-02", "14:35", "14:55", "PAY THE ELECTRIC — $341", "life",
    "Same day the short check lands. This one is not optional."));
  out.push(add("2026-09-26", "10:00", "11:30", "Cleanup list — the calls", "life",
    "GoodRx (855) 449-0865, 8am\u20137pm CT. Then HBO Max, ChatGPT, YMCA. Ask YMCA about notice period and last charge date."));
  out.push(add("2026-09-27", "17:00", "18:00", "Open the new savings account", "life",
    "Not linked to the joint account. Set the $792 transfer for the 16th."));

  return out;
})();


export const TEMP_WEEKS: TempWeek[] = [
  {
    id: "recovery-2026",
    name: "Recovery",
    why: "Rest, sleep, food, therapy, short walks. Nothing scheduled beyond the cleanup list — physical recovery is the job until October 7.",
    from: "2026-09-24",
    to: "2026-10-06",
    changes: RECOVERY,
  },
];

/** The temporary week covering a date, if there is one. */
export function tempWeekFor(date: string): TempWeek | null {
  return TEMP_WEEKS.find(w => date >= w.from && date <= w.to) ?? null;
}

/** Every built-in change landing between two dates, inclusive. */
export function tempChangesBetween(from: string, to: string): DatedChange[] {
  return TEMP_WEEKS.flatMap(w => w.changes).filter(c => c.date >= from && c.date <= to);
}

// Saved overrides carry no category — they arrive as a label and a time. This
// picks a colour from the words so a voice-added block doesn't render grey
// next to everything else.
const CAT_WORDS: Array<[RegExp, Cat]> = [
  [/gym|workout|lift|run|walk/i, "gym"],
  [/study|lecture|review|quiz|exam|test|retriev|flashcard|mcat|biochem|physio|micro|cmb|molecular/i, "study"],
  [/work|class|shift|office/i, "work"],
  [/therapy|therapist|counsel/i, "therapy"],
  [/drive|driving|exposure|heights/i, "exposure"],
  [/lawyer|legal|cook|laundry|clean|grocer|budget|bill|errand|dinner|lunch|breakfast/i, "life"],
  [/church|family|friend|deandra|call|visit|birthday|shadow/i, "people"],
  [/skincare|bed|sleep|rest|break|wind|buffer/i, "rest"],
];

export function catFor(label: string, fallback: Cat = "life"): Cat {
  for (const [re, cat] of CAT_WORDS) if (re.test(label)) return cat;
  return fallback;
}
