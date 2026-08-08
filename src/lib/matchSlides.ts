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
  let prevWasMonth = false;

  for (const t of raw) {
    if (/^\d+$/.test(t)) {
      // A bare year is never a lecture number.
      if (t.length === 4 && Number(t) > 1900) { prevWasMonth = false; continue; }
      // "Aug 3" is a date. Counting the 3 as a lecture number is what makes a
      // deck for lecture 3 look like a match for a recording made on the 3rd.
      if (prevWasMonth) { prevWasMonth = false; continue; }
      numbers.push(String(Number(t)));
      continue;
    }

    if (MONTHS.has(t)) { prevWasMonth = true; continue; }
    prevWasMonth = false;

    // Course codes carry the lecture number welded to a prefix: BC1, LEC02,
    // PHYS3. Splitting them is the difference between matching her real files
    // and matching none of them.
    const split = t.match(/^([a-z]{1,6})(\d{1,3})$/);
    if (split) {
      const stem = split[1];
      if (!NOISE.has(stem) && stem.length > 1) words.push(stem);
      numbers.push(String(Number(split[2])));
      continue;
    }

    if (NOISE.has(t)) continue;
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

export interface MultiPairing<R, D> {
  recording: R;
  decks: D[];
}

/**
 * Every deck goes to its best-matching recording, and a recording may collect
 * several — one recording routinely covers two lectures, and therefore two
 * decks. Each deck is still used at most once, and assignment is best-first so
 * an ambiguous filename cannot displace a stronger match.
 */
export function pairDecks<R, D>(
  recordings: R[],
  decks: D[],
  nameOf: (x: R | D) => string,
  threshold = 0.35,
): { pairs: MultiPairing<R, D>[]; unmatchedDecks: D[] } {
  const scored: { r: number; d: number; s: number }[] = [];
  recordings.forEach((r, ri) => {
    decks.forEach((d, di) => {
      const s = similarity(nameOf(r), nameOf(d));
      if (s >= threshold) scored.push({ r: ri, d: di, s });
    });
  });
  scored.sort((x, y) => y.s - x.s);

  const takenD: Record<number, true> = {};
  const assigned: Record<number, number[]> = {};
  for (const { r, d } of scored) {
    if (takenD[d]) continue;
    takenD[d] = true;
    (assigned[r] ??= []).push(d);
  }

  return {
    pairs: recordings.map((r, ri) => ({
      recording: r,
      decks: (assigned[ri] ?? []).map(di => decks[di]),
    })),
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
