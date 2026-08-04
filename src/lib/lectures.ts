import { neonClient } from "@/lib/neon";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export async function ensureLectureTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS lectures (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      course          TEXT NOT NULL,
      title           TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'uploading',
      chunks_expected INTEGER,
      transcript      TEXT,
      summary         TEXT,
      outline         TEXT,
      concept_map     TEXT,
      quiz            TEXT,
      flashcards      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS lecture_chunks (
      lecture_id TEXT NOT NULL,
      idx        INTEGER NOT NULL,
      text       TEXT,
      PRIMARY KEY (lecture_id, idx)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS error_log (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      course     TEXT NOT NULL,
      lecture_id TEXT,
      question   TEXT NOT NULL,
      correct    TEXT,
      chosen     TEXT,
      missed_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export interface LectureRow {
  id: string;
  course: string;
  title: string;
  status: string;
  chunksExpected: number | null;
  transcript: string | null;
  summary: string | null;
  outline: string | null;
  conceptMap: string | null;
  quiz: string | null;
  flashcards: string | null;
  createdAt: string;
}

function fromRow(r: Record<string, unknown>): LectureRow {
  return {
    id: r.id as string,
    course: r.course as string,
    title: r.title as string,
    status: r.status as string,
    chunksExpected: (r.chunks_expected as number) ?? null,
    transcript: (r.transcript as string) ?? null,
    summary: (r.summary as string) ?? null,
    outline: (r.outline as string) ?? null,
    conceptMap: (r.concept_map as string) ?? null,
    quiz: (r.quiz as string) ?? null,
    flashcards: (r.flashcards as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function createLecture(course: string, title: string, chunksExpected: number): Promise<string> {
  await ensureLectureTables();
  const sql = db();
  const rows = await sql`
    INSERT INTO lectures (course, title, status, chunks_expected)
    VALUES (${course}, ${title}, 'transcribing', ${chunksExpected})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function listLectures(): Promise<LectureRow[]> {
  await ensureLectureTables();
  const sql = db();
  const rows = await sql`
    SELECT id, course, title, status, chunks_expected, summary, created_at,
           NULL as transcript, NULL as outline, NULL as concept_map, NULL as quiz, NULL as flashcards
    FROM lectures ORDER BY created_at DESC LIMIT 100
  `;
  return rows.map(fromRow);
}

export async function getLecture(id: string): Promise<LectureRow | null> {
  await ensureLectureTables();
  const sql = db();
  const rows = await sql`SELECT * FROM lectures WHERE id = ${id}`;
  return rows.length ? fromRow(rows[0]) : null;
}

export async function deleteLecture(id: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM lecture_chunks WHERE lecture_id = ${id}`;
  await sql`DELETE FROM lectures WHERE id = ${id}`;
}

export async function saveChunkText(lectureId: string, idx: number, text: string): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO lecture_chunks (lecture_id, idx, text) VALUES (${lectureId}, ${idx}, ${text})
    ON CONFLICT (lecture_id, idx) DO UPDATE SET text = EXCLUDED.text
  `;
}

export async function getChunkTexts(lectureId: string): Promise<string[]> {
  const sql = db();
  const rows = await sql`
    SELECT text FROM lecture_chunks WHERE lecture_id = ${lectureId} ORDER BY idx ASC
  `;
  return rows.map(r => (r.text as string) ?? "");
}

export async function updateLecture(
  id: string,
  fields: Partial<{
    status: string; transcript: string; summary: string;
    outline: string; conceptMap: string; quiz: string; flashcards: string; title: string;
  }>,
): Promise<void> {
  const sql = db();
  // Explicit per-field updates keep this driver-friendly (no dynamic SQL)
  if (fields.status !== undefined)     await sql`UPDATE lectures SET status = ${fields.status} WHERE id = ${id}`;
  if (fields.transcript !== undefined) await sql`UPDATE lectures SET transcript = ${fields.transcript} WHERE id = ${id}`;
  if (fields.summary !== undefined)    await sql`UPDATE lectures SET summary = ${fields.summary} WHERE id = ${id}`;
  if (fields.outline !== undefined)    await sql`UPDATE lectures SET outline = ${fields.outline} WHERE id = ${id}`;
  if (fields.conceptMap !== undefined) await sql`UPDATE lectures SET concept_map = ${fields.conceptMap} WHERE id = ${id}`;
  if (fields.quiz !== undefined)       await sql`UPDATE lectures SET quiz = ${fields.quiz} WHERE id = ${id}`;
  if (fields.flashcards !== undefined) await sql`UPDATE lectures SET flashcards = ${fields.flashcards} WHERE id = ${id}`;
  if (fields.title !== undefined)      await sql`UPDATE lectures SET title = ${fields.title} WHERE id = ${id}`;
}

export async function logMisses(
  course: string,
  lectureId: string,
  misses: Array<{ question: string; correct: string; chosen: string }>,
): Promise<void> {
  await ensureLectureTables();
  const sql = db();
  for (const m of misses) {
    await sql`
      INSERT INTO error_log (course, lecture_id, question, correct, chosen)
      VALUES (${course}, ${lectureId}, ${m.question}, ${m.correct}, ${m.chosen})
    `;
  }
}

export async function getErrorLog(course?: string) {
  await ensureLectureTables();
  const sql = db();
  const rows = course
    ? await sql`SELECT * FROM error_log WHERE course = ${course} ORDER BY missed_at DESC LIMIT 200`
    : await sql`SELECT * FROM error_log ORDER BY missed_at DESC LIMIT 200`;
  return rows;
}
