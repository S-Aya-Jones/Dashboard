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
  cal: "gym" | "study" | "classes" | "primary";
  summary: string;
  desc: string;
  anchor: string;      // YYYY-MM-DD of first occurrence
  start: string;       // HH:MM Chicago
  end: string;         // HH:MM Chicago
  rrule: string;
  remindMin?: number;  // popup minutes (default 5)
}

const TEMPLATE: Series[] = [
  { cal: "gym", summary: "Gym", desc: "Bag packed the night before. Home 6:10, shower, work at 7.", anchor: "2026-08-06", start: "05:15", end: "06:10", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH,FR" },

  // Actual class meeting times (synchronous, streamed at work) — Fall 2026
  { cal: "classes", summary: "Biochemistry (GMHS 707-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-05", start: "08:00", end: "10:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "Physiology (GMHS 709-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-05", start: "10:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "CMB (GMHS 710-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-06", start: "08:00", end: "10:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "Microbiology (GMHS 706-1)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-06", start: "10:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T235959Z" },

  { cal: "study", summary: "Study Block 1 — nearest assessment, questions first", desc: "10 practice questions COLD, then study the misses. The 4:55pm Telegram ping names tonight's course.", anchor: "2026-08-04", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH" },
  { cal: "study", summary: "Study Block 2 — second course + error log", desc: "Second-nearest course. Every miss goes in the error log — that's the exam study guide.", anchor: "2026-08-04", start: "19:00", end: "20:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH" },
  { cal: "study", summary: "MCAT Block (WFH morning)", desc: "Freshest 90 min of the week. Exam weeks: this stays, everything else MCAT pauses.", anchor: "2026-08-05", start: "05:15", end: "06:45", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "study", summary: "Light review — post-therapy, no new material", desc: "Flashcards, lecture rewatch, organize notes.", anchor: "2026-08-05", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "study", summary: "Friday light study", desc: "Wrap the week's loose ends before Deandra time.", anchor: "2026-08-07", start: "15:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=FR" },
  { cal: "study", summary: "Sunday long study", desc: "Fresh brain before church. Exam weeks: error-log territory.", anchor: "2026-08-09", start: "07:00", end: "08:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "study", summary: "Sunday study — error log review", desc: "Run the week's missed questions. Sets up Monday's Block 1.", anchor: "2026-08-09", start: "17:00", end: "18:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },

  { cal: "primary", summary: "Extended-route drive home (exposure #1)", desc: "The harder way home. Nothing scheduled until 5 — no time pressure.", anchor: "2026-08-10", start: "14:30", end: "15:20", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO" },
  { cal: "primary", summary: "Short exposure drive (#2)", desc: "20-minute neighborhood loop before Block 1.", anchor: "2026-08-06", start: "16:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TH" },
  { cal: "primary", summary: "Major driving exposure", desc: "The dedicated weekly session, fresh off Saturday therapy. Boyfriend rides passenger on visit weekends, then repeat solo. Never the night before an assessment.", anchor: "2026-08-08", start: "12:30", end: "14:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA", remindMin: 30 },
  { cal: "primary", summary: "Therapy", desc: "Wednesday 11am — anchored to the WFH no-driving day. Overlaps Physiology, catch the recording after.", anchor: "2026-08-05", start: "11:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE", remindMin: 30 },
  { cal: "primary", summary: "Hospital shadowing", desc: "Primary weekly slot. Exam weeks: this pauses first.", anchor: "2026-08-08", start: "07:30", end: "11:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA", remindMin: 30 },
  { cal: "primary", summary: "Cleaning reset", desc: "Full house reset so the week starts clean.", anchor: "2026-08-08", start: "15:30", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA" },
  { cal: "primary", summary: "Cook — Thu/Fri meals", desc: "During class streaming on the WFH day.", anchor: "2026-08-05", start: "15:00", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=WE" },
  { cal: "primary", summary: "Groceries", desc: "Feeds the Sunday cook.", anchor: "2026-08-09", start: "14:00", end: "15:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "Cook — Mon–Wed meals", desc: "Lecture recordings playing while you cook.", anchor: "2026-08-09", start: "15:00", end: "17:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "Week planning", desc: "20 minutes with the Deadlines tab. Assign every study block. Check if exam-week mode activates.", anchor: "2026-08-09", start: "19:00", end: "19:30", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU" },
  { cal: "primary", summary: "Skincare + wind-down", desc: "Phone on the charger. Call him while you do your routine. Gym bag staged. Lights out at 9.", anchor: "2026-08-04", start: "20:00", end: "21:00", rrule: "RRULE:FREQ=DAILY" },
  { cal: "primary", summary: "Deandra time", desc: "Protected. The week's one late night — bed by 10:30.", anchor: "2026-08-07", start: "18:00", end: "21:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=FR" },
  { cal: "primary", summary: "Church", desc: "Adjust to actual service time.", anchor: "2026-08-09", start: "09:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=SU", remindMin: 30 },
  { cal: "primary", summary: "Budget check (payday)", desc: "30 minutes off the bills tab. Biweekly — shift the anchor if payday differs.", anchor: "2026-08-07", start: "15:00", end: "15:30", rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR" },
];

async function resolveCalendars(calendar: calendar_v3.Calendar) {
  const map: Record<string, string> = { gym: "primary", study: "primary", classes: "primary", primary: "primary" };
  try {
    const list = await calendar.calendarList.list();
    for (const c of list.data.items ?? []) {
      const name = (c.summary ?? "").trim().toLowerCase();
      if (name === "gym" && c.id) map.gym = c.id;
      if (name === "study" && c.id) map.study = c.id;
      if (name === "fall classes" && c.id) map.classes = c.id;
    }
  } catch { /* fall back to primary for everything */ }
  return map;
}

// Titles used to carry emoji. Matching on the exact string would treat
// "Skincare + wind-down" as a different series from the "🧴 Skincare +
// wind-down" already on her calendar and seed a second copy of everything,
// so both sides are normalised before comparison.
const EMOJI = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u23E9-\u23FA]/g;

function normalise(summary: string): string {
  return summary.replace(EMOJI, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// One listing per calendar: recurring-series masters intersecting the next
// two weeks, keyed by normalised summary. (The old q-search matcher couldn't
// handle em-dashes/slashes in titles and let duplicates through.)
async function listSeriesBySummary(
  calendar: calendar_v3.Calendar,
  calId: string,
): Promise<Map<string, Array<{ id: string; created: string; summary: string }>>> {
  const map = new Map<string, Array<{ id: string; created: string; summary: string }>>();
  try {
    const resp = await calendar.events.list({
      calendarId: calId,
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
      maxResults: 2500,
      singleEvents: false,
    });
    for (const e of resp.data.items ?? []) {
      if (!e.id || !e.summary) continue;
      const key = normalise(e.summary);
      const list = map.get(key) ?? [];
      list.push({ id: e.id, created: e.created ?? "", summary: e.summary });
      map.set(key, list);
    }
  } catch { /* treat as empty */ }
  return map;
}

async function seed() {
  const auth = await getAuthedClient();
  if (!auth.credentials.refresh_token) {
    return NextResponse.json({ ok: false, error: "Google not connected — visit /api/google/auth and approve access first" }, { status: 400 });
  }
  const calendar = google.calendar({ version: "v3", auth });
  const cals = await resolveCalendars(calendar);

  const created: string[] = [];
  const skipped: string[] = [];
  const deduped: string[] = [];
  const renamed: string[] = [];
  const failed: Array<{ summary: string; error: string }> = [];

  // One listing per distinct calendar, then dedupe + exact-match skip
  const templateSummaries = new Set(TEMPLATE.map(s => normalise(s.summary)));
  const byCal = new Map<string, Map<string, Array<{ id: string; created: string; summary: string }>>>();
  for (const calId of Array.from(new Set(Object.values(cals)))) {
    byCal.set(calId, await listSeriesBySummary(calendar, calId));
  }

  // Remove duplicate series a previous buggy run created: keep the oldest
  for (const [calId, seriesMap] of Array.from(byCal.entries())) {
    for (const [key, entries] of Array.from(seriesMap.entries())) {
      if (!templateSummaries.has(key) || entries.length <= 1) continue;
      entries.sort((a, b) => a.created.localeCompare(b.created));
      for (const dupe of entries.slice(1)) {
        try {
          await calendar.events.delete({ calendarId: calId, eventId: dupe.id });
          deduped.push(dupe.summary);
        } catch { /* already gone */ }
      }
      seriesMap.set(key, entries.slice(0, 1));
    }
  }

  // Retitle the survivors that still carry emoji, so the calendar reads the
  // same way the app does.
  const cleanTitle = new Map(TEMPLATE.map(s => [normalise(s.summary), s.summary]));
  for (const [calId, seriesMap] of Array.from(byCal.entries())) {
    for (const [key, entries] of Array.from(seriesMap.entries())) {
      const want = cleanTitle.get(key);
      if (!want) continue;
      for (const e of entries) {
        if (e.summary === want) continue;
        try {
          await calendar.events.patch({
            calendarId: calId,
            eventId: e.id,
            requestBody: { summary: want },
          });
          renamed.push(want);
        } catch { /* leave it as-is */ }
      }
    }
  }

  for (const s of TEMPLATE) {
    const calId = cals[s.cal];
    try {
      if ((byCal.get(calId)?.get(normalise(s.summary))?.length ?? 0) > 0) {
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
    deduped,
    renamed,
    failed: tokenExpired ? failed.slice(0, 1) : failed,
    message: tokenExpired
      ? "Google connection expired (invalid_grant). Fix: visit /api/google/auth, approve access, then visit this endpoint again."
      : `Created ${created.length}, skipped ${skipped.length}, removed ${deduped.length} duplicates, retitled ${renamed.length}, failed ${failed.length}`,
  });
}

export async function GET() { return seed(); }
export async function POST() { return seed(); }
