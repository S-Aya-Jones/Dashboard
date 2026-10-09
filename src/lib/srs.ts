import { format, addDays } from "date-fns";
import type { Flashcard } from "@/types/dashboard";

// The spaced-repetition scheduler.
//
// Lifted out of components/mcat/AnkiView.tsx, where it had been doing real work
// for one deck and one page. Her course flashcards — the ones generated from
// each lecture, which are the cards that decide her actual grades — never
// touched it. A second implementation for those would have drifted from this
// one within a week, so there is now exactly one.
//
// Miles Down / Anki SM-2:
//   Learning steps 1m, 10m · graduate at 1d · Easy 4d
//   Ease starts 2.5 · Hard ×1.2 and −0.15 ease · Easy ×1.3 and +0.15 ease
//   Lapse: relearn at 10m, interval resets, ease −0.2

export type Rating = 0 | 1 | 2 | 3;

export const RATING_LABEL: Record<Rating, string> = {
  0: "Again", 1: "Hard", 2: "Good", 3: "Easy",
};

export const MD = {
  learnSteps:    [1, 10],
  relearnSteps:  [10],
  graduateInt:   1,
  easyInt:       4,
  startEase:     2.5,
  hardMult:      1.2,
  easyBonus:     1.3,
  intMod:        1.0,
  newIntMult:    0.0,
  maxInt:        36500,
};

function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

/** The card's next state after a rating. Pure — callers persist the result. */
export function schedule(card: Flashcard, rating: Rating): Partial<Flashcard> {
  const now = new Date();
  const ef  = card.easeFactor ?? MD.startEase;

  if (card.state === "new" || card.state === "learning") {
    if (rating === 0) {
      return { state: "learning", learningStep: 0, nextReview: minutesFromNow(MD.learnSteps[0]), lastReview: now.toISOString() };
    }
    if (rating === 1) {
      const step = MD.learnSteps[card.learningStep] ?? MD.learnSteps[MD.learnSteps.length - 1];
      return { state: "learning", learningStep: card.learningStep, nextReview: minutesFromNow(step), lastReview: now.toISOString() };
    }
    if (rating === 3) {
      return { state: "review", interval: MD.easyInt, learningStep: 0, repetitions: 1, easeFactor: Math.min(3.0, ef + 0.15), nextReview: format(addDays(now, MD.easyInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
    }
    const next = card.learningStep + 1;
    if (next >= MD.learnSteps.length) {
      return { state: "review", interval: MD.graduateInt, learningStep: 0, repetitions: 1, nextReview: format(addDays(now, MD.graduateInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
    }
    return { state: "learning", learningStep: next, nextReview: minutesFromNow(MD.learnSteps[next]), lastReview: now.toISOString() };
  }

  if (card.state === "relearning") {
    if (rating === 0) {
      return { state: "relearning", learningStep: 0, nextReview: minutesFromNow(MD.relearnSteps[0]), lastReview: now.toISOString() };
    }
    const newInt = Math.max(1, Math.round(card.interval * MD.newIntMult) || 1);
    return { state: "review", interval: newInt, learningStep: 0, repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }

  // Review state
  if (rating === 0) {
    const newInt = Math.max(1, Math.round(card.interval * MD.newIntMult) || 1);
    return { state: "relearning", learningStep: 0, interval: newInt, lapses: (card.lapses ?? 0) + 1, easeFactor: Math.max(1.3, ef - 0.2), nextReview: minutesFromNow(MD.relearnSteps[0]), lastReview: now.toISOString() };
  }
  if (rating === 1) {
    const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * MD.hardMult * MD.intMod)));
    return { state: "review", interval: newInt, easeFactor: Math.max(1.3, ef - 0.15), repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }
  if (rating === 2) {
    const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * ef * MD.intMod)));
    return { state: "review", interval: newInt, repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
  }
  const newInt = Math.min(MD.maxInt, Math.max(card.interval + 1, Math.round(card.interval * ef * MD.easyBonus * MD.intMod)));
  return { state: "review", interval: newInt, easeFactor: Math.min(3.0, ef + 0.15), repetitions: card.repetitions + 1, nextReview: format(addDays(now, newInt), "yyyy-MM-dd"), lastReview: now.toISOString() };
}

/** "10m", "3d", "2w" — what each button will do, shown on the button. */
export function previewInterval(card: Flashcard, rating: Rating): string {
  const updated = schedule(card, rating);
  if (updated.state === "learning" || updated.state === "relearning") {
    const ms  = new Date(updated.nextReview as string).getTime() - Date.now();
    const min = Math.max(1, Math.round(ms / 60_000));
    return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
  }
  const days = updated.interval ?? 1;
  if (days < 7)   return `${days}d`;
  if (days < 30)  return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

/**
 * Is this card due?
 *
 * Learning and relearning cards carry a timestamp and come back within the
 * session; review cards carry a date and are due from the start of that day.
 */
export function isDue(card: Flashcard, now: Date = new Date()): boolean {
  if (!card.nextReview) return true;
  // A card never studied is available immediately — the daily new-card limit
  // is what paces them, not the clock. Without this line new cards fell to the
  // date comparison below and were tested as an ISO timestamp against a plain
  // date: "2026-08-15T00:30:00Z" > "2026-08-15", so every new card read as not
  // due and the queue was permanently empty.
  if (card.state === "new") return true;
  if (card.state === "learning" || card.state === "relearning") {
    return new Date(card.nextReview).getTime() <= now.getTime();
  }
  // Review cards carry a plain date. Trim anything longer so a timestamp that
  // sneaks in still compares correctly.
  return card.nextReview.slice(0, 10) <= format(now, "yyyy-MM-dd");
}

/** A brand-new card, ready to be scheduled for the first time. */
export function newCard(
  fields: { id: string; front: string; back: string; deck: string; subject?: string; topic?: string; tags?: string[] },
): Flashcard {
  return {
    ...fields,
    tags: fields.tags ?? [],
    createdAt: new Date().toISOString(),
    state: "new",
    interval: 0,
    easeFactor: MD.startEase,
    repetitions: 0,
    lapses: 0,
    learningStep: 0,
    nextReview: new Date().toISOString(),
  };
}

export interface DueCounts {
  new: number;
  learning: number;
  review: number;
  total: number;
}

export function dueCounts(cards: Flashcard[], now: Date = new Date()): DueCounts {
  const due = cards.filter(c => isDue(c, now));
  return {
    new:      due.filter(c => c.state === "new").length,
    learning: due.filter(c => c.state === "learning" || c.state === "relearning").length,
    review:   due.filter(c => c.state === "review").length,
    total:    due.length,
  };
}

/**
 * The order to show due cards in.
 *
 * Learning first — those are mid-session and lose the most from waiting — then
 * review, then new. Interleaving new cards among reviews would let a big import
 * bury the reviews she actually needs today.
 */
export function dueQueue(cards: Flashcard[], newLimit = 20, now: Date = new Date()): Flashcard[] {
  const due = cards.filter(c => isDue(c, now));
  const rank = (c: Flashcard) =>
    c.state === "learning" || c.state === "relearning" ? 0 : c.state === "review" ? 1 : 2;
  const sorted = [...due].sort((a, b) => rank(a) - rank(b) || (a.nextReview ?? "").localeCompare(b.nextReview ?? ""));
  const fresh = sorted.filter(c => c.state === "new").slice(0, newLimit);
  return [...sorted.filter(c => c.state !== "new"), ...fresh];
}

/**
 * Consecutive days with at least one review, counting back from today.
 *
 * A streak that breaks because she studied at 11:59pm and then 12:01am would
 * be measuring clocks rather than effort, so this works in whole local days.
 */
export function streakFrom(dates: string[], today: string = format(new Date(), "yyyy-MM-dd")): number {
  const seen = new Set(dates);
  let n = 0;
  const cursor = new Date(`${today}T12:00:00`);
  // Today not being done yet shouldn't zero a real streak, so start from
  // yesterday when today is empty.
  if (!seen.has(format(cursor, "yyyy-MM-dd"))) cursor.setDate(cursor.getDate() - 1);
  while (seen.has(format(cursor, "yyyy-MM-dd"))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
