import { NextResponse } from "next/server";
import { upsertObligation } from "@/lib/obligations";

export const dynamic = "force-dynamic";

// Birthdays and call cadences. These are obligations like any other — the
// engine already knows how to remind, so people just become rows.

const BIRTHDAYS: Array<[string, number, number, string]> = [
  // name, month (1-12), day, relationship
  ["Jamelia (JM)", 7, 25, "best friend"],
  ["Jasmine", 11, 8, "sister"],
  ["China", 7, 9, "sister"],
  ["Dad", 7, 12, "dad"],
  ["Steven", 2, 16, "brother"],
  ["Dominique", 12, 18, "friend"],
  ["Jessica", 7, 23, "friend"],
  ["Miss Rhonda", 7, 20, "friend"],
];

const CALLS: Array<[string, number, string]> = [
  // who, every N days, note
  ["Dad", 7, "Weekly call"],
  ["Grandma", 14, "Every two weeks"],
  ["Steven", 14, "Every two weeks"],
];

/** Next time this month/day comes around, at 9am. */
function nextOccurrence(month: number, day: number): Date {
  const now = new Date();
  let year = now.getFullYear();
  let d = new Date(year, month - 1, day, 9, 0, 0);
  if (d.getTime() < Date.now() - 86400000) {
    year += 1;
    d = new Date(year, month - 1, day, 9, 0, 0);
  }
  return d;
}

export async function POST() {
  try {
    let created = 0;

    for (const [name, month, day, rel] of BIRTHDAYS) {
      await upsertObligation({
        source: "life",
        kind: "birthday",
        title: `${name}'s birthday`,
        detail: rel,
        dueAt: nextOccurrence(month, day).toISOString(),
        // A week out to actually get something, then the day before and the day
        leadDays: [7, 1, 0],
        repeatDays: 365,
        externalId: `bday:${name.toLowerCase().replace(/\W+/g, "-")}`,
      });
      created++;
    }

    for (const [who, everyDays, note] of CALLS) {
      // Start the first one tomorrow morning so it doesn't fire immediately
      const first = new Date(Date.now() + 86400000);
      first.setHours(18, 0, 0, 0);
      await upsertObligation({
        source: "life",
        kind: "call",
        title: `Call ${who}`,
        detail: note,
        dueAt: first.toISOString(),
        leadDays: [0],
        repeatDays: everyDays,
        externalId: `call:${who.toLowerCase()}`,
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      birthdays: BIRTHDAYS.map(b => `${b[0]} — ${b[1]}/${b[2]}`),
      calls: CALLS.map(c => `${c[0]} every ${c[2] === "Weekly call" ? "week" : `${c[1]} days`}`),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
