import type { JournalEntry } from "@/types/dashboard";

// The journal, from the break plan of 24 September 2026.
//
// These prompts are hers, written out of one specific week — not a generic
// gratitude list. That's the whole point of them, so they are typed here
// verbatim rather than paraphrased or "improved".
//
// Three things the plan asks for that a plain journal wouldn't do:
//
//   One prompt a day, weighted toward whatever theme has been logged least in
//   the last seven days. Left to pick freely she'd answer the comfortable ones
//   and never the hard ones, which is exactly the avoidance the first theme is
//   about.
//
//   Prayer mode: the same entry flow, tagged separately, no prompts. Being
//   honest with God is not a journalling exercise and shouldn't come with a
//   worksheet attached.
//
//   A Sunday review that writes itself, because the numbers only help if
//   they're written down.

export type Tag =
  | "avoidance" | "phobia" | "spending" | "needs" | "defensiveness"
  | "friends" | "erickson" | "saturday" | "children" | "god" | "weekly";

export const TAGS: Tag[] = [
  "avoidance", "phobia", "spending", "needs", "defensiveness",
  "friends", "erickson", "saturday", "children", "god", "weekly",
];

export const TAG_LABEL: Record<Tag, string> = {
  avoidance:     "Avoidance",
  phobia:        "The phobia",
  spending:      "Spending",
  needs:         "Needing",
  defensiveness: "Defensiveness",
  friends:       "Friends",
  erickson:      "Erickson",
  saturday:      "Saturday",
  children:      "Children",
  god:           "God",
  weekly:        "Weekly review",
};

// Warm palette only. Distinct enough to tell apart as small chips.
export const TAG_COLOR: Record<Tag, string> = {
  avoidance:     "#C0562A",
  phobia:        "#E0A44A",
  spending:      "#C9A227",
  needs:         "#C9748A",
  defensiveness: "#B4552F",
  friends:       "#3F6F5E",
  erickson:      "#8A7A66",
  saturday:      "#9C6B58",
  children:      "#71816D",
  god:           "#2E6FBF",
  weekly:        "#6B5D53",
};

export interface Theme {
  tag: Tag;
  title: string;
  /** The line under the heading in the plan, where there is one. */
  intro?: string;
  prompts: string[];
}

export const THEMES: Theme[] = [
  {
    tag: "avoidance",
    title: "Avoidance",
    intro: "This is the one under most of the others. Avoidance feels like relief and always costs more later.",
    prompts: [
      "What did I avoid today, and what did it cost me to avoid it?",
      "What am I not opening, not answering, not saying right now?",
      "When I finally dealt with the thing I'd been dodging, was it as bad as I'd built it up to be?",
    ],
  },
  {
    tag: "phobia",
    title: "The phobia",
    intro: "Exposures work like the budget: reps, not insight. Journal the data.",
    prompts: [
      "What did I do today, how long, what was the peak fear number, and what happened in my body?",
      "What did I tell myself right before I stopped, and was it true?",
      "What would I do this week if the fear were ten points lower?",
    ],
  },
  {
    tag: "spending",
    title: "Spending as comfort",
    prompts: [
      "What was I feeling in the minute before I bought it?",
      "What was I hoping it would fix?",
      "What actually would have helped instead, and why didn't I do that?",
    ],
  },
  {
    tag: "needs",
    title: "Neediness, and whether that's the right word",
    intro: "Needing someone with you after a hard thing isn't needy. Needing someone to read your mind and then punishing them when they don't is a different thing. Sort those out.",
    prompts: [
      "What did I need today, and did I say it out loud or wait for someone to guess?",
      "Was I asking for help, or testing whether someone would offer?",
      "What would I have to believe about myself to ask directly?",
    ],
  },
  {
    tag: "defensiveness",
    title: "Defensiveness",
    prompts: [
      "What did I push back on today, and was I defending a position or defending myself?",
      "When someone was right about me this week, how long did it take me to admit it?",
      "What criticism am I most afraid is true?",
    ],
  },
  {
    tag: "friends",
    title: "Being a better friend to Bianca (and Deandra)",
    intro: "Bianca flew in. Deandra funded you. The question isn't whether you're grateful. It's whether the friendship runs both ways.",
    prompts: [
      "What's going on in Bianca's life right now that isn't about me? Do I actually know?",
      "Of our last ten conversations, how many were about my crisis?",
      "What could I do for her this week that costs me something?",
      "What do I owe Deandra that isn't money?",
    ],
  },
  {
    tag: "erickson",
    title: "Erickson",
    prompts: [
      "What do I actually want from him, separate from what I wanted last weekend?",
      "What did I decide about him this week that I should un-decide until I'm rested?",
      "Am I angry at him, or at being alone Saturday, or at myself for getting here?",
    ],
  },
  {
    tag: "saturday",
    title: "Saturday, and the body",
    prompts: [
      "What do I remember, and what does my body do when I remember it?",
      "What was I most afraid of in the worst hour?",
      "What did I learn about what I can survive?",
    ],
  },
  {
    tag: "children",
    title: "The children question",
    prompts: [
      "When I said never, what was I feeling?",
      "What would have to be different for me to feel differently?",
    ],
  },
  {
    tag: "god",
    title: "Relationship with God",
    intro: "Be as honest with God as you've been with a stranger this week. He can take it.",
    prompts: [
      "What am I angry at God about, and have I said it to Him?",
      "Where did I feel held this week, even a little?",
      "What am I asking for, and what am I afraid to ask for?",
      "What do I need to confess, not as performance, but because carrying it is heavier than saying it?",
    ],
  },
  {
    tag: "weekly",
    title: "Weekly review",
    intro: "Sundays.",
    prompts: [
      "What did I avoid this week? What did I face?",
      "One thing I did for someone else.",
      "One thing I'm proud of that no one saw.",
      "The numbers: savings balance, exposures done, workouts done, applications sent. Write them down. Reality is the friend here.",
    ],
  },
];

export const THEME_BY_TAG: Record<Tag, Theme> =
  Object.fromEntries(THEMES.map(t => [t.tag, t])) as Record<Tag, Theme>;

/** The Sunday review, written out so she fills it in rather than composes it. */
export const SUNDAY_TEMPLATE = `What did I avoid this week? What did I face?


One thing I did for someone else.


One thing I'm proud of that no one saw.


The numbers —
Savings balance:
Exposures done:
Workouts done:
Applications sent:
`;

function daysAgo(iso: string, today: string): number {
  return Math.round(
    (new Date(`${today}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86400000,
  );
}

/**
 * How many times each theme has been written about in the last seven days.
 *
 * The weekly-review tag is left out of the weighting: it's a Sunday fixture,
 * not a theme competing for attention, and counting it would make Monday
 * always offer the review again.
 */
export function recentCounts(entries: JournalEntry[], today: string): Record<Tag, number> {
  const counts = Object.fromEntries(TAGS.map(t => [t, 0])) as Record<Tag, number>;
  for (const e of entries) {
    const age = daysAgo(e.date, today);
    if (age < 0 || age > 6) continue;
    for (const t of e.tags ?? []) {
      if (t in counts) counts[t as Tag]++;
    }
  }
  return counts;
}

/**
 * Today's theme: whichever has been logged least this week.
 *
 * Ties break on a date-derived rotation rather than at random, so opening the
 * page twice doesn't change the question — and so a week of writing nothing
 * doesn't offer the same theme seven days running.
 */
export function themeFor(entries: JournalEntry[], today: string): Theme {
  const d = new Date(`${today}T12:00:00`);
  if (d.getDay() === 0) return THEME_BY_TAG.weekly;

  const counts = recentCounts(entries, today);
  const pool = THEMES.filter(t => t.tag !== "weekly");
  const min = Math.min(...pool.map(t => counts[t.tag]));
  const leastLogged = pool.filter(t => counts[t.tag] === min);

  const seed = today.split("-").reduce((n, p) => n * 31 + Number(p), 7);
  return leastLogged[seed % leastLogged.length];
}

/** One prompt from the theme, stable within a day. */
export function promptFor(theme: Theme, today: string): string {
  const seed = today.split("-").reduce((n, p) => n * 17 + Number(p), 3);
  return theme.prompts[seed % theme.prompts.length];
}

/** A rough word count, for the "you wrote N words" line. */
export function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Longest run of consecutive days with at least one entry, ending today. */
export function journalStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  const d = new Date(`${today}T12:00:00`);
  // Today not yet written doesn't break a streak that's alive through yesterday.
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!set.has(iso)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Has the Sunday review already been written for the week containing `today`? */
export function sundayDone(entries: JournalEntry[], today: string): boolean {
  const d = new Date(`${today}T12:00:00`);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  const iso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
  return entries.some(e => e.date >= iso && (e.tags ?? []).includes("weekly"));
}
