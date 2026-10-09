import { neonClient } from "@/lib/neon";

// Exam Practice — spaced repetition for whatever course is in front of her.
//
// Deliberately course-agnostic. Microbiology Exam 1 is the first thing loaded
// and organic chemistry follows through the import route, so nothing here may
// know what a microbe is: a course is a row, a chapter is a row, and the only
// thing the code understands is "cards that are due".
//
// Table names come straight from the build spec. Note for anyone reading later:
// `review` here is NOT `review_cards` / `review_log`, which belong to the older
// lecture-flashcard deck under /review. Two schedulers, different sources.

/**
 * The shape both drivers share: a tagged template that resolves to rows.
 *
 * Everything in this module takes an optional client so the seed script can
 * hand in a plain-Postgres one. Without that the script could only ever be
 * tested against the live database, which is the last place you want to find
 * out an import is wrong.
 */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

function db(client?: Sql): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url) as unknown as Sql;
}

/** A card counts as learned once it has been pulled correctly twice running. */
export const KNOWN_STREAK = 2;

/** Days to the next sighting, by streak. Index 0 is the first correct pull. */
export const HARD_STEPS = [1, 2, 4, 8, 15];
export const EASY_STEPS = [2, 4, 8, 16, 30];

export type Grade = "again" | "hard" | "easy";
export type CardKind = "cloze" | "basic" | "rev" | "img";

export async function ensureExamPracticeTables(client?: Sql) {
  const sql = db(client);
  await sql`
    CREATE TABLE IF NOT EXISTS course (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      term       TEXT,
      exam_name  TEXT,
      exam_date  DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chapter (
      id        SERIAL PRIMARY KEY,
      course_id INT REFERENCES course(id) ON DELETE CASCADE,
      ordinal   INT NOT NULL,
      name      TEXT NOT NULL,
      active    BOOLEAN DEFAULT TRUE,
      UNIQUE (course_id, ordinal)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS card (
      id         SERIAL PRIMARY KEY,
      chapter_id INT REFERENCES chapter(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      prompt     TEXT NOT NULL,
      answer     TEXT NOT NULL,
      extra      TEXT,
      full_text  TEXT,
      tags       TEXT[] DEFAULT '{}'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS review (
      id            SERIAL PRIMARY KEY,
      card_id       INT REFERENCES card(id) ON DELETE CASCADE,
      streak        INT DEFAULT 0,
      interval_days INT DEFAULT 0,
      due_at        TIMESTAMPTZ DEFAULT NOW(),
      lapses        INT DEFAULT 0,
      last_grade    TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS review_due_at_idx ON review (due_at)`;
  // Every session query filters due cards by chapter, which without this means
  // a sequential scan of 944 rows per screen paint.
  await sql`CREATE INDEX IF NOT EXISTS card_chapter_idx ON card (chapter_id)`;
  await sql`CREATE INDEX IF NOT EXISTS review_card_idx ON review (card_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS study_session (
      id            SERIAL PRIMARY KEY,
      course_id     INT REFERENCES course(id),
      started_at    TIMESTAMPTZ DEFAULT NOW(),
      ended_at      TIMESTAMPTZ,
      planned_min   INT,
      actual_sec    INT,
      cards_seen    INT DEFAULT 0,
      cards_correct INT DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS glossary (
      id         SERIAL PRIMARY KEY,
      course_id  INT REFERENCES course(id) ON DELETE CASCADE,
      term       TEXT NOT NULL,
      definition TEXT NOT NULL,
      UNIQUE (course_id, term)
    )
  `;
}

// ── Seeding ──────────────────────────────────────────────────────────────────

/** One chapter as it arrives in a course JSON file. */
export interface ImportChapter {
  name: string;
  cards: Array<{
    t?: string;
    q?: string;
    a?: string;
    why?: string;
    full?: string;
    [k: string]: unknown;
  }>;
}

export interface ImportResult {
  courseId: number;
  chapters: number;
  cards: number;
  reviews: number;
  glossary: number;
  replaced: boolean;
}

const KINDS: ReadonlySet<string> = new Set(["cloze", "basic", "rev", "img"]);

/**
 * Split "02 Cytology I: Cell Structures" into ordinal 2 and the rest.
 *
 * Falls back to the file's own ordering when a name doesn't start with a
 * number, so a course exported by hand still imports instead of throwing.
 */
export function splitChapterName(raw: string, fallbackOrdinal: number): { ordinal: number; name: string } {
  const at = raw.indexOf(" ");
  if (at > 0) {
    const head = raw.slice(0, at);
    if (/^\d+$/.test(head)) {
      return { ordinal: parseInt(head, 10), name: raw.slice(at + 1).trim() };
    }
  }
  return { ordinal: fallbackOrdinal, name: raw.trim() };
}

/**
 * Load a course, replacing it if one with the same name and exam already
 * exists.
 *
 * Idempotent on purpose: re-running the seed after fixing a typo in the source
 * JSON should leave one copy of the course, not two. Deleting the chapters
 * cascades to cards and to their review rows, so a re-seed does discard
 * schedule history — which is the right trade for a re-import of the same
 * material, and why the import route asks before replacing.
 */
export async function importCourse(opts: {
  courseName: string;
  term?: string | null;
  examName?: string | null;
  examDate?: string | null;
  chapters: ImportChapter[];
  glossary?: Record<string, string> | null;
}, client?: Sql): Promise<ImportResult> {
  await ensureExamPracticeTables(client);
  const sql = db(client);

  const term = opts.term ?? null;
  const examName = opts.examName ?? null;

  const existing = (await sql`
    SELECT id FROM course
    WHERE name = ${opts.courseName}
      AND exam_name IS NOT DISTINCT FROM ${examName}
    ORDER BY id LIMIT 1
  `) as unknown as Array<{ id: number }>;

  let courseId: number;
  const replaced = existing.length > 0;

  if (replaced) {
    courseId = existing[0].id;
    // Chapters cascade to cards, which cascade to reviews.
    await sql`DELETE FROM chapter WHERE course_id = ${courseId}`;
    await sql`DELETE FROM glossary WHERE course_id = ${courseId}`;
    await sql`
      UPDATE course SET term = ${term}, exam_name = ${examName}
      WHERE id = ${courseId}
    `;
    if (opts.examDate) {
      await sql`UPDATE course SET exam_date = ${opts.examDate} WHERE id = ${courseId}`;
    }
  } else {
    const rows = (await sql`
      INSERT INTO course (name, term, exam_name, exam_date)
      VALUES (${opts.courseName}, ${term}, ${examName}, ${opts.examDate ?? null})
      RETURNING id
    `) as unknown as Array<{ id: number }>;
    courseId = rows[0].id;
  }

  let cards = 0;
  let reviews = 0;

  for (let i = 0; i < opts.chapters.length; i++) {
    const raw = opts.chapters[i];
    const { ordinal, name } = splitChapterName(String(raw?.name ?? ""), i + 1);

    const chRows = (await sql`
      INSERT INTO chapter (course_id, ordinal, name)
      VALUES (${courseId}, ${ordinal}, ${name})
      RETURNING id
    `) as unknown as Array<{ id: number }>;
    const chapterId = chRows[0].id;

    for (const c of raw?.cards ?? []) {
      const kind = String(c?.t ?? "").trim();
      const prompt = String(c?.q ?? "").trim();
      const answer = String(c?.a ?? "").trim();
      // A card with no prompt or no answer can only ever waste her time.
      if (!KINDS.has(kind) || !prompt || !answer) continue;

      const extra = c?.why != null ? String(c.why) : null;
      const fullText = c?.full != null ? String(c.full) : null;

      // One statement per card, so a card and its schedule can never disagree.
      const inserted = (await sql`
        WITH new_card AS (
          INSERT INTO card (chapter_id, kind, prompt, answer, extra, full_text)
          VALUES (${chapterId}, ${kind}, ${prompt}, ${answer}, ${extra}, ${fullText})
          RETURNING id
        ), new_review AS (
          INSERT INTO review (card_id) SELECT id FROM new_card RETURNING id
        )
        SELECT (SELECT COUNT(*) FROM new_card) AS c, (SELECT COUNT(*) FROM new_review) AS r
      `) as unknown as Array<{ c: number; r: number }>;
      cards += Number(inserted[0]?.c ?? 0);
      reviews += Number(inserted[0]?.r ?? 0);
    }
  }

  let glossaryCount = 0;
  for (const [term_, definition] of Object.entries(opts.glossary ?? {})) {
    const t = term_.trim();
    const d = String(definition ?? "").trim();
    if (!t || !d) continue;
    await sql`
      INSERT INTO glossary (course_id, term, definition)
      VALUES (${courseId}, ${t}, ${d})
      ON CONFLICT (course_id, term) DO UPDATE SET definition = EXCLUDED.definition
    `;
    glossaryCount++;
  }

  return {
    courseId,
    chapters: opts.chapters.length,
    cards,
    reviews,
    glossary: glossaryCount,
    replaced,
  };
}

/** Row counts, for the seed script and the seed route to report honestly. */
export async function tableCounts(courseId?: number, client?: Sql) {
  await ensureExamPracticeTables(client);
  const sql = db(client);
  const rows = courseId
    ? await sql`
        SELECT
          (SELECT COUNT(*) FROM course WHERE id = ${courseId})                                  AS course,
          (SELECT COUNT(*) FROM chapter WHERE course_id = ${courseId})                          AS chapter,
          (SELECT COUNT(*) FROM card c JOIN chapter ch ON ch.id = c.chapter_id
             WHERE ch.course_id = ${courseId})                                                  AS card,
          (SELECT COUNT(*) FROM review r JOIN card c ON c.id = r.card_id
             JOIN chapter ch ON ch.id = c.chapter_id WHERE ch.course_id = ${courseId})          AS review,
          (SELECT COUNT(*) FROM glossary WHERE course_id = ${courseId})                         AS glossary
      `
    : await sql`
        SELECT
          (SELECT COUNT(*) FROM course)        AS course,
          (SELECT COUNT(*) FROM chapter)       AS chapter,
          (SELECT COUNT(*) FROM card)          AS card,
          (SELECT COUNT(*) FROM review)        AS review,
          (SELECT COUNT(*) FROM glossary)      AS glossary,
          (SELECT COUNT(*) FROM study_session) AS study_session
      `;
  const r = rows[0] as Record<string, unknown>;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]));
}
