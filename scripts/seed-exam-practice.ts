/**
 * Seed Exam Practice with Microbiology Exam 1.
 *
 *   DATABASE_URL=postgres://… npx tsx scripts/seed-exam-practice.ts
 *
 * Idempotent: re-running replaces the course rather than duplicating it.
 *
 * Works against Neon over HTTP in production and against a plain Postgres
 * locally, because a seed you can only run against the live database is a seed
 * you cannot test. The driver is chosen from the URL; `pg` is a devDependency
 * and is never imported in the deployed app.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { neonClient } from "../src/lib/neon";
import { importCourse, tableCounts, type Sql, type ImportChapter } from "../src/lib/examPractice";

const DATA = join(process.cwd(), "data", "exam-practice");

/** Adapt node-postgres to the tagged-template shape the Neon driver uses. */
async function pgClient(url: string): Promise<{ sql: Sql; done: () => Promise<void> }> {
  let pg: typeof import("pg");
  try {
    pg = await import("pg");
  } catch {
    throw new Error("Local Postgres needs the pg driver: npm i -D pg @types/pg");
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const sql: Sql = async (strings, ...values) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
    const res = await client.query(text, values);
    return res.rows;
  };
  return { sql, done: () => client.end() };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const isNeon = /neon\.tech|neon\.build/.test(url);
  const conn = isNeon
    ? { sql: neonClient(url) as unknown as Sql, done: async () => {} }
    : await pgClient(url);

  console.log(`→ ${isNeon ? "Neon (HTTP)" : "Postgres (TCP)"} · ${url.replace(/:[^:@/]*@/, ":****@")}`);

  const chapters = JSON.parse(readFileSync(join(DATA, "micro_ch1_cards.json"), "utf8")) as ImportChapter[];
  const glossary = JSON.parse(readFileSync(join(DATA, "glossary.json"), "utf8")) as Record<string, string>;

  const sourceCards = chapters.reduce((n, c) => n + (c.cards?.length ?? 0), 0);
  console.log(`   source: ${chapters.length} chapters, ${sourceCards} cards, ${Object.keys(glossary).length} glossary terms\n`);

  const t0 = Date.now();
  const result = await importCourse({
    courseName: "Microbiology",
    term: "Fall 2026",
    examName: "Exam 1",
    // Left null on purpose — the spec has her set the exam date in the UI.
    examDate: null,
    chapters,
    glossary,
  }, conn.sql);

  console.log(`${result.replaced ? "Replaced" : "Created"} course #${result.courseId} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  const counts = await tableCounts(undefined, conn.sql);
  const scoped = await tableCounts(result.courseId, conn.sql);

  console.log("Row counts");
  console.log("  table          all   this course");
  for (const k of ["course", "chapter", "card", "review", "glossary", "study_session"]) {
    const all = counts[k];
    const mine = scoped[k];
    console.log(`  ${k.padEnd(14)} ${String(all ?? 0).padStart(4)}   ${mine === undefined ? "—" : String(mine).padStart(4)}`);
  }

  if (result.cards !== sourceCards) {
    console.log(`\n  note: ${sourceCards - result.cards} card(s) skipped — missing prompt, answer, or an unknown kind.`);
  }

  await conn.done();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
