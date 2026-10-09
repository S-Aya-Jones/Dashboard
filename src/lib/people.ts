import type { Person } from "@/types/dashboard";

// Keeping in touch on purpose.
//
// Dates here are handled as plain YYYY-MM-DD strings in local terms rather
// than through Date arithmetic on timestamps. A birthday is a day on a
// calendar, not an instant, and turning "08-14" into a Date in one timezone
// and reading it back in another is how a reminder ends up a day out.

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUTCDays(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Whole days from `a` to `b`; negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  return toUTCDays(b) - toUTCDays(a);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** The date a person is next due a call, or null when no cadence is set. */
export function nextDue(p: Person): string | null {
  if (!p.cadenceDays || p.cadenceDays < 1) return null;
  if (!p.lastContact) return todayISO();
  return addDays(p.lastContact, p.cadenceDays);
}

/** Negative when overdue, 0 when due today, null when no cadence. */
export function daysUntilDue(p: Person, today = todayISO()): number | null {
  const due = nextDue(p);
  return due === null ? null : daysBetween(today, due);
}

/** MM-DD from either storage form. */
function monthDay(birthday: string): string | null {
  const m = birthday.match(/(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Days until the next occurrence of a birthday, 0 on the day itself.
 * Rolls into next year once this year's has passed.
 */
export function daysUntilBirthday(p: Person, today = todayISO()): number | null {
  if (!p.birthday) return null;
  const md = monthDay(p.birthday);
  if (!md) return null;

  const year = Number(today.slice(0, 4));
  // 29 February in a common year lands on 1 March, which is when people who
  // were born on it are wished happy birthday anyway.
  const thisYear = `${year}-${md}`;
  const diff = daysBetween(today, thisYear);
  if (diff >= 0) return diff;
  return daysBetween(today, `${year + 1}-${md}`);
}

export function turningAge(p: Person, today = todayISO()): number | null {
  if (!p.birthday || p.birthday.length < 10) return null;
  const born = Number(p.birthday.slice(0, 4));
  if (!born || born < 1900) return null;
  const md = monthDay(p.birthday);
  if (!md) return null;
  const year = Number(today.slice(0, 4));
  // The birthday being celebrated is this year's if it hasn't passed, else next.
  const celebrating = daysBetween(today, `${year}-${md}`) >= 0 ? year : year + 1;
  return celebrating - born;
}

export interface DueItem {
  person: Person;
  kind: "overdue" | "due" | "birthday";
  /** Days overdue (positive) for calls, or days away for a birthday. */
  days: number;
}

/**
 * Everything worth mentioning today: overdue calls, calls due today, and
 * birthdays inside the warning window. Sorted most-pressing first so a
 * notification can take the top few and stay short.
 */
export function whatIsDue(
  people: Person[],
  today = todayISO(),
  birthdayWindow = 7,
): DueItem[] {
  const out: DueItem[] = [];

  for (const p of people) {
    const bd = daysUntilBirthday(p, today);
    if (bd !== null && bd <= birthdayWindow) {
      out.push({ person: p, kind: "birthday", days: bd });
    }

    const due = daysUntilDue(p, today);
    if (due !== null && due <= 0) {
      out.push({ person: p, kind: due < 0 ? "overdue" : "due", days: -due });
    }
  }

  // Birthdays first when they are today or tomorrow, then by how overdue.
  return out.sort((a, b) => {
    const rank = (i: DueItem) =>
      i.kind === "birthday" ? (i.days <= 1 ? 0 : 2) : (i.days > 0 ? 1 : 3);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.kind === "birthday" ? a.days - b.days : b.days - a.days;
  });
}

/** One short line per item, for a notification. */
export function dueLine(item: DueItem): string {
  const { person: p, kind, days } = item;
  if (kind === "birthday") {
    const age = turningAge(p);
    const who = `${p.name}${p.relationship ? ` (${p.relationship})` : ""}`;
    const turns = age ? `, turning ${age}` : "";
    if (days === 0) return `${who}'s birthday is today${turns}.`;
    if (days === 1) return `${who}'s birthday is tomorrow${turns}.`;
    return `${who}'s birthday is in ${days} days${turns}.`;
  }
  if (days <= 0) return `Call ${p.name} — due today.`;
  if (days === 1) return `Call ${p.name} — a day overdue.`;
  return `Call ${p.name} — ${days} days overdue.`;
}
