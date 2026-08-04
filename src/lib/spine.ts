import { neon } from "@neondatabase/serverless";
import {
  sendTelegram,
  getDueReminders,
  advanceReminder,
  formatTimeOfDay,
} from "@/lib/telegram";
import { getUpcomingEvents } from "@/lib/gmail";

// ─────────────────────────────────────────────────────────────────────────────
// The notification spine: every scheduled ping in Aya's day, fired by
// /api/cron/dispatch whenever something hits it (cron-job.org every ~5 min,
// plus two Vercel backstop crons). A cron_runs row per (slot, chicago-day)
// makes sends exactly-once no matter how many pingers overlap.
// ─────────────────────────────────────────────────────────────────────────────

const TZ = "America/Chicago";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function chicagoNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function chicagoDateStr(d?: Date): string {
  const c = d ?? chicagoNow();
  const y = c.getFullYear();
  const m = (c.getMonth() + 1).toString().padStart(2, "0");
  const day = c.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function ensureCronRuns() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      slot    TEXT NOT NULL,
      day     TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      detail  TEXT,
      PRIMARY KEY (slot, day)
    )
  `;
}

// Atomically claim a (slot, day). True = we own this send.
async function claimSlot(slot: string, day: string, detail: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    INSERT INTO cron_runs (slot, day, detail)
    VALUES (${slot}, ${day}, ${detail})
    ON CONFLICT (slot, day) DO NOTHING
    RETURNING slot
  `;
  return rows.length > 0;
}

// ─── Assessment helpers ──────────────────────────────────────────────────────

export interface Assessment {
  course: string;
  title: string;
  date: Date;
  daysOut: number;
}

export async function getCourseAssessments(daysAhead = 45): Promise<Assessment[]> {
  const events = await getUpcomingEvents(daysAhead).catch(() => []);
  const today = chicagoDateStr();
  return events
    .filter(e => (e.emailId ?? "").startsWith("course-"))
    .map(e => {
      const date = new Date(e.eventDate);
      const evDay = chicagoDateStr(new Date(date.toLocaleString("en-US", { timeZone: TZ })));
      const daysOut = Math.round(
        (new Date(evDay + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
      );
      return {
        course: e.sourceSender || e.title.split("—")[0].trim(),
        title: e.title,
        date,
        daysOut,
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function fmtAssessment(a: Assessment): string {
  const when =
    a.daysOut === 0 ? "TODAY" :
    a.daysOut === 1 ? "tomorrow" :
    `in ${a.daysOut} days`;
  const dateStr = a.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
  return `${a.title} — ${when} (${dateStr})`;
}

// Tonight's Block 1/2: the two distinct courses with the nearest assessments.
function pickBlocks(assessments: Assessment[]): { b1?: Assessment; b2?: Assessment } {
  const seen = new Set<string>();
  const perCourse: Assessment[] = [];
  for (const a of assessments) {
    if (a.daysOut < 0) continue;
    if (seen.has(a.course)) continue;
    seen.add(a.course);
    perCourse.push(a);
  }
  return { b1: perCourse[0], b2: perCourse[1] };
}

// ─── Message builders ────────────────────────────────────────────────────────

function buildStudyBlocksMsg(assessments: Assessment[], dow: number): string {
  const { b1, b2 } = pickBlocks(assessments);
  const tomorrow = assessments.filter(a => a.daysOut === 1);

  if (dow === 3) {
    // Wednesday: post-therapy — light night only
    let msg =
      "4:55 — Wednesday is a light night (therapy day). No new material: " +
      "flashcards, lecture rewatch, organize notes. Dinner from today's cook.";
    if (tomorrow.length) {
      msg += `\n\n⚠️ Tomorrow: ${tomorrow.map(a => a.title).join(", ")} — do the final review, then sleep.`;
    }
    return msg;
  }

  let msg = "4:55 — study blocks tonight:\n";
  if (b1) {
    msg += `\nBlock 1 (5:00–6:30): ${b1.course} — practice questions first. ${fmtAssessment(b1)}`;
  } else {
    msg += "\nBlock 1 (5:00–6:30): review this week's lectures — no assessments on the board.";
  }
  if (b2) {
    msg += `\nBlock 2 (7:00–8:00): ${b2.course} — ${fmtAssessment(b2)}. Log every miss in the error log.`;
  }
  if (tomorrow.length) {
    msg += `\n\n⚠️ TOMORROW: ${tomorrow.map(a => a.title).join(", ")}. Block 1 becomes final review. Early night.`;
  }
  msg += "\n\nSkincare at 8, lights out at 9.";
  return msg;
}

function buildLeaveWorkMsg(dow: number): string {
  switch (dow) {
    case 1:
      return "2:25 — wrap it up. Today's drive home is the EXTENDED route (driving exposure #1 this week). Take it slow, you've got nothing until 5. Home ~3:20, classes stream til 5 — light tasks only.";
    case 2:
      return "2:25 — head home, direct route. Classes stream til 5 while you knock out flashcards and light tasks. Block 1 hits at 5:00.";
    case 4:
      return "2:25 — head home. Classes til 5. At 4:30: short neighborhood exposure drive (#2 this week) — 20 minutes, then Block 1 at 5:00.";
    case 5:
      return "2:25 — it's Friday. If it's payday: 30-min budget check when you get home (bills tab is already sorted). Classes wind down at 5, then it's Geandra time. Enjoy it — you earned it.";
    default:
      return "2:25 — head home. Classes stream til 5, Block 1 at 5:00.";
  }
}

function buildWeekPlanMsg(assessments: Assessment[]): string {
  const week = assessments.filter(a => a.daysOut >= 0 && a.daysOut <= 7);
  let msg = "7:00 — Sunday planning, 20 minutes. This week on the board:\n";
  msg += week.length
    ? "\n" + week.map(a => `• ${fmtAssessment(a)}`).join("\n")
    : "\n• No quizzes or exams in the next 7 days — get ahead, don't coast.";
  msg +=
    "\n\nChecklist:" +
    "\n• Meals cooked for Mon–Wed?" +
    "\n• Gym bag + clothes staged for 5am?" +
    "\n• Exposure homework from your therapist scheduled?" +
    "\n• Anything due that isn't on the board? Add it now." +
    "\n\nThen skincare at 8, lights out at 9. The week is already won or lost right here.";
  return msg;
}

const DAY_TEMPLATES: Record<number, string> = {
  0: "Sunday: study 7–8:30 → church → family → groceries → cook (Mon–Wed) → study 5–6:30 → week planning at 7.",
  1: "Monday: gym 5:15 → work + classes → extended-route drive home → Block 1 at 5, Block 2 at 7.",
  2: "Tuesday: gym 5:15 → work + classes → Block 1 at 5, Block 2 at 7.",
  3: "Wednesday (WFH): MCAT 5:15–6:45 → work from home → therapy at lunch → cook during classes → light review only.",
  4: "Thursday: gym 5:15 → work + classes → 4:30 short exposure drive → Block 1 at 5, Block 2 at 7.",
  5: "Friday: gym 5:15 → work + classes → budget check if payday → Geandra tonight.",
  6: "Saturday: shadowing 7:30–11:30 → major driving exposure 12:30 → cleaning → open evening.",
};

function buildFallbackMorning(assessments: Assessment[], dow: number): string {
  const soon = assessments.filter(a => a.daysOut >= 0 && a.daysOut <= 7);
  let msg = `Good morning Aya — ${DAY_TEMPLATES[dow] ?? "let's get it."}`;
  if (soon.length) {
    msg += "\n\nComing up:\n" + soon.slice(0, 5).map(a => `• ${fmtAssessment(a)}`).join("\n");
  }
  msg += "\n\nHeights doses at your 10am and 1:30 breaks. You know the plan — just execute today.";
  return msg;
}

const SKINCARE_MSG =
  "7:55 — study blocks are done. Skincare hour starts now: " +
  "phone on the charger, call your boo while you do your routine, " +
  "gym bag + clothes laid out for the morning. Lights out at 9. 🧴✨";

// ─── Slot table ──────────────────────────────────────────────────────────────

interface Slot {
  key: string;
  days: number[];          // Chicago day-of-week (0=Sun)
  time: string;            // "HH:MM" Chicago
  graceMin: number;        // fire if now is within [time, time+grace]
  run: (ctx: SlotCtx) => Promise<string>;  // returns detail for cron_runs
}

interface SlotCtx {
  origin: string;
  dow: number;
}

export const SLOTS: Slot[] = [
  {
    key: "morning-briefing",
    days: [1, 2, 3, 4, 5],
    time: "06:50",
    graceMin: 150,
    run: async ({ origin, dow }) => {
      try {
        const res = await fetch(`${origin}/api/cron/morning-briefing`, {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          cache: "no-store",
        });
        if (res.ok) return "ai-briefing";
        throw new Error(`briefing ${res.status}`);
      } catch {
        const assessments = await getCourseAssessments();
        await sendTelegram(buildFallbackMorning(assessments, dow));
        return "fallback-daymap";
      }
    },
  },
  {
    key: "morning-weekend",
    days: [0, 6],
    time: "07:00",
    graceMin: 150,
    run: async ({ dow }) => {
      const assessments = await getCourseAssessments();
      await sendTelegram(buildFallbackMorning(assessments, dow));
      return "weekend-daymap";
    },
  },
  {
    key: "leave-work",
    days: [1, 2, 4, 5],  // not Wed (WFH), not weekends
    time: "14:25",
    graceMin: 60,
    run: async ({ dow }) => {
      await sendTelegram(buildLeaveWorkMsg(dow));
      return "sent";
    },
  },
  {
    key: "study-blocks",
    days: [0, 1, 2, 3, 4],  // Sun–Thu (Fri = Geandra, Sat = open)
    time: "16:55",
    graceMin: 90,
    run: async ({ dow }) => {
      const assessments = await getCourseAssessments();
      await sendTelegram(buildStudyBlocksMsg(assessments, dow));
      return "sent";
    },
  },
  {
    key: "week-plan",
    days: [0],
    time: "19:00",
    graceMin: 90,
    run: async () => {
      const assessments = await getCourseAssessments();
      await sendTelegram(buildWeekPlanMsg(assessments));
      return "sent";
    },
  },
  {
    key: "skincare",
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "19:55",
    graceMin: 60,
    run: async () => {
      await sendTelegram(SKINCARE_MSG);
      return "sent";
    },
  },
];

// ─── Dispatch ────────────────────────────────────────────────────────────────

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function slotMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export interface DispatchResult {
  chicagoTime: string;
  fired: string[];
  remindersSent: number;
  urgentCheck: string;
}

export async function runDispatch(origin: string): Promise<DispatchResult> {
  await ensureCronRuns();

  const now = chicagoNow();
  const dow = now.getDay();
  const day = chicagoDateStr(now);
  const nowMin = minutesOfDay(now);
  const fired: string[] = [];

  // 1. Time-of-day slots
  for (const slot of SLOTS) {
    if (!slot.days.includes(dow)) continue;
    const sMin = slotMinutes(slot.time);
    if (nowMin < sMin || nowMin > sMin + slot.graceMin) continue;
    if (!(await claimSlot(slot.key, day, "claimed"))) continue;
    try {
      const detail = await slot.run({ origin, dow });
      const sql = db();
      await sql`UPDATE cron_runs SET detail = ${detail} WHERE slot = ${slot.key} AND day = ${day}`;
      fired.push(slot.key);
    } catch (e) {
      const sql = db();
      await sql`UPDATE cron_runs SET detail = ${`error: ${String(e).slice(0, 200)}`} WHERE slot = ${slot.key} AND day = ${day}`;
    }
  }

  // 2. Due user reminders — minute-precision now instead of a 9am daily sweep
  let remindersSent = 0;
  try {
    const due = await getDueReminders();
    for (const r of due) {
      const timeStr = formatTimeOfDay(r.timeOfDay);
      const text = r.body
        ? `⏰ <b>${r.title}</b>\n${r.body}\n\n<i>${timeStr} reminder</i>`
        : `⏰ <b>${r.title}</b>\n\n<i>${timeStr} reminder</i>`;
      await sendTelegram(text);
      await advanceReminder(r);
      remindersSent++;
    }
  } catch { /* reminders table unavailable */ }

  // 3. Urgent email + 1-hour event alerts (existing route, already idempotent)
  let urgentCheck = "skipped";
  try {
    const res = await fetch(`${origin}/api/cron/urgent-check`, { cache: "no-store" });
    urgentCheck = res.ok ? "ok" : `http ${res.status}`;
  } catch (e) {
    urgentCheck = `error: ${String(e).slice(0, 100)}`;
  }

  return {
    chicagoTime: now.toLocaleString("en-US", { timeZone: TZ }),
    fired,
    remindersSent,
    urgentCheck,
  };
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function getSpineHealth() {
  const now = chicagoNow();
  const day = chicagoDateStr(now);

  const config = {
    telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: !!process.env.TELEGRAM_CHAT_ID,
    databaseUrl: !!process.env.DATABASE_URL,
    cronSecret: !!process.env.CRON_SECRET,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
    googleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
  };

  let recentRuns: unknown[] = [];
  let todaySlots: unknown[] = [];
  let activeReminders = 0;
  let upcomingAssessments = 0;

  try {
    await ensureCronRuns();
    const sql = db();
    recentRuns = await sql`
      SELECT slot, day, sent_at, detail FROM cron_runs
      ORDER BY sent_at DESC LIMIT 25
    `;
    const todayRows = await sql`SELECT slot FROM cron_runs WHERE day = ${day}`;
    const firedToday = new Set(todayRows.map(r => r.slot as string));
    todaySlots = SLOTS
      .filter(s => s.days.includes(now.getDay()))
      .map(s => ({ slot: s.key, time: s.time, fired: firedToday.has(s.key) }));
    const rem = await sql`SELECT COUNT(*) AS cnt FROM reminders WHERE active = true`;
    activeReminders = Number(rem[0]?.cnt ?? 0);
    upcomingAssessments = (await getCourseAssessments()).filter(a => a.daysOut >= 0).length;
  } catch { /* db unavailable — config flags still useful */ }

  return {
    chicagoTime: now.toLocaleString("en-US", { timeZone: TZ }),
    config,
    todaySlots,
    recentRuns,
    activeReminders,
    upcomingAssessments,
  };
}
