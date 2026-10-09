import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/google";
import { google, calendar_v3 } from "googleapis";
import { WEEK, type PlanBlock, type Cat } from "@/lib/weekPlan";

export const dynamic = "force-dynamic";

// Pushes the weekly life template into Google Calendar. Safe to re-run: it
// creates what's missing, deletes duplicates from earlier runs, and patches a
// series whose title or time has since moved. GET or POST /api/schedule/seed
//
// Calendars are matched by name (Gym → "Gym", Study → "Study"), else primary.
// The template is generated from weekPlan.ts, so this endpoint is how a change
// there reaches her phone's calendar.

interface Series {
  cal: "gym" | "study" | "classes" | "primary";
  summary: string;
  desc: string;
  anchor: string;      // YYYY-MM-DD of first occurrence
  start: string;       // HH:MM Chicago
  end: string;         // HH:MM Chicago
  /** Empty for a one-off event. */
  rrule: string;
  remindMin?: number;  // popup minutes (default 5)
}

// The four class meetings, from the registrar. These are the only series not
// derived from the week plan: weekPlan.ts folds them into one "Work · Biochem
// 8–10 · Physio 10–12" block, because that is the block she actually lives,
// but her calendar wants them as four named courses.
const CLASSES: Series[] = [
  { cal: "classes", summary: "Biochemistry (GMHS 707-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-05", start: "08:00", end: "10:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "Physiology (GMHS 709-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-05", start: "10:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "CMB (GMHS 710-01)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-06", start: "08:00", end: "10:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T235959Z" },
  { cal: "classes", summary: "Microbiology (GMHS 706-1)", desc: "Capture mode: flag confusion, make flashcards.", anchor: "2026-08-06", start: "10:00", end: "12:00", rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218T235959Z" },
];

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function calFor(cat: Cat): Series["cal"] {
  if (cat === "gym") return "gym";
  if (cat === "study") return "study";
  return "primary";
}

/** Monday of the week containing `from`, as YYYY-MM-DD. */
function weekAnchor(from: string, dow: number): string {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * The weekly template, generated from the same week plan the app renders.
 *
 * This used to be a third hand-typed copy of her week, and it drifted: it was
 * still seeding a 5:15am gym and a lunchtime legal block months after both
 * moved. Blocks that repeat at the same time on several days collapse into one
 * BYDAY rule, which is what a calendar wants anyway.
 */
function buildTemplate(anchorFrom = "2026-08-24"): Series[] {
  const byShape = new Map<string, { block: PlanBlock; days: number[] }>();
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    for (const b of WEEK[dow]?.blocks ?? []) {
      if (b.rotation) continue;   // a label that changes weekly can't be one series
      const key = `${b.label}|${b.start}|${b.end}`;
      const hit = byShape.get(key);
      if (hit) hit.days.push(dow);
      else byShape.set(key, { block: b, days: [dow] });
    }
  }
  return Array.from(byShape.values()).map(({ block, days }) => ({
    cal: calFor(block.cat),
    summary: block.label,
    desc: block.note ?? "",
    anchor: weekAnchor(anchorFrom, days[0]),
    start: block.start,
    end: block.end,
    rrule: `RRULE:FREQ=WEEKLY;BYDAY=${days.map(d => BYDAY[d]).join(",")}`,
    remindMin: block.cat === "therapy" || block.cat === "people" ? 30 : 5,
  }));
}

const TEMPLATE: Series[] = [...CLASSES, ...buildTemplate()];

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

/** A recurring series already on the calendar, as far as we need to know it. */
interface SeriesRow {
  id: string;
  created: string;
  summary: string;
  start: string;
  end: string;
  rrule: string;
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
): Promise<Map<string, SeriesRow[]>> {
  const map = new Map<string, SeriesRow[]>();
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
      list.push({
        id: e.id,
        created: e.created ?? "",
        summary: e.summary,
        start: (e.start?.dateTime ?? "").slice(11, 16),
        end: (e.end?.dateTime ?? "").slice(11, 16),
        rrule: (e.recurrence ?? []).find(r => r.startsWith("RRULE")) ?? "",
      });
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
  const byCal = new Map<string, Map<string, SeriesRow[]>>();
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

  // Bring the survivors into line: strip the emoji titles carried over from an
  // older version, and — because this is now generated from the week plan
  // rather than hand-typed — move any series whose time has since changed.
  // Matching only on title used to mean a renamed-nothing, moved-everything
  // block (the gym off 5am, legal out of lunch) was skipped as "already there".
  const wanted = new Map(TEMPLATE.map(s => [normalise(s.summary), s]));
  for (const [calId, seriesMap] of Array.from(byCal.entries())) {
    for (const [key, entries] of Array.from(seriesMap.entries())) {
      const want = wanted.get(key);
      if (!want) continue;
      for (const e of entries) {
        const patch: calendar_v3.Schema$Event = {};
        if (e.summary !== want.summary) patch.summary = want.summary;
        if (e.start && e.start !== want.start) {
          patch.start = { dateTime: `${want.anchor}T${want.start}:00`, timeZone: "America/Chicago" };
          patch.end   = { dateTime: `${want.anchor}T${want.end}:00`,   timeZone: "America/Chicago" };
        } else if (e.end && e.end !== want.end) {
          patch.end = { dateTime: `${want.anchor}T${want.end}:00`, timeZone: "America/Chicago" };
        }
        if (want.rrule && e.rrule && e.rrule !== want.rrule) patch.recurrence = [want.rrule];
        if (!Object.keys(patch).length) continue;
        try {
          await calendar.events.patch({ calendarId: calId, eventId: e.id, requestBody: patch });
          renamed.push(want.summary);
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
          // A one-off (empty rrule) must omit the field entirely — sending
          // recurrence: [""] is rejected.
          ...(s.rrule ? { recurrence: [s.rrule] } : {}),
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
