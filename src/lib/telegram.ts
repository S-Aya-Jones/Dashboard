import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ─── Send helper ──────────────────────────────────────────────────────────────

export async function sendTelegram(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function replyTelegram(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export async function ensureTelegramTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS reminders (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title         TEXT NOT NULL,
      body          TEXT,
      schedule_type TEXT NOT NULL DEFAULT 'daily',
      time_of_day   TEXT NOT NULL,
      days_of_week  INTEGER[],
      next_run_at   TIMESTAMPTZ,
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS inbound_logs (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      raw_text    TEXT NOT NULL,
      parsed_type TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Drop the JSONB column if it exists from an earlier schema version
  await sql`
    ALTER TABLE inbound_logs DROP COLUMN IF EXISTS parsed_payload
  `;
  // Seed one example reminder on first run
  const count = await sql`SELECT COUNT(*) as cnt FROM reminders`;
  if (Number(count[0].cnt) === 0) {
    const nextRun = calcNextRunAt("19:00", "daily", null);
    await sql`
      INSERT INTO reminders (title, schedule_type, time_of_day, next_run_at)
      VALUES ('Orgo study block 📚', 'daily', '19:00', ${nextRun})
    `;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  title: string;
  body?: string;
  scheduleType: "daily" | "weekly" | "once";
  timeOfDay: string;
  daysOfWeek?: number[];
  nextRunAt?: string;
  active: boolean;
  createdAt: string;
}

export interface InboundLog {
  id: string;
  rawText: string;
  parsedType?: string;
  receivedAt: string;
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────

const TZ = "America/Chicago";

function chicagoNow(): Date {
  // Returns a Date object whose local fields represent the current Chicago time
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function calcNextRunAt(
  timeOfDay: string,
  scheduleType: string,
  daysOfWeek: number[] | null,
): string {
  const [hStr, mStr] = timeOfDay.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);

  const utcNow   = new Date();
  const localNow = chicagoNow();

  // Offset between real UTC and the fake-local Date
  const tzOffset = utcNow.getTime() - localNow.getTime();

  if (scheduleType === "daily") {
    const candidate = new Date(localNow);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= localNow) candidate.setDate(candidate.getDate() + 1);
    return new Date(candidate.getTime() + tzOffset).toISOString();
  }

  if (scheduleType === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = new Date(localNow);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(h, m, 0, 0);
      if (daysOfWeek.includes(candidate.getDay()) && candidate > localNow) {
        return new Date(candidate.getTime() + tzOffset).toISOString();
      }
    }
  }

  // Fallback: 24h from now
  return new Date(utcNow.getTime() + 86400000).toISOString();
}

// Display helper: "7:00 PM" from "19:00"
export function formatTimeOfDay(timeOfDay: string): string {
  const [hStr, mStr] = timeOfDay.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function formatDaysOfWeek(days: number[]): string {
  return days.map(d => DAY_NAMES[d]).join(", ");
}

// ─── Parse /remind command ────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export interface ParsedRemind {
  title: string;
  scheduleType: "daily" | "weekly";
  timeOfDay: string;  // "HH:MM"
  daysOfWeek?: number[];
}

export function parseRemindCommand(text: string): ParsedRemind | null {
  // Strip leading /remind
  const body = text.replace(/^\/remind\s+/i, "").trim();

  // Match: <title> daily at <time>
  const dailyMatch = body.match(/^(.+?)\s+daily\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (dailyMatch) {
    const [, title, hStr, mStr, ampm] = dailyMatch;
    const h24 = to24h(parseInt(hStr), ampm);
    return { title: title.trim(), scheduleType: "daily", timeOfDay: `${h24.toString().padStart(2,"0")}:${mStr}` };
  }

  // Match: <title> <days> at <time>
  const weeklyMatch = body.match(/^(.+?)\s+([\w,]+)\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (weeklyMatch) {
    const [, title, daysStr, hStr, mStr, ampm] = weeklyMatch;
    const dayNums = daysStr.split(",")
      .map(d => DAY_MAP[d.trim().toLowerCase()])
      .filter(d => d !== undefined) as number[];
    if (dayNums.length > 0) {
      const h24 = to24h(parseInt(hStr), ampm);
      return { title: title.trim(), scheduleType: "weekly", timeOfDay: `${h24.toString().padStart(2,"0")}:${mStr}`, daysOfWeek: dayNums };
    }
  }

  return null;
}

function to24h(h: number, ampm: string): number {
  if (ampm.toLowerCase() === "pm" && h !== 12) return h + 12;
  if (ampm.toLowerCase() === "am" && h === 12) return 0;
  return h;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getReminders(): Promise<Reminder[]> {
  await ensureTelegramTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM reminders ORDER BY created_at DESC`;
  return rows.map(reminderFromRow);
}

export async function createReminder(
  r: Omit<Reminder, "id" | "createdAt">
): Promise<Reminder> {
  await ensureTelegramTables();
  const sql = getDb();
  const nextRun = r.nextRunAt ?? calcNextRunAt(r.timeOfDay, r.scheduleType, r.daysOfWeek ?? null);
  const rows = await sql`
    INSERT INTO reminders (title, body, schedule_type, time_of_day, days_of_week, next_run_at, active)
    VALUES (${r.title}, ${r.body ?? null}, ${r.scheduleType}, ${r.timeOfDay},
            ${r.daysOfWeek ?? null}, ${nextRun}, ${r.active ?? true})
    RETURNING *
  `;
  return reminderFromRow(rows[0]);
}

export async function toggleReminder(id: string, active: boolean): Promise<void> {
  const sql = getDb();
  await sql`UPDATE reminders SET active = ${active} WHERE id = ${id}`;
}

export async function deleteReminder(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM reminders WHERE id = ${id}`;
}

export async function getDueReminders(): Promise<Reminder[]> {
  await ensureTelegramTables();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM reminders
    WHERE active = true AND next_run_at IS NOT NULL AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
  `;
  return rows.map(reminderFromRow);
}

export async function advanceReminder(r: Reminder): Promise<void> {
  const sql = getDb();
  if (r.scheduleType === "once") {
    await sql`UPDATE reminders SET active = false WHERE id = ${r.id}`;
    return;
  }
  const nextRun = calcNextRunAt(r.timeOfDay, r.scheduleType, r.daysOfWeek ?? null);
  await sql`UPDATE reminders SET next_run_at = ${nextRun} WHERE id = ${r.id}`;
}

export async function logInbound(
  rawText: string,
  parsedType?: string,
  _parsedPayload?: Record<string, unknown>,
): Promise<void> {
  await ensureTelegramTables();
  const sql = getDb();
  await sql`
    INSERT INTO inbound_logs (raw_text, parsed_type)
    VALUES (${rawText}, ${parsedType ?? null})
  `;
}

export async function getRecentInboundLogs(_limit = 50): Promise<InboundLog[]> {
  await ensureTelegramTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, raw_text, parsed_type, received_at
    FROM inbound_logs
    ORDER BY received_at DESC
    LIMIT 50
  `;
  return rows.map(r => ({
    id:         r.id as string,
    rawText:    r.raw_text as string,
    parsedType: (r.parsed_type as string) ?? undefined,
    receivedAt: r.received_at instanceof Date
      ? r.received_at.toISOString()
      : String(r.received_at),
  }));
}

function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function reminderFromRow(r: Record<string, unknown>): Reminder {
  return {
    id:           r.id as string,
    title:        r.title as string,
    body:         (r.body as string) ?? undefined,
    scheduleType: r.schedule_type as "daily" | "weekly" | "once",
    timeOfDay:    r.time_of_day as string,
    daysOfWeek:   (r.days_of_week as number[]) ?? undefined,
    nextRunAt:    r.next_run_at ? toIso(r.next_run_at) : undefined,
    active:       r.active as boolean,
    createdAt:    toIso(r.created_at),
  };
}
