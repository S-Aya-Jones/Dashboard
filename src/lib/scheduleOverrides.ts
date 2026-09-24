import { neonClient } from "@/lib/neon";
import crypto from "crypto";

// One-off changes to a specific day.
//
// weekPlan.ts is the recurring template — editing it to say "therapy is
// cancelled this week" would delete therapy permanently. These sit on top of
// it, scoped to a date, so a change to one week expires by itself instead of
// quietly becoming the new normal.
//
// They live in their own table rather than the dashboard blob: the blob is read
// whole on every page load and written whole on every change, and it is already
// 2.5MB.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

/** A move is a cancel plus an add — two rows, not a third verb. */
export type OverrideKind = "add" | "cancel";

export interface ScheduleOverride {
  id: string;
  /** The single day this applies to, YYYY-MM-DD. */
  date: string;
  kind: OverrideKind;
  /** For add: what to call it. For cancel: which block to strike. */
  label: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  createdAt: string;
}

let ready = false;
async function ensure() {
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id         TEXT PRIMARY KEY,
      date       TEXT NOT NULL,
      kind       TEXT NOT NULL,
      label      TEXT NOT NULL,
      start_time TEXT,
      end_time   TEXT,
      note       TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS schedule_overrides_date_idx ON schedule_overrides (date)`;
  ready = true;
}

function row(r: Record<string, unknown>): ScheduleOverride {
  return {
    id: String(r.id),
    date: String(r.date),
    kind: (r.kind as OverrideKind) ?? "add",
    label: String(r.label),
    startTime: r.start_time ? String(r.start_time) : null,
    endTime: r.end_time ? String(r.end_time) : null,
    note: r.note ? String(r.note) : null,
    createdAt: String(r.created_at),
  };
}

export interface NewOverride {
  date: string;
  kind: OverrideKind;
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rejects malformed input rather than writing a row nothing can render. */
export function validate(o: NewOverride): string | null {
  if (!DATE_RE.test(o.date)) return `"${o.date}" isn't a date`;
  if (!o.label?.trim()) return "needs a name";
  if (o.kind === "add") {
    if (!o.startTime || !TIME_RE.test(o.startTime)) return "needs a start time";
    if (!o.endTime || !TIME_RE.test(o.endTime)) return "needs an end time";
    if (o.endTime <= o.startTime) return "ends before it starts";
  }
  return null;
}

export async function addOverrides(items: NewOverride[]): Promise<ScheduleOverride[]> {
  await ensure();
  const sql = db();
  const out: ScheduleOverride[] = [];
  for (const o of items) {
    const bad = validate(o);
    if (bad) throw new Error(`${o.label || "that change"}: ${bad}`);
    const id = crypto.randomBytes(8).toString("hex");
    const rows = await sql`
      INSERT INTO schedule_overrides (id, date, kind, label, start_time, end_time, note)
      VALUES (${id}, ${o.date}, ${o.kind}, ${o.label.trim()},
              ${o.startTime ?? null}, ${o.endTime ?? null}, ${o.note ?? null})
      RETURNING *
    `;
    out.push(row(rows[0]));
  }
  return out;
}

export async function overridesBetween(from: string, to: string): Promise<ScheduleOverride[]> {
  await ensure();
  const sql = db();
  const rows = await sql`
    SELECT * FROM schedule_overrides
    WHERE date >= ${from} AND date <= ${to}
    ORDER BY date ASC, start_time ASC NULLS FIRST
  `;
  return rows.map(row);
}

export async function deleteOverride(id: string): Promise<void> {
  await ensure();
  const sql = db();
  await sql`DELETE FROM schedule_overrides WHERE id = ${id}`;
}

/** Housekeeping so the table doesn't accumulate a term of dead one-offs. */
export async function pruneBefore(date: string): Promise<number> {
  await ensure();
  const sql = db();
  const rows = await sql`DELETE FROM schedule_overrides WHERE date < ${date} RETURNING id`;
  return rows.length;
}

/** Does this override strike out that template block? Loose, deliberately. */
export function cancels(o: ScheduleOverride, blockLabel: string): boolean {
  if (o.kind !== "cancel") return false;
  const a = o.label.toLowerCase();
  const b = blockLabel.toLowerCase();
  return b.includes(a) || a.includes(b);
}
