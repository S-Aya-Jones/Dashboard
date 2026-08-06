import { neonClient } from "@/lib/neon";
import {
  sendTelegram,
  getDueReminders,
  advanceReminder,
  formatTimeOfDay,
} from "@/lib/telegram";
import { getUpcomingEvents } from "@/lib/gmail";
import { sendSms, smsAlsoEnabled } from "@/lib/sms";
import { dueNotifications, markNotified, upsertObligation } from "@/lib/obligations";

// ─────────────────────────────────────────────────────────────────────────────
// The notification spine: every scheduled ping in Aya's day, fired by
// /api/cron/dispatch whenever something hits it (cron-job.org every ~5 min,
// plus two Vercel backstop crons). A cron_runs row per (slot, chicago-day)
// makes sends exactly-once no matter how many pingers overlap.
// ─────────────────────────────────────────────────────────────────────────────

const TZ = "America/Chicago";

// Telegram always; a plain-text copy by SMS too when texting is switched on.
// The switch now lives in the app rather than only in a Vercel env var, so it
// can be flipped without a redeploy.
async function notify(text: string): Promise<void> {
  await sendTelegram(text);
  if (await smsAlsoEnabled().catch(() => false)) {
    await sendSms(text.replace(/<[^>]+>/g, "")).catch(() => false);
  }
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
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
  const dateStr = a.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  const when =
    a.daysOut === 0 ? "TODAY" :
    a.daysOut === 1 ? "tomorrow" :
    a.daysOut <= 6  ? a.date.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }) :
    dateStr;
  return a.daysOut <= 1
    ? `${a.title} — ${when} (${dateStr})`
    : `${a.title} — ${when}`;
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

// Classes are Mon/Wed Biochem 8-10 + Physio 10-12, Tue/Thu Micro 8-10 + CMB
// 10-12, per the official MHS 26/27 schedule. Evenings anchor to that
// morning's subjects — same-day review is the strongest lever against
// forgetting — UNLESS an assessment is close, in which case the deadline wins.
const DAY_SUBJECTS: Record<number, string[]> = {
  1: ["Biochemistry", "Physiology"],
  2: ["Microbiology", "Cell & Molecular Bio"],
  3: ["Biochemistry", "Physiology"],
  4: ["Microbiology", "Cell & Molecular Bio"],
};

/**
 * The assessment sitting at tomorrow morning, if there is one.
 *
 * Quizzes and exams open at 12:00am on their scheduled day and are due by 9
 * (quiz) or 10 (exam). Aya works 7:00–2:30 and won't take one during work, so
 * she takes it the moment it opens — which makes the night before a quiz a
 * different night from every other one, and the app should already know that
 * rather than her having to remember.
 */
export async function assessmentAtMidnight(): Promise<Assessment | null> {
  const all = await getCourseAssessments(3).catch(() => []);
  const tomorrow = all.filter(a => a.daysOut === 1 && !/review/i.test(a.title));
  if (!tomorrow.length) return null;
  // An exam outranks a quiz if both somehow land together.
  return tomorrow.sort((a, b) => Number(/exam/i.test(b.title)) - Number(/exam/i.test(a.title)))[0];
}

function isUrgent(a: Assessment): boolean {
  const isExam = /exam/i.test(a.title);
  return a.daysOut >= 0 && a.daysOut <= (isExam ? 7 : 5);
}

function buildStudyBlocksMsg(assessments: Assessment[], dow: number): string {
  const { b1, b2 } = pickBlocks(assessments);
  const tomorrow = assessments.filter(a => a.daysOut === 1);
  const urgent = assessments.filter(isUrgent);

  if (dow === 3) {
    // Wednesday: post-therapy — light night only
    let msg =
      "4:55 \u2014 Wednesday is a light night (therapy day). No new material: " +
      "flashcards and a rewatch of this morning's Biochem and Physio.";
    if (tomorrow.length) {
      msg += `\n\nTomorrow: ${tomorrow.map(a => a.title).join(", ")}. It opens at midnight and you take it then, so tonight is the light pass — no new material, and sleep between now and 11:30.`;
    }
    return msg;
  }

  let msg: string;

  if (urgent.length > 0) {
    // Deadline mode — nearest assessments take the blocks
    msg = "4:55 \u2014 study blocks tonight (exam mode):\n";
    if (b1) msg += `\nBlock 1 (5:00\u20136:30): ${b1.course} \u2014 practice questions first. ${fmtAssessment(b1)}`;
    if (b2) msg += `\nBlock 2 (7:00\u20138:00): ${b2.course} \u2014 ${fmtAssessment(b2)}. Log every miss.`;
  } else if (DAY_SUBJECTS[dow]) {
    // Quiet stretch — review what you heard in class this morning
    const [first, second] = DAY_SUBJECTS[dow];
    msg =
      "4:55 \u2014 study blocks tonight (same-day review \u2014 you had both this morning):\n" +
      `\nBlock 1 (5:00\u20136:30): ${first} \u2014 questions first, then the notes` +
      `\nBlock 2 (7:00\u20138:00): ${second} \u2014 log every miss in the error log`;
    const soon = assessments.filter(a => a.daysOut >= 0).slice(0, 1);
    if (soon.length) msg += `\n\nNext up: ${fmtAssessment(soon[0])}`;
  } else if (dow === 5) {
    msg =
      "4:55 \u2014 Friday. Rap Session is done; give this block to whichever course felt " +
      "worst this week, then it's Geandra time.";
  } else if (dow === 0) {
    msg = "4:55 \u2014 Sunday: run the error log, then the nearest assessment.";
    if (b1) msg += `\n\nStart with ${b1.course} \u2014 ${fmtAssessment(b1)}`;
  } else {
    msg = "4:55 \u2014 study blocks tonight:\n";
    if (b1) msg += `\nBlock 1 (5:00\u20136:30): ${b1.course}`;
    if (b2) msg += `\nBlock 2 (7:00\u20138:00): ${b2.course}`;
  }

  if (tomorrow.length) {
    msg += `\n\nTOMORROW: ${tomorrow.map(a => a.title).join(", ")}. Block 1 becomes the final review. It opens at midnight and you sit it then — so get horizontal by 9 and set an alarm for 11:30 rather than trying to stay up.`;
  }
  msg += "\n\nSkincare at 8.";
  return msg;
}

function buildLeaveWorkMsg(dow: number): string {
  switch (dow) {
    case 1:
      return "2:25 — wrap it up. Today's drive home is the EXTENDED route (driving exposure #1 this week). Take it slow, you've got nothing until 5. Home ~3:20 — free afternoon: flashcards, admin, breathe. Block 1 at 5:00.";
    case 2:
      return "2:25 — head home, direct route. Free afternoon: flashcards, admin, decompress. Block 1 hits at 5:00.";
    case 4:
      return "2:25 — head home. Free afternoon til 4:30, then the short neighborhood exposure drive (#2 this week) — 20 minutes, then Block 1 at 5:00.";
    case 5:
      return "2:25 — Friday. Rap Session at 3. If it's payday: 30-min budget check after (bills tab is already sorted), then whichever course felt worst this week. Geandra at 6. Enjoy it — you earned it.";
    default:
      return "2:25 — head home. Free afternoon, Block 1 at 5:00.";
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
    "\n\nThen skincare at 8. The week is already won or lost right here.";
  return msg;
}

const DAY_TEMPLATES: Record<number, string> = {
  0: "Sunday: study 7–8:30 → church → family → groceries → cook (Mon–Wed) → study 5–6:30 → week planning at 7.",
  1: "Monday: gym 5:15 → work · Biochem 8–10 · Physio 10–12 → extended-route drive home → Block 1 at 5, Block 2 at 7.",
  2: "Tuesday: gym 5:15 → work · Micro 8–10 · CMB 10–12 → Block 1 at 5, Block 2 at 7.",
  3: "Wednesday (WFH): MCAT 5:15–6:45 → WFH · Biochem 8–10 · Physio 10–12 → therapy at lunch → cook at 3 → light review only.",
  4: "Thursday: gym 5:15 → work · Micro 8–10 · CMB 10–12 → 4:30 short exposure drive → Block 1 at 5, Block 2 at 7.",
  5: "Friday: gym 5:15 → work (no classes!) → budget check if payday → Geandra tonight.",
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
  "gym bag + clothes laid out for the morning. Lights out at 9.";

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
        await notify(buildFallbackMorning(assessments, dow));
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
      await notify(buildFallbackMorning(assessments, dow));
      return "weekend-daymap";
    },
  },
  {
    key: "read-school-mail",
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "07:10",
    graceMin: 180,
    run: async ({ origin }) => {
      const res = await fetch(`${origin}/api/school/extract`, { method: "POST", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      return `found ${d.found ?? 0} of ${d.scanned ?? 0}`;
    },
  },
  {
    key: "money-watch",
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "09:00",
    graceMin: 180,
    run: async ({ origin }) => {
      const res = await fetch(`${origin}/api/finance/watch`, { method: "POST", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      return `${d.created ?? 0} money events`;
    },
  },
  {
    key: "leave-work",
    days: [1, 2, 4, 5],  // not Wed (WFH), not weekends
    time: "14:25",
    graceMin: 60,
    run: async ({ dow }) => {
      await notify(buildLeaveWorkMsg(dow));
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
      await notify(buildStudyBlocksMsg(assessments, dow));
      return "sent";
    },
  },
  {
    key: "exposure-saturday",
    days: [6],
    time: "11:45",
    graceMin: 90,
    run: async () => {
      await notify(
        "11:45 \u2014 big driving exposure at 12:30, right off the back of therapy while it's fresh.\n\n" +
        "\u2022 Open your saved route in the app (Exposure \u2192 Routes) \u2014 highways and tolls already avoided\n" +
        "\u2022 Rate your fear before you turn the key, at the worst moment, and when you park\n" +
        "\u2022 Panicking is allowed. Turning back is the only thing that costs you\n\n" +
        "Log it when you're home \u2014 that's what draws the curve."
      );
      return "sent";
    },
  },
  {
    key: "exposure-checkin",
    days: [0],
    time: "18:00",
    graceMin: 90,
    run: async () => {
      await notify(
        "6:00 \u2014 weekly exposure check-in (5 minutes, in the app under Exposure \u2192 Check-in).\n\n" +
        "What could you do this week that you couldn't a month ago? What did you avoid? " +
        "What's the one step for next week?\n\n" +
        "Bring it to therapy \u2014 it's exactly what they ask you."
      );
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
      await notify(buildWeekPlanMsg(assessments));
      return "sent";
    },
  },
  {
    key: "skincare",
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "19:55",
    graceMin: 60,
    run: async () => {
      // On a quiz eve the whole evening moves — say so here rather than
      // sending the usual "lights out at 9" into a night that can't have one.
      const a = await assessmentAtMidnight().catch(() => null);
      if (a) {
        await notify(
          `8:00 — skincare now, because tonight runs long. ${a.title} opens at midnight.\n\n` +
          "Plan: routine now, lie down 9 to 11:30, final flick through the error log, " +
          "take it at 12, straight back to bed. Do not start the review at 11:55.\n\n" +
          "Tomorrow's gym is optional. Sleep is worth more than the session."
        );
        return "quiz-eve";
      }
      await notify(SKINCARE_MSG);
      return "sent";
    },
  },
  {
    // The whole point: she's asleep by 9 most nights, so the reminder has to
    // reach her at the moment it opens, not before she went down.
    key: "quiz-opens",
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "23:50",
    graceMin: 25,
    run: async () => {
      const a = await assessmentAtMidnight().catch(() => null);
      if (!a) return "none";
      const isExam = /exam/i.test(a.title);
      await notify(
        `${a.title} opens in 10 minutes.\n\n` +
        `You have until ${isExam ? "10am" : "9am"}, but you're doing it now so it isn't hanging over the work day. ` +
        `${isExam ? "Two hours" : "One hour"} is the window — that's plenty.\n\n` +
        "No help is available until 8am if something breaks, so if the page won't load, stop and take it in the morning window instead."
      );
      return `quiz-opens:${a.title}`;
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
  obligationsSent?: number;
  urgentCheck: string;
}

// Her weekly template, so today's blocks can warn 30 minutes ahead
const DAY_BLOCKS: Record<number, Array<[string, string]>> = {
  1: [["05:15", "Gym"], ["17:00", "Block 1 — Biochemistry"], ["19:00", "Block 2 — Physiology"], ["20:00", "Skincare hour"]],
  2: [["05:15", "Gym"], ["17:00", "Block 1 — Microbiology"], ["19:00", "Block 2 — CMB"], ["20:00", "Skincare hour"]],
  3: [["05:15", "MCAT block"], ["11:00", "Therapy"], ["15:00", "Cook Thu/Fri meals"], ["17:00", "Light review"], ["20:00", "Skincare hour"]],
  4: [["05:15", "Gym"], ["16:30", "Short exposure drive"], ["17:00", "Block 1 — Microbiology"], ["19:00", "Block 2 — CMB"], ["20:00", "Skincare hour"]],
  5: [["05:15", "Gym"], ["15:30", "Weakest subject"], ["18:00", "Geandra time"]],
  6: [["07:30", "Shadowing"], ["12:30", "Major driving exposure"], ["15:30", "Cleaning reset"]],
  0: [["07:00", "Long study"], ["09:00", "Church"], ["14:00", "Groceries"], ["15:00", "Cook Mon–Wed"], ["19:00", "Week planning"]],
};

export async function runDispatch(origin: string): Promise<DispatchResult> {
  await ensureCronRuns();

  const now = chicagoNow();
  const dow = now.getDay();
  const day = chicagoDateStr(now);
  const nowMin = minutesOfDay(now);
  const fired: string[] = [];

  // Heartbeat: proves the external pinger is alive even when no slot is due.
  // The delete clears leftover rows from the (removed) cache-forensics tests.
  {
    const sql = db();
    await sql`
      INSERT INTO cron_runs (slot, day, detail) VALUES ('heartbeat', ${day}, 'ping')
      ON CONFLICT (slot, day) DO UPDATE SET sent_at = NOW()
    `;
    await sql`DELETE FROM cron_runs WHERE slot LIKE 'cachetest%'`;
  }

  // 1a. 30-minute warning before each block on today's template
  if (nowMin >= 5 * 60 && nowMin <= 21 * 60) {
    for (const [hhmm, label] of DAY_BLOCKS[dow] ?? []) {
      const start = slotMinutes(hhmm);
      const warnAt = start - 30;
      if (nowMin < warnAt || nowMin > warnAt + 6) continue;
      const key = `warn-${hhmm}`;
      if (!(await claimSlot(key, day, label))) continue;
      const t12 = (() => {
        const [h, m] = hhmm.split(":").map(Number);
        return `${h % 12 || 12}:${m.toString().padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
      })();
      await notify(`30 minutes — ${label} at ${t12}.`);
      fired.push(key);
    }
  }

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

  // 2. The obligation engine — anything crossing a lead threshold. Runs on
  //    every dispatch but stays quiet outside waking hours.
  let obligationsSent = 0;
  if (nowMin >= 7 * 60 && nowMin <= 21 * 60) {
    try {
      const due = await dueNotifications();
      for (const d of due.slice(0, 4)) {   // never dump a wall of alerts
        await notify(d.message);
        await markNotified(d.id, d.stage);
        obligationsSent++;
      }
    } catch { /* engine unavailable */ }
  }

  // 2b. Due user reminders — minute-precision now instead of a 9am daily sweep
  let remindersSent = 0;
  try {
    const due = await getDueReminders();
    for (const r of due) {
      const timeStr = formatTimeOfDay(r.timeOfDay);
      const text = r.body
        ? `<b>${r.title}</b>\n${r.body}\n\n<i>${timeStr} reminder</i>`
        : `<b>${r.title}</b>\n\n<i>${timeStr} reminder</i>`;
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
    // `now` is already Chicago wall-clock (chicagoNow) — format without a
    // second timeZone shift
    chicagoTime: now.toLocaleString("en-US"),
    fired,
    remindersSent,
    obligationsSent,
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
  let lastPing: string | null = null;

  try {
    await ensureCronRuns();
    const sql = db();
    const hb = await sql`SELECT MAX(sent_at) AS last FROM cron_runs WHERE slot = 'heartbeat'`;
    lastPing = hb[0]?.last ? String(hb[0].last) : null;
    recentRuns = await sql`
      SELECT slot, day, sent_at, detail FROM cron_runs
      WHERE slot != 'heartbeat'
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
    chicagoTime: now.toLocaleString("en-US"),
    // when the external pinger last hit dispatch — null means it has never run
    lastPing,
    config,
    todaySlots,
    recentRuns,
    activeReminders,
    upcomingAssessments,
  };
}
