import { neonClient } from "@/lib/neon";
import { STEP_GOAL } from "@/lib/habitTexts";

// What she actually did, counted.
//
// Steps have been logged every evening for weeks and there has been nowhere to
// see them. Her words: "I don't see where my steps are logged." They went into
// habit_log and came back out only as a one line reply at the moment she sent
// them, which is the same as not keeping them.
//
// Two things fix that. A card on the dashboard so the week is visible, and one
// line in the morning text so yesterday gets an answer without her opening
// anything. The second matters more: a number she has to go and look up is a
// number she looks up twice and then stops.
//
// Workouts go in the same table. They were never a kind of their own, so
// "I lifted for 40 minutes" had nowhere to land.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export interface DayActivity {
  date: string;
  steps: number | null;
  /** Minutes of deliberate exercise, separate from the walking. */
  workoutMinutes: number | null;
  workoutWhat: string | null;
  drives: number;
  heightReps: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function lastNDays(n: number, endDate: string): string[] {
  const out: string[] = [];
  const end = new Date(`${endDate}T12:00:00`);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(ymd(d));
  }
  return out;
}

export function yesterdayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

/**
 * One row per day, including the days with nothing on them.
 *
 * The empty days are the point. A list of only the days she logged looks like
 * an unbroken run; the gaps are what tell her where the week went.
 */
export async function activity(from: string, to: string): Promise<DayActivity[]> {
  const sql = db();

  const [habit, exposure] = await Promise.all([
    sql`SELECT date, kind, steps, minutes, reason FROM habit_log
        WHERE date >= ${from} AND date <= ${to}`,
    sql`SELECT on_date, track FROM exp_log
        WHERE on_date >= ${from} AND on_date <= ${to} AND skipped IS NULL`
      .catch(() => [] as unknown[]),
  ]);

  const byDay = new Map<string, DayActivity>();
  for (const date of lastNDays(
    Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) + 1),
    to,
  )) {
    byDay.set(date, { date, steps: null, workoutMinutes: null, workoutWhat: null, drives: 0, heightReps: 0 });
  }

  for (const r of habit) {
    const x = r as Record<string, unknown>;
    const day = byDay.get(String(x.date));
    if (!day) continue;
    const kind = String(x.kind);
    // The highest count of the day wins. She sends a running total through the
    // day, so the last word on a day is the biggest number, not the newest row.
    if (kind === "steps" && x.steps != null) {
      day.steps = Math.max(day.steps ?? 0, Number(x.steps));
    }
    if (kind === "workout") {
      day.workoutMinutes = (day.workoutMinutes ?? 0) + Number(x.minutes ?? 0);
      day.workoutWhat = (x.reason as string) ?? day.workoutWhat;
    }
  }

  for (const r of exposure) {
    const x = r as Record<string, unknown>;
    const day = byDay.get(String(x.on_date).slice(0, 10));
    if (!day) continue;
    if (x.track === "A" || x.track === "B") day.drives++;
    else day.heightReps++;
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function logWorkout(dateStr: string, minutes: number, what: string | null): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO habit_log (date, kind, minutes, reason)
    VALUES (${dateStr}, 'workout', ${minutes}, ${what})
  `;
}

/**
 * Yesterday, in one sentence, or nothing.
 *
 * Silent when she logged nothing. A text that says "you logged no steps
 * yesterday" every day she forgets is a text that teaches her to stop reading
 * the top line, and the top line is where the walk is.
 */
export async function yesterdayLine(todayStr: string): Promise<string | null> {
  const y = yesterdayOf(todayStr);
  const rows = await activity(y, y).catch(() => []);
  const d = rows[0];
  if (!d || d.steps == null) return null;

  const n = d.steps.toLocaleString("en-US");
  if (d.steps >= STEP_GOAL) return `Yesterday: ${n} steps. Goal hit.`;

  const short = (STEP_GOAL - d.steps).toLocaleString("en-US");
  return `Yesterday: ${n} steps, ${short} short.`;
}

export interface WeekTotals {
  daysLogged: number;
  daysHitGoal: number;
  average: number | null;
  best: number | null;
  workoutMinutes: number;
}

export function totals(days: DayActivity[]): WeekTotals {
  const logged = days.filter(d => d.steps != null);
  const sum = logged.reduce((n, d) => n + (d.steps ?? 0), 0);
  return {
    daysLogged: logged.length,
    daysHitGoal: logged.filter(d => (d.steps ?? 0) >= STEP_GOAL).length,
    average: logged.length ? Math.round(sum / logged.length) : null,
    best: logged.length ? Math.max(...logged.map(d => d.steps ?? 0)) : null,
    workoutMinutes: days.reduce((n, d) => n + (d.workoutMinutes ?? 0), 0),
  };
}

export { STEP_GOAL };
