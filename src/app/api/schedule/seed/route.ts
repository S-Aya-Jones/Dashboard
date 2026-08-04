import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google, calendar_v3 } from "googleapis";

export const dynamic = "force-dynamic";

// One-shot seeder for the weekly life template. Idempotent: skips any series
// whose title already exists as an upcoming event on the target calendar.
// GET or POST /api/schedule/seed
//
// Calendars are matched by name (Gym → "Gym", Study → "Study"), else primary.
// Anchor dates are the week of Aug 4–10, 2026 — recurrences run forward.

interface Series {
  cal: "gym" | "study" | "primary";
  summary: string;
  desc: string;
  anchor: string;      // YYYY-MM-DD of first occurrence
  start: string;       // HH:MM Chicago
  end: string;         // HH:MM Chicago
  rrule: string;
  remindMin?: number;  // popup minutes (default 5)
}

const TEMPLATE: Series[] = [
  { cal: "gym", summary: "🏋️ Gym", desc: "Bag packed the night before. Home 6:10, shower, work at 7.", anchor: "2026-08-06", start: "05:15", end: "06:10", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH,FR" },

  { cal: "study", summary: "📚 Study Block 1 — nearest assessment, questions first", desc: "10 practice questions COLD, then study the misses. The 4:55pm Telegram ping names tonight's course.", anchor: "2026-08-04", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH" },
  { cal: "study", summary: "📚 Study Block 2 — second course + error log", desc: "Second-nearest course. Every miss goes in the error log — that's the exam study guide.", anchor: "2026-08-04", start: "19:00", end: "20:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH" },
  { cal: "study", summary: "🧠 MCAT Block (WFH morning)", desc: "Freshest 90 min of the week. Exam weeks: this stays, everything else MCAT pauses.", anchor: "2026-08-05", start: "05:15", end: "06:45", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "study", summary: "🪶 Light review — post-therapy, no new material", desc: "Flashcards, lecture rewatch, organize notes.", anchor: "2026-08-05", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "study", summary: "📖 Friday light study", desc: "Wrap the week's loose ends before Geandra time.", anchor: "2026-08-07", start: "15:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=FR" },
  { cal: "study", summary: "📚 Sunday long study", desc: "Fresh brain before church. Exam weeks: error-log territory.", anchor: "2026-08-09", start: "07:00", end: "08:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "study", summary: "📚 Sunday study — error log review", desc: "Run the week's missed questions. Sets up Monday's Block 1.", anchor: "2026-08-09", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },

  { cal: "primary", summary: "🚗 Extended-route drive home (exposure #1)", desc: "The harder way home. Nothing scheduled until 5 — no time pressure.", anchor: "2026-08-10", start: "14:30", end: "15:20", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO" },
  { cal: "primary", summary: "🚗 Short exposure drive (#2)", desc: "20-minute neighborhood loop before Block 1.", anchor: "2026-08-06", start: "16:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TH" },
  { cal: "primary", summary: "🚗 Major driving exposure", desc: "The dedicated weekly session, fresh off Saturday therapy. Boyfriend rides passenger on visit weekends, then repeat solo. Never the night before an assessment.", anchor: "2026-08-08", start: "12:30", end: "14:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA", remindMin: 30 },
  { cal: "primary", summary: "🧑‍⚕️ Therapy (lunch)", desc: "Wednesday lunchtime — anchored to the WFH no-driving day. Adjust time as scheduled.", anchor: "2026-08-05", start: "12:00", end: "13:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE", remindMin: 30 },
  { cal: "primary", summary: "🏥 Hospital shadowing", desc: "Primary weekly slot. Exam weeks: this pauses first.", anchor: "2026-08-08", start: "07:30", end: "11:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA", remindMin: 30 },
  { cal: "primary", summary: "🧽 Cleaning reset", desc: "Full house reset so the week starts clean.", anchor: "2026-08-08", start: "15:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA" },
  { cal: "primary", summary: "🍳 Cook — Thu/Fri meals", desc: "During class streaming on the WFH day.", anchor: "2026-08-05", start: "15:00", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "primary", summary: "🛒 Groceries", desc: "Feeds the Sunday cook.", anchor: "2026-08-09", start: "14:00", end: "15:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "🍳 Cook — Mon–Wed meals", desc: "Lecture recordings playing while you cook.", anchor: "2026-08-09", start: "15:00", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "🗓️ Week planning", desc: "20 minutes with the Deadlines tab. Assign every study block. Check if exam-week mode activates.", anchor: "2026-08-09", start: "19:00", end: "19:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "🧴 Skincare + wind-down", desc: "Phone on the charger. Call him while you do your routine. Gym bag staged. Lights out at 9.", anchor: "2026-08-04", start: "20:00", end: "21:00", rrule: "RRULE:FREQ=DAILY" },
  { cal: "primary", summary: "💜 Geandra time", desc: "Protected. The week's one late night — bed by 10:30.", anchor: "2026-08-07", start: "18:00", end: "21:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=FR" },
  { cal: "primary", summary: "⛪ Church", desc: "Adjust to actual service time.", anchor: "2026-08-09", start: "09:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU", remindMin: 30 },
  { cal: "primary", summary: "💰 Budget check (payday)", desc: "30 minutes off the bills tab. Biweekly — shift the anchor if payday differs.", anchor: "2026-08-07", start: "15:00", end: "15:30", rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR" },
];

async function resolveCalendars(calendar: calendar_v3.Calendar) {
  const map: Record<string, string> = { gym: "primary", study: "primary", primary: "primary" };
  try {
    const list = await calendar.calendarList.list();
    for (const c of list.data.items ?? []) {
      const name = (c.summary ?? "").trim().toLowerCase();
      if (name === "gym" && c.id) map.gym = c.id;
      if (name === "study" && c.id) map.study = c.id;
    }
  } catch { /* fall back to primary for everything */ }
  return map;
}

async function alreadySeeded(calendar: calendar_v3.Calendar, calId: string, summary: string): Promise<boolean> {
  try {
    const resp = await calendar.events.list({
      calendarId: calId,
      q: summary.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 40),
      timeMin: new Date().toISOString(),
      maxResults: 5,
      singleEvents: true,
    });
    return (resp.data.items ?? []).some(e => e.summary === summary);
  } catch {
    return false;
  }
}

async function seed() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ ok: false, error: "Google not connected (GOOGLE_REFRESH_TOKEN missing)" }, { status: 400 });
  }
  const auth = getAuthedClient();
  const calendar = google.calendar({ version: "v3", auth });
  const cals = await resolveCalendars(calendar);

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ summary: string; error: string }> = [];

  for (const s of TEMPLATE) {
    const calId = cals[s.cal];
    try {
      if (await alreadySeeded(calendar, calId, s.summary)) {
        skipped.push(s.summary);
        continue;
      }
      await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: s.summary,
          description: s.desc,
          start: { dateTime: `${s.anchor}T${s.start}:00`, timeZone: "America/Chicago" },
          end:   { dateTime: `${s.anchor}T${s.end}:00`,   timeZone: "America/Chicago" },
          recurrence: [s.rrule],
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: s.remindMin ?? 5 }] },
        },
      });
      created.push(s.summary);
    } catch (e) {
      failed.push({ summary: s.summary, error: String(e).slice(0, 200) });
    }
  }

  const tokenExpired =
    failed.length > 0 && failed.every(f => f.error.includes("invalid_grant"));

  return NextResponse.json({
    ok: failed.length === 0,
    calendars: cals,
    created,
    skipped,
    failed: tokenExpired ? failed.slice(0, 1) : failed,
    message: tokenExpired
      ? "Google connection expired (invalid_grant). Fix: visit /api/google/auth, open the returned url, approve access, copy the refresh token into the GOOGLE_REFRESH_TOKEN env var on Vercel, redeploy, then visit this endpoint again."
      : `Created ${created.length}, skipped ${skipped.length} (already present), failed ${failed.length}`,
  });
}

export async function GET() { return seed(); }
export async function POST() { return seed(); }
