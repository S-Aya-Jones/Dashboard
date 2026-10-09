import { neonClient } from "@/lib/neon";
import crypto from "crypto";

// Study material that isn't hers.
//
// Her class shares guides, summaries and question sets, and until now none of
// it could get into the app — everything was keyed to a lecture she had
// recorded herself. This is course-scoped rather than lecture-scoped, and
// carries who it came from, because a classmate's summary and her professor's
// slides do not deserve equal weight when they disagree.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export interface CourseMaterial {
  id: string;
  course: string;
  title: string;
  /** Who shared it. Shown wherever the material is used. */
  source: string;
  kind: "notes" | "questions" | "guide" | "other";
  text: string;
  createdAt: string;
}

let ready = false;
async function ensure() {
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS course_material (
      id         TEXT PRIMARY KEY,
      course     TEXT NOT NULL,
      title      TEXT NOT NULL,
      source     TEXT NOT NULL DEFAULT '',
      kind       TEXT NOT NULL DEFAULT 'notes',
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS course_material_course_idx ON course_material (course)`;
  // Staging for a PDF that has to arrive in pieces. Cleared once read.
  await sql`
    CREATE TABLE IF NOT EXISTS course_material_parts (
      key        TEXT NOT NULL,
      idx        INTEGER NOT NULL,
      data       TEXT NOT NULL,
      PRIMARY KEY (key, idx)
    )
  `;
  ready = true;
}

function row(r: Record<string, unknown>): CourseMaterial {
  return {
    id: String(r.id),
    course: String(r.course),
    title: String(r.title),
    source: String(r.source ?? ""),
    kind: (r.kind as CourseMaterial["kind"]) ?? "notes",
    text: String(r.text ?? ""),
    createdAt: String(r.created_at),
  };
}

const MAX_TEXT = 60000;

export async function addMaterial(m: {
  course: string; title: string; source?: string;
  kind?: CourseMaterial["kind"]; text: string;
}): Promise<CourseMaterial> {
  await ensure();
  const sql = db();
  const id = crypto.randomBytes(8).toString("hex");
  const rows = await sql`
    INSERT INTO course_material (id, course, title, source, kind, text)
    VALUES (${id}, ${m.course}, ${m.title.slice(0, 200)}, ${(m.source ?? "").slice(0, 80)},
            ${m.kind ?? "notes"}, ${m.text.slice(0, MAX_TEXT)})
    RETURNING *
  `;
  return row(rows[0]);
}

/** Titles and sources only — the text is large and rarely needed for a list. */
export async function listMaterial(course?: string): Promise<Omit<CourseMaterial, "text">[]> {
  await ensure();
  const sql = db();
  const rows = course
    ? await sql`SELECT id, course, title, source, kind, created_at FROM course_material WHERE course = ${course} ORDER BY created_at DESC`
    : await sql`SELECT id, course, title, source, kind, created_at FROM course_material ORDER BY created_at DESC`;
  return rows.map(r => {
    const full = row({ ...r, text: "" });
    return {
      id: full.id, course: full.course, title: full.title,
      source: full.source, kind: full.kind, createdAt: full.createdAt,
    };
  });
}

/** Extend a record already being built, for a PDF read a window at a time. */
export async function appendMaterialText(id: string, more: string): Promise<number> {
  await ensure();
  const sql = db();
  const rows = await sql`
    UPDATE course_material
    SET text = LEFT(text || E'\n\n' || ${more}, ${MAX_TEXT})
    WHERE id = ${id}
    RETURNING length(text) AS len
  `;
  return rows.length ? Number(rows[0].len) : 0;
}

export async function getMaterial(id: string): Promise<CourseMaterial | null> {
  await ensure();
  const sql = db();
  const rows = await sql`SELECT * FROM course_material WHERE id = ${id}`;
  return rows.length ? row(rows[0]) : null;
}

export async function deleteMaterial(id: string): Promise<void> {
  await ensure();
  const sql = db();
  await sql`DELETE FROM course_material WHERE id = ${id}`;
}

/**
 * Everything shared for one course, trimmed to a budget and labelled by source.
 * Used wherever the tutor or a lesson needs the class's material as well as
 * hers — the label matters, so an explanation can say where a claim came from.
 */
export async function materialContext(course: string, budget = 18000): Promise<string> {
  await ensure();
  const sql = db();
  const rows = await sql`
    SELECT title, source, kind, text FROM course_material
    WHERE course = ${course} ORDER BY created_at DESC LIMIT 12
  `;
  if (!rows.length) return "";

  const parts: string[] = [];
  let used = 0;
  for (const r of rows) {
    const head = `--- ${r.title}${r.source ? ` (shared by ${r.source})` : ""} [${r.kind}]\n`;
    const room = budget - used - head.length;
    if (room < 500) break;
    const body = String(r.text ?? "").slice(0, room);
    parts.push(head + body);
    used += head.length + body.length;
  }
  return parts.join("\n\n");
}

// ── PDF staging ──────────────────────────────────────────────────────────────

export async function putPart(key: string, idx: number, data: string): Promise<void> {
  await ensure();
  const sql = db();
  await sql`
    INSERT INTO course_material_parts (key, idx, data) VALUES (${key}, ${idx}, ${data})
    ON CONFLICT (key, idx) DO UPDATE SET data = EXCLUDED.data
  `;
}

export async function assembleParts(key: string): Promise<string> {
  await ensure();
  const sql = db();
  const rows = await sql`SELECT data FROM course_material_parts WHERE key = ${key} ORDER BY idx ASC`;
  return rows.map(r => String(r.data)).join("");
}

export async function clearParts(key: string): Promise<void> {
  await ensure();
  const sql = db();
  await sql`DELETE FROM course_material_parts WHERE key = ${key}`;
}
