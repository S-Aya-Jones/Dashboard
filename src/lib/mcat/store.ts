import { neonClient } from "@/lib/neon";
import { CATEGORIES, PLAN, dayFor } from "@/lib/mcat/calendar";

// What she does against the plan.
//
// The plan is fixed and lives in calendar.ts. This is everything that is hers:
// the day marked done, every question logged right or wrong, and the practice
// sections.
//
// Mastery is derived, never stored. Her rule is that a question is mastered at
// three correct attempts, where attempts after the first must be reworded
// versions of it. A stored "mastered" flag is a second copy of a fact the
// attempts already carry, and the two would disagree the first time a row was
// edited.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

/** Her rule, in one place: three right, and the retries must be reworded. */
export const MASTERY_AT = 3;

export async function ensureMcatTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS mcat_day (
      on_date   DATE PRIMARY KEY,
      done      BOOLEAN NOT NULL DEFAULT false,
      questions INT,
      correct   INT,
      notes     TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS mcat_question (
      id          SERIAL PRIMARY KEY,
      on_date     DATE NOT NULL,
      source      TEXT,
      question_id TEXT,
      topic       TEXT,
      code        TEXT,
      my_answer   TEXT,
      right_answer TEXT,
      why         TEXT,
      miss_type   TEXT,
      a1 INT, a2 INT, a3 INT, a4 INT, a5 INT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_mcat_q_code ON mcat_question(code)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mcat_test (
      id        SERIAL PRIMARY KEY,
      week      INT,
      on_date   DATE NOT NULL,
      name      TEXT NOT NULL,
      section   TEXT NOT NULL,
      questions INT,
      correct   INT,
      notes     TEXT
    )
  `;
}

// ── The day ──────────────────────────────────────────────────────────────────

export interface DayProgress {
  date: string;
  done: boolean;
  questions: number | null;
  correct: number | null;
  notes: string | null;
}

function dayRow(r: unknown): DayProgress {
  const x = r as Record<string, unknown>;
  return {
    date: String(x.on_date).slice(0, 10),
    done: Boolean(x.done),
    questions: x.questions == null ? null : Number(x.questions),
    correct: x.correct == null ? null : Number(x.correct),
    notes: (x.notes as string) ?? null,
  };
}

export async function progressBetween(from: string, to: string): Promise<DayProgress[]> {
  await ensureMcatTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM mcat_day WHERE on_date >= ${from} AND on_date <= ${to} ORDER BY on_date
  `;
  return rows.map(dayRow);
}

export async function saveDay(p: Partial<DayProgress> & { date: string }): Promise<void> {
  await ensureMcatTables();
  const sql = db();
  await sql`
    INSERT INTO mcat_day (on_date, done, questions, correct, notes)
    VALUES (${p.date}, ${p.done ?? false}, ${p.questions ?? null}, ${p.correct ?? null}, ${p.notes ?? null})
    ON CONFLICT (on_date) DO UPDATE SET
      done = COALESCE(${p.done ?? null}, mcat_day.done),
      questions = COALESCE(${p.questions ?? null}, mcat_day.questions),
      correct = COALESCE(${p.correct ?? null}, mcat_day.correct),
      notes = COALESCE(${p.notes ?? null}, mcat_day.notes),
      updated_at = NOW()
  `;
}

// ── The question log ─────────────────────────────────────────────────────────

export interface Question {
  id: number;
  onDate: string;
  source: string | null;
  questionId: string | null;
  topic: string | null;
  code: string | null;
  myAnswer: string | null;
  rightAnswer: string | null;
  why: string | null;
  missType: string | null;
  attempts: Array<number | null>;
}

function qRow(r: unknown): Question {
  const x = r as Record<string, unknown>;
  const n = (k: string) => (x[k] == null ? null : Number(x[k]));
  return {
    id: Number(x.id),
    onDate: String(x.on_date).slice(0, 10),
    source: (x.source as string) ?? null,
    questionId: (x.question_id as string) ?? null,
    topic: (x.topic as string) ?? null,
    code: (x.code as string) ?? null,
    myAnswer: (x.my_answer as string) ?? null,
    rightAnswer: (x.right_answer as string) ?? null,
    why: (x.why as string) ?? null,
    missType: (x.miss_type as string) ?? null,
    attempts: [n("a1"), n("a2"), n("a3"), n("a4"), n("a5")],
  };
}

export function timesCorrect(q: Question): number {
  return q.attempts.filter(a => a === 1).length;
}

export function isMastered(q: Question): boolean {
  return timesCorrect(q) >= MASTERY_AT;
}

/** Missed first time and not yet at three. These are what Saturday retests. */
export function needsRetest(q: Question): boolean {
  return q.attempts[0] === 0 && !isMastered(q);
}

export async function questions(limit = 500, offset = 0): Promise<Question[]> {
  await ensureMcatTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM mcat_question ORDER BY on_date DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(qRow);
}

export async function addQuestion(q: Omit<Question, "id">): Promise<number> {
  await ensureMcatTables();
  const sql = db();
  const [a1, a2, a3, a4, a5] = q.attempts;
  const rows = await sql`
    INSERT INTO mcat_question
      (on_date, source, question_id, topic, code, my_answer, right_answer, why, miss_type, a1, a2, a3, a4, a5)
    VALUES
      (${q.onDate}, ${q.source}, ${q.questionId}, ${q.topic}, ${q.code}, ${q.myAnswer},
       ${q.rightAnswer}, ${q.why}, ${q.missType}, ${a1}, ${a2}, ${a3}, ${a4}, ${a5})
    RETURNING id
  `;
  return Number((rows[0] as Record<string, unknown>).id);
}

/**
 * Record a retest result.
 *
 * Writes into the first empty attempt column, so she never has to know which
 * attempt number she is on. Attempts past the first are reworded versions by
 * her own rule; nothing here can check that, and nothing pretends to.
 */
export async function addAttempt(id: number, correct: boolean): Promise<void> {
  await ensureMcatTables();
  const sql = db();
  const v = correct ? 1 : 0;
  await sql`
    UPDATE mcat_question SET
      a2 = CASE WHEN a2 IS NULL THEN ${v} ELSE a2 END,
      a3 = CASE WHEN a2 IS NOT NULL AND a3 IS NULL THEN ${v} ELSE a3 END,
      a4 = CASE WHEN a3 IS NOT NULL AND a4 IS NULL THEN ${v} ELSE a4 END,
      a5 = CASE WHEN a4 IS NOT NULL AND a5 IS NULL THEN ${v} ELSE a5 END
    WHERE id = ${id}
  `;
}

export async function deleteQuestion(id: number): Promise<void> {
  await ensureMcatTables();
  const sql = db();
  await sql`DELETE FROM mcat_question WHERE id = ${id}`;
}

// ── Category mastery, worked out rather than stored ──────────────────────────

export interface Mastery {
  code: string;
  name: string;
  logged: number;
  firstTryCorrect: number;
  firstTryPct: number | null;
  mastered: number;
  toRetest: number;
  masteredPct: number | null;
}

/**
 * One row per content category.
 *
 * A question can carry more than one code ("1A, 5D"), so it counts towards
 * each. The alternative is picking one, and picking wrongly makes a category
 * look clean when she has been missing it all week.
 */
export function masteryFrom(qs: Question[]): Mastery[] {
  return CATEGORIES.map(cat => {
    const mine = qs.filter(q =>
      (q.code ?? "").split(/[,;/]/).map(s => s.trim().toUpperCase()).includes(cat.code.toUpperCase()),
    );
    const firstTry = mine.filter(q => q.attempts[0] === 1).length;
    const mastered = mine.filter(isMastered).length;
    return {
      code: cat.code,
      name: cat.name,
      logged: mine.length,
      firstTryCorrect: firstTry,
      firstTryPct: mine.length ? Math.round((firstTry / mine.length) * 100) : null,
      mastered,
      toRetest: mine.filter(needsRetest).length,
      masteredPct: mine.length ? Math.round((mastered / mine.length) * 100) : null,
    };
  });
}

/**
 * The weakest categories she has actually logged against.
 *
 * Her Sunday job is to pick next week's extra weight, and a category with two
 * questions in it is noise. Four is the smallest number that can be meaningfully
 * wrong more often than right.
 */
export function weakest(rows: Mastery[], n = 3, minLogged = 4): Mastery[] {
  return rows
    .filter(r => r.logged >= minLogged && r.firstTryPct != null)
    .sort((a, b) => (a.firstTryPct ?? 100) - (b.firstTryPct ?? 100))
    .slice(0, n);
}

// ── Weekly summary ───────────────────────────────────────────────────────────

export interface WeekRow {
  week: number;
  from: string;
  to: string;
  daysPlanned: number;
  daysDone: number;
  questions: number;
  correct: number;
  pct: number | null;
}

export function weeklyFrom(progress: DayProgress[]): WeekRow[] {
  const byWeek = new Map<number, WeekRow>();

  for (const d of PLAN) {
    const row = byWeek.get(d.week) ?? {
      week: d.week, from: d.date, to: d.date,
      daysPlanned: 0, daysDone: 0, questions: 0, correct: 0, pct: null,
    };
    row.daysPlanned++;
    row.to = d.date;
    byWeek.set(d.week, row);
  }

  for (const p of progress) {
    const day = dayFor(p.date);
    if (!day) continue;
    const row = byWeek.get(day.week);
    if (!row) continue;
    if (p.done) row.daysDone++;
    row.questions += p.questions ?? 0;
    row.correct += p.correct ?? 0;
  }

  return Array.from(byWeek.values())
    .map(r => ({ ...r, pct: r.questions ? Math.round((r.correct / r.questions) * 100) : null }))
    .sort((a, b) => a.week - b.week);
}

// ── Practice tests ───────────────────────────────────────────────────────────

export interface TestRow {
  id: number;
  week: number | null;
  onDate: string;
  name: string;
  section: string;
  questions: number | null;
  correct: number | null;
  notes: string | null;
}

export async function tests(): Promise<TestRow[]> {
  await ensureMcatTables();
  const sql = db();
  const rows = await sql`SELECT * FROM mcat_test ORDER BY on_date, id`;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      id: Number(x.id),
      week: x.week == null ? null : Number(x.week),
      onDate: String(x.on_date).slice(0, 10),
      name: String(x.name),
      section: String(x.section),
      questions: x.questions == null ? null : Number(x.questions),
      correct: x.correct == null ? null : Number(x.correct),
      notes: (x.notes as string) ?? null,
    };
  });
}

export async function saveTest(t: Omit<TestRow, "id"> & { id?: number }): Promise<void> {
  await ensureMcatTables();
  const sql = db();
  if (t.id) {
    await sql`
      UPDATE mcat_test SET questions = ${t.questions}, correct = ${t.correct}, notes = ${t.notes}
      WHERE id = ${t.id}
    `;
    return;
  }
  await sql`
    INSERT INTO mcat_test (week, on_date, name, section, questions, correct, notes)
    VALUES (${t.week}, ${t.onDate}, ${t.name}, ${t.section}, ${t.questions}, ${t.correct}, ${t.notes})
  `;
}
