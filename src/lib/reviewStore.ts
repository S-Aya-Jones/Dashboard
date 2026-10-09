import { neonClient } from "@/lib/neon";
import type { Flashcard } from "@/types/dashboard";
import { MD } from "@/lib/srs";

// The review deck: every flashcard from every lecture, with its own schedule.
//
// The cards themselves already existed — one JSON blob per lecture, shown in
// the Flashcards tab as a pile you flip through and then forget. What was
// missing is the part that makes them work: a memory of how each individual
// card went, so the ones she keeps missing come back tomorrow and the ones she
// knows disappear for a month.
//
// The card text stays on the lecture. This table holds only the schedule,
// keyed by lecture and index, so regenerating a lecture's cards doesn't wipe
// months of review history — and a card whose text changed keeps its slot
// rather than starting from zero.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureReviewTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS review_cards (
      id            TEXT PRIMARY KEY,
      lecture_id    TEXT NOT NULL,
      card_index    INTEGER NOT NULL,
      state         TEXT NOT NULL DEFAULT 'new',
      interval      NUMERIC NOT NULL DEFAULT 0,
      ease_factor   NUMERIC NOT NULL DEFAULT 2.5,
      repetitions   INTEGER NOT NULL DEFAULT 0,
      lapses        INTEGER NOT NULL DEFAULT 0,
      learning_step INTEGER NOT NULL DEFAULT 0,
      next_review   TEXT NOT NULL,
      last_review   TEXT,
      UNIQUE (lecture_id, card_index)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS review_cards_due ON review_cards (next_review)`;
  await sql`
    CREATE TABLE IF NOT EXISTS review_log (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      card_id    TEXT NOT NULL,
      rating     INTEGER NOT NULL,
      day        TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS review_log_day ON review_log (day)`;
}

export interface DeckCard extends Flashcard {
  lectureId: string;
  cardIndex: number;
  course: string;
  lectureTitle: string;
}

interface LectureRow {
  id: string;
  title: string;
  course: string;
  flashcards: string | null;
}

/**
 * Every lecture card, married to its schedule.
 *
 * A card with no row yet is new rather than missing — the schedule table fills
 * itself in on first answer, so nothing has to be migrated or pre-seeded when
 * a lecture is processed.
 */
export async function loadDeck(): Promise<DeckCard[]> {
  await ensureReviewTables();
  const sql = db();

  const lectures = (await sql`
    SELECT id, title, course, flashcards FROM lectures
    WHERE flashcards IS NOT NULL AND flashcards <> '' AND flashcards <> '[]'
  `) as unknown as LectureRow[];

  const states = await sql`SELECT * FROM review_cards`;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const r of states) byKey.set(`${r.lecture_id}:${r.card_index}`, r);

  const out: DeckCard[] = [];
  for (const lec of lectures) {
    let cards: Array<{ front?: string; back?: string }> = [];
    try { cards = JSON.parse(lec.flashcards ?? "[]"); } catch { continue; }
    if (!Array.isArray(cards)) continue;

    cards.forEach((c, i) => {
      const front = String(c?.front ?? "").trim();
      const back = String(c?.back ?? "").trim();
      if (!front || !back) return;

      const row = byKey.get(`${lec.id}:${i}`);
      out.push({
        id: `${lec.id}:${i}`,
        lectureId: lec.id,
        cardIndex: i,
        course: lec.course ?? "",
        lectureTitle: lec.title ?? "",
        front, back,
        deck: lec.course ?? "Course",
        subject: lec.course ?? undefined,
        topic: lec.title ?? undefined,
        tags: [],
        createdAt: new Date().toISOString(),
        state: (row?.state as Flashcard["state"]) ?? "new",
        interval: row ? Number(row.interval) : 0,
        easeFactor: row ? Number(row.ease_factor) : MD.startEase,
        repetitions: row ? Number(row.repetitions) : 0,
        lapses: row ? Number(row.lapses) : 0,
        learningStep: row ? Number(row.learning_step) : 0,
        nextReview: (row?.next_review as string) ?? new Date().toISOString(),
        ...(row?.last_review ? { lastReview: row.last_review as string } : {}),
      });
    });
  }
  return out;
}

/** Write a card's new schedule, and log the answer for the streak. */
export async function saveCardState(
  id: string,
  next: Partial<Flashcard>,
  rating: number,
): Promise<void> {
  await ensureReviewTables();
  const sql = db();
  const [lectureId, idxRaw] = id.split(":");
  const cardIndex = Number(idxRaw);
  if (!lectureId || !Number.isFinite(cardIndex)) throw new Error("bad card id");

  await sql`
    INSERT INTO review_cards
      (id, lecture_id, card_index, state, interval, ease_factor, repetitions, lapses, learning_step, next_review, last_review)
    VALUES (${id}, ${lectureId}, ${cardIndex},
            ${next.state ?? "new"}, ${next.interval ?? 0}, ${next.easeFactor ?? MD.startEase},
            ${next.repetitions ?? 0}, ${next.lapses ?? 0}, ${next.learningStep ?? 0},
            ${next.nextReview ?? new Date().toISOString()}, ${next.lastReview ?? null})
    ON CONFLICT (lecture_id, card_index) DO UPDATE SET
      state = EXCLUDED.state,
      interval = EXCLUDED.interval,
      ease_factor = EXCLUDED.ease_factor,
      repetitions = EXCLUDED.repetitions,
      lapses = EXCLUDED.lapses,
      learning_step = EXCLUDED.learning_step,
      next_review = EXCLUDED.next_review,
      last_review = EXCLUDED.last_review
  `;

  const day = new Date().toISOString().slice(0, 10);
  await sql`INSERT INTO review_log (card_id, rating, day) VALUES (${id}, ${rating}, ${day})`;
}

/** Distinct days with at least one answer, newest first — feeds the streak. */
export async function reviewDays(limit = 400): Promise<string[]> {
  await ensureReviewTables();
  const sql = db();
  const rows = await sql`
    SELECT DISTINCT day FROM review_log ORDER BY day DESC LIMIT ${limit}
  `;
  return rows.map(r => String(r.day));
}

/** How many answers today — the daily goal ring. */
export async function reviewedToday(): Promise<number> {
  await ensureReviewTables();
  const sql = db();
  const day = new Date().toISOString().slice(0, 10);
  const rows = await sql`SELECT COUNT(*) AS n FROM review_log WHERE day = ${day}`;
  return Number(rows[0]?.n ?? 0);
}
