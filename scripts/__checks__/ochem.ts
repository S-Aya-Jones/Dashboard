import { importCourse, tableCounts, splitChapterName, type Sql } from "@/lib/examPractice";
import { Client } from "pg";

// Proves nothing is bound to microbiology: a second, unrelated course loads
// through the same path with no schema change.
const ochem = [
  { name: "01 Nomenclature", cards: [
    { t: "cloze", q: "A carbon with four different groups is a _____ centre.", a: "stereogenic", full: "A carbon with four different groups is a stereogenic centre." },
    { t: "basic", q: "What does R/S describe?", a: "Absolute configuration at a stereocentre." },
  ]},
  { name: "02 Reactions", cards: [
    { t: "rev", q: "SN1 vs SN2", a: "SN1: carbocation, racemises. SN2: backside attack, inverts.", why: "One step cannot invert twice." },
    { t: "basic", q: "", a: "dropped: no prompt" },
    { t: "weird", q: "unknown kind", a: "dropped" },
  ]},
];

async function main() {
  const c = new Client({ connectionString: "postgresql://postgres@localhost:5433/dashtest" });
  await c.connect();
  const sql: Sql = async (s, ...v) =>
    (await c.query(s.reduce((a, x, i) => a + x + (i < v.length ? `$${i + 1}` : ""), ""), v as unknown[])).rows;

  console.log("splitChapterName edge cases:");
  for (const n of ["02 Cytology I: Cell Structures", "Nomenclature", "10 Reversal Traps (all chapters)", "3D Structures"])
    console.log("  ", JSON.stringify(n), "->", splitChapterName(n, 99));

  const r = await importCourse({ courseName: "Organic Chemistry", term: "Spring 2027", examName: "Exam 1", chapters: ochem, glossary: { "carbocation": "a positively charged carbon." } }, sql);
  console.log("\nimport:", r);
  console.log("scoped counts:", await tableCounts(r.courseId, sql));
  console.log("global counts:", await tableCounts(undefined, sql));
  const rows = await sql`SELECT c.name, ch.ordinal, ch.name AS chapter FROM course c JOIN chapter ch ON ch.course_id=c.id ORDER BY c.id, ch.ordinal`;
  console.log("\ncourses+chapters:", rows.length, "rows;", Array.from(new Set(rows.map((x: Record<string, unknown>) => x.name))));
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
