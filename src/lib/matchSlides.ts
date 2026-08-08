// Pairing slide decks with lecture recordings by filename.
//
// Course files are named by whoever posted them, so the recording and the deck
// for one lecture usually share most of a name and differ in the noise around
// it: "Lecture 1-2 Aug-3_S Misra(1).mp4" against "Lecture 1-2 Aug-3 S Misra.pdf".
// The signal that matters most is the lecture number — pairing lecture 3's
// slides onto lecture 4's recording would quietly poison a set of notes — so
// numbers are treated as near-decisive rather than as just more words.

const NOISE = new Set([
  "lecture", "lec", "lect", "recording", "recorded", "rec", "video", "audio",
  "slides", "slide", "deck", "powerpoint", "ppt", "pdf", "notes", "class",
  "final", "copy", "new", "updated", "revised", "part", "session", "zoom",
  "the", "a", "of", "and", "for", "with", "on", "in",
]);

const MONTHS = new Set([
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may",
  "jun", "june", "jul", "july", "aug", "august", "sep", "sept", "september",
  "oct", "october", "nov", "november", "dec", "december",
]);

export function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
}

interface Parsed {
  words: string[];
  numbers: string[];
}

function parse(filename: string): Parsed {
  const base = stripExtension(filename)
    .toLowerCase()
    // "(1)" and "- copy" are duplicate-download artefacts, never content.
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const raw = base.split(/\s+/).filter(Boolean);
  const words: string[] = [];
  const numbers: string[] = [];

  for (const t of raw) {
    if (/^\d+$/.test(t)) {
      // A bare year or a day-of-month carries no lecture identity.
      if (t.length === 4 && Number(t) > 1900) continue;
      numbers.push(String(Number(t)));
      continue;
    }
    if (NOISE.has(t) || MONTHS.has(t)) continue;
    if (t.length === 1) continue;
    words.push(t);
  }
  return { words, numbers };
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0;
  const ua = a.filter((w, i) => a.indexOf(w) === i);
  const ub = b.filter((w, i) => b.indexOf(w) === i);
  const shared = ua.filter(w => ub.indexOf(w) >= 0).length;
  const union = ua.length + ub.length - shared;
  return union ? shared / union : 0;
}

/**
 * 0–1. Above ~0.35 is a confident pair; the caller decides the threshold.
 * Disagreeing lecture numbers force the score to zero — a wrong pairing is
 * worse than no pairing, because it corrupts the notes silently.
 */
export function similarity(recording: string, deck: string): number {
  const a = parse(recording);
  const b = parse(deck);

  const bothNumbered = a.numbers.length > 0 && b.numbers.length > 0;
  const sharedNumber = a.numbers.some(n => b.numbers.includes(n));
  if (bothNumbered && !sharedNumber) return 0;

  const wordScore = jaccard(a.words, b.words);

  // Matching numbers are strong evidence on their own: decks are often named
  // with just the lecture number where the recording carries the topic too.
  if (bothNumbered && sharedNumber) return Math.min(1, 0.55 + wordScore * 0.45);
  return wordScore;
}

export interface Pairing<R, D> {
  recording: R;
  deck: D | null;
}

/**
 * Greedy best-first pairing. Each deck is used at most once, and only the
 * strongest remaining pair is taken at each step, so one ambiguous filename
 * cannot cascade into a chain of wrong assignments.
 */
export function pairDecks<R, D>(
  recordings: R[],
  decks: D[],
  nameOf: (x: R | D) => string,
  threshold = 0.35,
): { pairs: Pairing<R, D>[]; unmatchedDecks: D[] } {
  const scored: { r: number; d: number; s: number }[] = [];
  recordings.forEach((r, ri) => {
    decks.forEach((d, di) => {
      const s = similarity(nameOf(r), nameOf(d));
      if (s >= threshold) scored.push({ r: ri, d: di, s });
    });
  });
  scored.sort((x, y) => y.s - x.s);

  const takenR: Record<number, true> = {};
  const takenD: Record<number, true> = {};
  const assigned: Record<number, number> = {};
  for (const { r, d } of scored) {
    if (takenR[r] || takenD[d]) continue;
    takenR[r] = true;
    takenD[d] = true;
    assigned[r] = d;
  }

  return {
    pairs: recordings.map((r, ri) => {
      const di = assigned[ri];
      return { recording: r, deck: di === undefined ? null : decks[di] };
    }),
    unmatchedDecks: decks.filter((_, di) => !takenD[di]),
  };
}

const DECK_RE = /\.(pdf|pptx)$/i;
const MEDIA_RE = /\.(mp4|m4a|mp3|wav|mov|webm|aac|ogg|mkv|avi|flac)$/i;

export function isDeck(file: { name: string; type?: string }): boolean {
  return DECK_RE.test(file.name)
    || file.type === "application/pdf"
    || (file.type ?? "").includes("presentationml");
}

export function isMedia(file: { name: string; type?: string }): boolean {
  if (isDeck(file)) return false;
  return MEDIA_RE.test(file.name)
    || (file.type ?? "").startsWith("audio/")
    || (file.type ?? "").startsWith("video/");
}
