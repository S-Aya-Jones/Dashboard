import { neonClient } from "@/lib/neon";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// The question bank: many questions per lecture, across the textbook formats
// real exams use — not just A/B/C/D.
//
//  mcq      single best answer            payload {choices[]}         answer "2"
//  sata     select all that apply         payload {choices[]}         answer "0,2,3"
//  order    put steps in sequence         payload {items[] shuffled}  answer "2,0,1,3" (indices in correct order)
//  match    match column A to column B    payload {left[], right[]}   answer "1,3,0,2" (right index per left item)
//  data     interpret values then choose  payload {table, choices[]}  answer "1"
//  short    written answer, self-graded   payload {rubric[]}          answer = model answer
//  trace    describe/draw a mechanism     payload {rubric[]}          answer = model answer
// ─────────────────────────────────────────────────────────────────────────────

export const FORMATS = ["mcq", "sata", "order", "match", "data", "short", "trace"] as const;
export type Format = typeof FORMATS[number];

export const SELF_GRADED: Format[] = ["short", "trace"];

export interface Question {
  id: string;
  lectureId: string | null;
  course: string;
  topic: string;
  format: Format;
  difficulty: string;
  prompt: string;
  payload: Record<string, unknown>;
  answer: string;
  explanation: string;
}

export async function ensureQbankTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS questions (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      lecture_id  TEXT,
      course      TEXT NOT NULL,
      topic       TEXT,
      format      TEXT NOT NULL,
      difficulty  TEXT DEFAULT 'exam',
      prompt      TEXT NOT NULL,
      payload     TEXT NOT NULL DEFAULT '{}',
      answer      TEXT NOT NULL,
      explanation TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS questions_course_idx ON questions (course)`;
  await sql`CREATE INDEX IF NOT EXISTS questions_lecture_idx ON questions (lecture_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS question_attempts (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      question_id TEXT NOT NULL,
      correct     BOOLEAN NOT NULL,
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS attempts_question_idx ON question_attempts (question_id)`;
}

function fromRow(r: Record<string, unknown>): Question {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse((r.payload as string) ?? "{}"); } catch { /* keep empty */ }
  return {
    id: r.id as string,
    lectureId: (r.lecture_id as string) ?? null,
    course: r.course as string,
    topic: (r.topic as string) ?? "",
    format: (r.format as Format) ?? "mcq",
    difficulty: (r.difficulty as string) ?? "exam",
    prompt: r.prompt as string,
    payload,
    answer: r.answer as string,
    explanation: (r.explanation as string) ?? "",
  };
}

export async function insertQuestions(
  lectureId: string,
  course: string,
  items: Array<{
    topic?: string; format: string; difficulty?: string;
    prompt: string; payload?: Record<string, unknown>; answer: string; explanation?: string;
  }>,
): Promise<number> {
  await ensureQbankTables();
  const sql = db();
  let n = 0;
  for (const q of items) {
    if (!q.prompt || !q.answer || !FORMATS.includes(q.format as Format)) continue;
    await sql`
      INSERT INTO questions (lecture_id, course, topic, format, difficulty, prompt, payload, answer, explanation)
      VALUES (${lectureId}, ${course}, ${q.topic ?? ""}, ${q.format}, ${q.difficulty ?? "exam"},
              ${q.prompt}, ${JSON.stringify(q.payload ?? {})}, ${String(q.answer)}, ${q.explanation ?? ""})
    `;
    n++;
  }
  return n;
}

export async function clearQuestions(lectureId: string): Promise<void> {
  await ensureQbankTables();
  const sql = db();
  await sql`DELETE FROM questions WHERE lecture_id = ${lectureId}`;
}

export async function countQuestions(lectureId: string): Promise<number> {
  await ensureQbankTables();
  const sql = db();
  const rows = await sql`SELECT COUNT(*) AS c FROM questions WHERE lecture_id = ${lectureId}`;
  return Number(rows[0]?.c ?? 0);
}

export interface BankFilters {
  course?: string;
  lectureId?: string;
  format?: string;
  difficulty?: string;
  missedOnly?: boolean;
  limit?: number;
}

export async function fetchQuestions(f: BankFilters): Promise<Question[]> {
  await ensureQbankTables();
  const sql = db();
  const limit = Math.min(f.limit ?? 40, 200);

  // Separate statements keep the Neon HTTP driver happy (no dynamic SQL)
  let rows;
  if (f.missedOnly) {
    rows = await sql`
      SELECT q.* FROM questions q
      WHERE (${f.course ?? null}::text IS NULL OR q.course = ${f.course ?? null})
        AND (${f.lectureId ?? null}::text IS NULL OR q.lecture_id = ${f.lectureId ?? null})
        AND (${f.format ?? null}::text IS NULL OR q.format = ${f.format ?? null})
        AND EXISTS (
          SELECT 1 FROM question_attempts a
          WHERE a.question_id = q.id AND a.correct = false
        )
      ORDER BY random() LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT q.* FROM questions q
      WHERE (${f.course ?? null}::text IS NULL OR q.course = ${f.course ?? null})
        AND (${f.lectureId ?? null}::text IS NULL OR q.lecture_id = ${f.lectureId ?? null})
        AND (${f.format ?? null}::text IS NULL OR q.format = ${f.format ?? null})
      ORDER BY random() LIMIT ${limit}
    `;
  }
  return rows.map(fromRow);
}

export async function recordAttempt(questionId: string, correct: boolean): Promise<void> {
  await ensureQbankTables();
  const sql = db();
  await sql`INSERT INTO question_attempts (question_id, correct) VALUES (${questionId}, ${correct})`;
}

export async function bankStats() {
  await ensureQbankTables();
  const sql = db();
  const byCourse = await sql`
    SELECT course, COUNT(*) AS total FROM questions GROUP BY course ORDER BY course
  `;
  const byFormat = await sql`
    SELECT format, COUNT(*) AS total FROM questions GROUP BY format
  `;
  const attempts = await sql`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE correct) AS correct
    FROM question_attempts
  `;
  const weak = await sql`
    SELECT q.course, q.topic,
           COUNT(*) FILTER (WHERE a.correct = false) AS misses,
           COUNT(*) AS seen
    FROM question_attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE q.topic <> ''
    GROUP BY q.course, q.topic
    HAVING COUNT(*) FILTER (WHERE a.correct = false) > 0
    ORDER BY misses DESC
    LIMIT 12
  `;
  return {
    byCourse: byCourse.map(r => ({ course: r.course as string, total: Number(r.total) })),
    byFormat: byFormat.map(r => ({ format: r.format as string, total: Number(r.total) })),
    attempts: {
      total: Number(attempts[0]?.total ?? 0),
      correct: Number(attempts[0]?.correct ?? 0),
    },
    weakTopics: weak.map(r => ({
      course: r.course as string, topic: r.topic as string,
      misses: Number(r.misses), seen: Number(r.seen),
    })),
  };
}

export async function listBankLectures() {
  await ensureQbankTables();
  const sql = db();
  const rows = await sql`
    SELECT l.id, l.title, l.course, COUNT(q.id) AS questions
    FROM lectures l LEFT JOIN questions q ON q.lecture_id = l.id
    GROUP BY l.id, l.title, l.course
    ORDER BY l.created_at DESC
  `;
  return rows.map(r => ({
    id: r.id as string, title: r.title as string,
    course: r.course as string, questions: Number(r.questions),
  }));
}
