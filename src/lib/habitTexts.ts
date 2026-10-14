import { neonClient } from "@/lib/neon";

// The habit text system.
//
// Eight scheduled texts and four reply formats. The weekly plan supplies the
// parts that change — topics, routes, destinations, study locations — and she
// sets it on Sundays either in the app or by texting "plan".
//
// Everything is scheduled in Chicago local time rather than fixed UTC, so the
// 7:45am text is still 7:45am after daylight saving ends on November 1. The
// dispatch spine already works in Chicago minutes-of-day, so this comes for
// free as long as nothing here hardcodes an offset.

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = typeof DAYS[number];

/** Which days carry a study block, and which carry a drive. From her spec. */
export const STUDY_DAYS: Day[] = ["mon", "wed", "sat"];
export const DRIVE_DAYS: Day[] = ["tue", "thu", "sun"];

export const STEP_GOAL = 20000;
/** Steps per minute on the treadmill, for the "how much longer" reply. */
export const STEPS_PER_MIN = 90;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export function dayOf(dateStr: string): Day {
  return DAYS[new Date(`${dateStr}T12:00:00`).getDay()];
}

export async function ensureHabitTables() {
  const sql = db();
  // One row per day per kind. Setting Tuesday's drive twice replaces it rather
  // than stacking, because the plan is a statement of this week, not a log.
  await sql`
    CREATE TABLE IF NOT EXISTS habit_plan (
      id         SERIAL PRIMARY KEY,
      day        TEXT NOT NULL,
      kind       TEXT NOT NULL,
      detail     TEXT NOT NULL,
      link       TEXT,
      location   TEXT,
      minutes    INT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (day, kind)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS habit_log (
      id         SERIAL PRIMARY KEY,
      date       TEXT NOT NULL,
      kind       TEXT NOT NULL,
      steps      INT,
      anx_before INT,
      anx_peak   INT,
      anx_after  INT,
      minutes    INT,
      quiz       TEXT,
      reason     TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS habit_log_date_idx ON habit_log (date)`;
}

export interface PlanItem {
  day: Day;
  kind: "study" | "drive";
  detail: string;
  link: string | null;
  location: string | null;
  minutes: number | null;
}

export async function setPlanItem(item: PlanItem): Promise<void> {
  await ensureHabitTables();
  const sql = db();
  await sql`
    INSERT INTO habit_plan (day, kind, detail, link, location, minutes, updated_at)
    VALUES (${item.day}, ${item.kind}, ${item.detail}, ${item.link}, ${item.location}, ${item.minutes}, NOW())
    ON CONFLICT (day, kind) DO UPDATE SET
      detail = EXCLUDED.detail, link = EXCLUDED.link,
      location = EXCLUDED.location, minutes = EXCLUDED.minutes, updated_at = NOW()
  `;
}

export async function planFor(day: Day, kind: "study" | "drive"): Promise<PlanItem | null> {
  await ensureHabitTables();
  const sql = db();
  const rows = await sql`SELECT * FROM habit_plan WHERE day = ${day} AND kind = ${kind} LIMIT 1`;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    day: r.day as Day,
    kind: r.kind as "study" | "drive",
    detail: String(r.detail),
    link: (r.link as string) ?? null,
    location: (r.location as string) ?? null,
    minutes: r.minutes == null ? null : Number(r.minutes),
  };
}

export async function wholePlan(): Promise<PlanItem[]> {
  await ensureHabitTables();
  const sql = db();
  const rows = await sql`SELECT * FROM habit_plan ORDER BY day, kind`;
  return rows.map(r => ({
    day: (r as Record<string, unknown>).day as Day,
    kind: (r as Record<string, unknown>).kind as "study" | "drive",
    detail: String((r as Record<string, unknown>).detail),
    link: ((r as Record<string, unknown>).link as string) ?? null,
    location: ((r as Record<string, unknown>).location as string) ?? null,
    minutes: (r as Record<string, unknown>).minutes == null ? null : Number((r as Record<string, unknown>).minutes),
  }));
}

// ── The texts ────────────────────────────────────────────────────────────────
//
// A line whose plan entry is missing is dropped rather than sent with a literal
// "[topic]" in it. A text that reads like an unfinished template is worse than
// one line shorter.

/**
 * The message builders take the plan rather than fetching it.
 *
 * They were doing their own lookups, which meant every one of them needed a
 * live database to produce a string — so the only way to see what a Thursday
 * text says was to wait for Thursday. Pure functions, fetched once by the
 * caller.
 */
function pick(plan: PlanItem[], day: Day, kind: "study" | "drive"): PlanItem | null {
  return plan.find(p => p.day === day && p.kind === kind) ?? null;
}

export function morningWeekday(dateStr: string, plan: PlanItem[]): string {
  const day = dayOf(dateStr);
  const lines = [`Treadmill: 45 min at 1.5 to 2 mph. Goal today: ${STEP_GOAL.toLocaleString("en-US")} steps.`];

  if (day === "mon") {
    const p = pick(plan, "mon", "study");
    if (p) lines.push(`Study 3:30 to 4:30: ${p.detail}.`);
  }
  if (day === "wed") {
    const p = pick(plan, "wed", "study");
    if (p) lines.push(`Study 2:45 to 3:45: ${p.detail}.`);
  }
  if (day === "tue" || day === "thu") {
    const p = pick(plan, day, "drive");
    if (p) {
      lines.push(`Drive home today: ${p.detail}${p.link ? ` ${p.link}` : ""}. Rate your anxiety before you start.`);
    }
  }
  if (day === "thu") lines.push("Send Kasey your weekly update.");

  return lines.join("\n");
}

export const MIDMORNING = "Lift or walk, 30 min.";

export function saturdayMorning(plan: PlanItem[]): string {
  const p = pick(plan, "sat", "study");
  const lines = ["Morning walk, 45 min."];
  if (p) lines.push(`Study 10:00 to 11:30: ${p.detail}${p.location ? ` at ${p.location}` : ""}.`);
  return lines.join(" ");
}

export function sundayMorning(plan: PlanItem[]): string {
  const p = pick(plan, "sun", "drive");
  if (!p) return "Drive today. Rate your anxiety before you start.";
  const mins = p.minutes ? `, about ${p.minutes} min` : "";
  return `Drive today: ${p.detail}${mins}.${p.link ? ` ${p.link}` : ""} Rate your anxiety before you start.`;
}

export const SUNDAY_WRAP = "Weekly wrap-up time.";

export function eveningText(dateStr: string): string {
  const day = dayOf(dateStr);
  const lines = ["Shower, skincare, then a slow treadmill walk while it absorbs. Reply with your steps."];
  if (DRIVE_DAYS.includes(day)) lines.push("How was the drive? Before, peak, after, 0 to 100.");
  if (STUDY_DAYS.includes(day)) lines.push("Study minutes and quiz score?");
  return lines.join("\n");
}

// ── Replies ──────────────────────────────────────────────────────────────────

export type Parsed =
  | { kind: "steps"; steps: number }
  | { kind: "drive"; before: number; peak: number; after: number }
  | { kind: "study"; minutes: number; quiz: string | null }
  | { kind: "skip"; reason: string }
  | { kind: "plan"; items: PlanItem[] }
  | null;

/**
 * What an inbound text means.
 *
 * A bare number is steps — that is the most common reply by far and has to work
 * without a keyword. Everything else is prefixed, so nothing can be mistaken
 * for anything else.
 */
export function parseReply(body: string): Parsed {
  const raw = String(body ?? "").trim();
  if (!raw) return null;

  // A bare number, with or without thousands separators.
  const bare = raw.replace(/[\s,]/g, "");
  if (/^\d{1,7}$/.test(bare)) return { kind: "steps", steps: Number(bare) };

  const lower = raw.toLowerCase();

  const drive = lower.match(/^drive\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/);
  if (drive) {
    const [b, p, a] = drive.slice(1).map(Number);
    if ([b, p, a].every(n => n >= 0 && n <= 100)) return { kind: "drive", before: b, peak: p, after: a };
  }

  const study = lower.match(/^study\s+(\d{1,4})(?:\s+(\S+))?/);
  if (study) {
    return { kind: "study", minutes: Number(study[1]), quiz: study[2] ?? null };
  }

  const skip = lower.match(/^skip\b\s*(.*)$/);
  if (skip) return { kind: "skip", reason: skip[1].trim() || "no reason given" };

  if (/^plan\b/.test(lower) || /^(mon|tue|wed|thu|fri|sat|sun)\s+(study|drive)\s*:/.test(lower)) {
    return { kind: "plan", items: parsePlan(raw) };
  }

  return null;
}

/**
 * The weekly plan, as texted.
 *
 *   plan
 *   mon study: glycolysis
 *   tue drive: Murfreesboro loop https://maps.app.goo.gl/xyz
 *   sat study: enzymes @ Starbucks Franklin
 *   sun drive: Chattanooga 90
 *
 * A trailing number on a drive line is the duration in minutes; "@ somewhere"
 * on a study line is where. Both optional, because a plan she can only write
 * one exact way is a plan she will stop writing.
 */
export function parsePlan(body: string): PlanItem[] {
  const out: PlanItem[] = [];
  for (const line of String(body ?? "").split("\n")) {
    const m = line.trim().match(/^(mon|tue|wed|thu|fri|sat|sun)\s+(study|drive)\s*:\s*(.+)$/i);
    if (!m) continue;

    const day = m[1].toLowerCase() as Day;
    const kind = m[2].toLowerCase() as "study" | "drive";
    let rest = m[3].trim();

    let link: string | null = null;
    const url = rest.match(/https?:\/\/\S+/);
    if (url) { link = url[0]; rest = rest.replace(url[0], "").trim(); }

    let location: string | null = null;
    const at = rest.match(/\s+@\s*(.+)$/);
    if (at) { location = at[1].trim(); rest = rest.slice(0, at.index).trim(); }

    let minutes: number | null = null;
    const mins = rest.match(/\s(\d{1,3})\s*(?:min|minutes)?$/i);
    if (kind === "drive" && mins) { minutes = Number(mins[1]); rest = rest.slice(0, mins.index).trim(); }

    rest = rest.replace(/[.,]\s*$/, "").trim();
    if (rest) out.push({ day, kind, detail: rest, link, location, minutes });
  }
  return out;
}

/** The nudge after a steps reply that falls short. */
export function stepsReply(steps: number): string {
  if (steps >= STEP_GOAL) return `${steps.toLocaleString("en-US")} steps. Goal hit.`;
  const togo = STEP_GOAL - steps;
  const mins = Math.round(togo / STEPS_PER_MIN);
  return `About ${togo.toLocaleString("en-US")} to go, roughly ${mins} minutes on the treadmill.`;
}

// ── Logging ──────────────────────────────────────────────────────────────────

export async function logEntry(dateStr: string, p: Exclude<Parsed, null | { kind: "plan"; items: PlanItem[] }>): Promise<void> {
  await ensureHabitTables();
  const sql = db();
  switch (p.kind) {
    case "steps":
      await sql`INSERT INTO habit_log (date, kind, steps) VALUES (${dateStr}, 'steps', ${p.steps})`;
      return;
    case "drive":
      await sql`INSERT INTO habit_log (date, kind, anx_before, anx_peak, anx_after)
                VALUES (${dateStr}, 'drive', ${p.before}, ${p.peak}, ${p.after})`;
      return;
    case "study":
      await sql`INSERT INTO habit_log (date, kind, minutes, quiz)
                VALUES (${dateStr}, 'study', ${p.minutes}, ${p.quiz})`;
      return;
    case "skip":
      await sql`INSERT INTO habit_log (date, kind, reason) VALUES (${dateStr}, 'skip', ${p.reason})`;
      return;
  }
}

export interface LogRow {
  date: string; kind: string;
  steps: number | null;
  anxBefore: number | null; anxPeak: number | null; anxAfter: number | null;
  minutes: number | null; quiz: string | null; reason: string | null;
}

export async function logsBetween(from: string, to: string): Promise<LogRow[]> {
  await ensureHabitTables();
  const sql = db();
  const rows = await sql`
    SELECT * FROM habit_log WHERE date >= ${from} AND date <= ${to} ORDER BY date, id
  `;
  return rows.map(r => {
    const x = r as Record<string, unknown>;
    return {
      date: String(x.date), kind: String(x.kind),
      steps: x.steps == null ? null : Number(x.steps),
      anxBefore: x.anx_before == null ? null : Number(x.anx_before),
      anxPeak: x.anx_peak == null ? null : Number(x.anx_peak),
      anxAfter: x.anx_after == null ? null : Number(x.anx_after),
      minutes: x.minutes == null ? null : Number(x.minutes),
      quiz: (x.quiz as string) ?? null,
      reason: (x.reason as string) ?? null,
    };
  });
}

// ── The Sunday summary ───────────────────────────────────────────────────────

/**
 * Seven days of it, written to be pasted somewhere else.
 *
 * Plain text and plain numbers on purpose: the point is that she can hand the
 * whole week to something that will read it, not that it looks nice in a
 * message bubble.
 */
export async function weeklySummary(sundayDate: string): Promise<string> {
  const { start, end } = weekBounds(sundayDate);
  const [logs, plan] = await Promise.all([logsBetween(start, end), wholePlan()]);
  return renderSummary(start, end, logs, plan);
}

export function weekBounds(sundayDate: string): { start: string; end: string } {
  const d = new Date(`${sundayDate}T12:00:00`);
  d.setDate(d.getDate() - 6);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start, end: sundayDate };
}

export function renderSummary(start: string, end: string, logs: LogRow[], plan: PlanItem[]): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

  const out: string[] = [`Week of ${start} to ${end}`, ""];

  // Steps, day by day, then the average over days that have a number.
  const steps = logs.filter(l => l.kind === "steps" && l.steps != null);
  out.push("STEPS");
  if (!steps.length) out.push("  none logged");
  else {
    for (const s of steps) out.push(`  ${fmt(s.date)} ${s.steps!.toLocaleString("en-US")}`);
    const avg = Math.round(steps.reduce((n, s) => n + s.steps!, 0) / steps.length);
    out.push(`  average ${avg.toLocaleString("en-US")} over ${steps.length} day${steps.length === 1 ? "" : "s"}`);
  }

  // Drives done against drives planned, so a missed one is visible as a gap
  // rather than simply absent.
  const drives = logs.filter(l => l.kind === "drive");
  const planned = plan.filter(p => p.kind === "drive").length;
  out.push("", `DRIVES  ${drives.length} of ${planned || DRIVE_DAYS.length} planned`);
  if (!drives.length) out.push("  none logged");
  else for (const dr of drives) {
    out.push(`  ${fmt(dr.date)} before ${dr.anxBefore} peak ${dr.anxPeak} after ${dr.anxAfter}`);
  }

  const study = logs.filter(l => l.kind === "study");
  out.push("", "STUDY");
  if (!study.length) out.push("  none logged");
  else {
    for (const s of study) out.push(`  ${fmt(s.date)} ${s.minutes} min${s.quiz ? ` quiz ${s.quiz}` : ""}`);
    out.push(`  total ${study.reduce((n, s) => n + (s.minutes ?? 0), 0)} min`);
  }

  const skips = logs.filter(l => l.kind === "skip");
  out.push("", "SKIPPED");
  if (!skips.length) out.push("  nothing skipped");
  else for (const s of skips) out.push(`  ${fmt(s.date)} ${s.reason}`);

  return out.join("\n");
}
