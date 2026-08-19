import type { Cat } from "@/lib/weekPlan";

// Temporary schedules.
//
// weekPlan.ts is the recurring week. This is what sits on top of it for a
// handful of named dates and then gets out of the way — a catch-up weekend, an
// exam week, the week she's away. Every change carries a date, so a temporary
// week expires by itself rather than quietly becoming the new normal.
//
// Two things feed the same shape: the weeks written here, and the one-off
// changes she saves by voice on /schedule (table `schedule_overrides`). Both
// render identically wherever a schedule is shown.

export interface DatedChange {
  /** Stable enough for a React key; not a database id. */
  id: string;
  /** The single day this applies to, YYYY-MM-DD. */
  date: string;
  /** A move is a cancel plus an add — two entries, not a third verb. */
  kind: "add" | "cancel";
  /** For add: what to call it. For cancel: which block to strike. */
  label: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  cat?: Cat;
}

export interface TempWeek {
  id: string;
  name: string;
  /** One line, shown at the top of the day. Why today doesn't look normal. */
  why: string;
  from: string;
  to: string;
  changes: DatedChange[];
}

function add(
  date: string, start: string, end: string, label: string, cat: Cat, note?: string,
): DatedChange {
  return { id: `${date}-${start}-add`, date, kind: "add", label, startTime: start, endTime: end, note: note ?? null, cat };
}

function cut(date: string, label: string, note?: string): DatedChange {
  return { id: `${date}-${label}-cut`, date, kind: "cancel", label, startTime: null, endTime: null, note: note ?? null };
}

// ── The Exam 1 sprint, Aug 19 to Sep 1 ────────────────────────────────────
//
// Supersedes the catch-up week. The 8/19/26 programme email changed two things
// that matter more than anything in the old plan:
//
//   Every Quiz 1 at or below 11/15 is replaced by the Quiz 2–5 average, and
//   all four of hers qualify. The Micro 5/15 that made that course a coin flip
//   is simply gone.
//
//   Biochem Exam 1 moved Mon 8/24 -> Wed 8/26, CMB Exam 1 Tue 8/25 -> Thu 8/27,
//   both now a midnight-to-10am window rather than an 8am sitting. Physio 8/31
//   and Micro 9/1 did not move.
//
// Net: two more prep days on the front, and four Exam 1s inside five business
// days instead of nine. Prep time gained, recovery time lost — so this is
// written as one continuous push rather than two separate weeks.
//
// The windowed exams are placed at 6am so a normal workday still fits. That is
// the one early start in here, it is twice, and it is the reason the change
// helps at all.

const SPRINT: DatedChange[] = [
  // ── Wed Aug 19 — the announcement lands, Micro Quiz 1 is done ──
  cut("2026-08-19", "MCAT"),
  cut("2026-08-19", "Light review"),
  add("2026-08-19", "17:00", "18:30", "Biochem — rework every missed Quiz 1 question", "study",
    "Start the error log with them. Then water, ionization, buffers, and pH vs pKa maths cold."),
  add("2026-08-19", "19:00", "20:00", "Micro deck — bacterial cytology I and II", "study",
    "The deck starts tonight. 15 minutes a day from here is the single thing that decides Micro."),
  add("2026-08-19", "21:00", "21:20", "Watch the Biochem Exam 1 review recording", "study",
    "It ran at 9 this morning. The reviews are the closest thing to being told what's on the exam."),

  // ── Thu Aug 20 ──
  cut("2026-08-20", "Block 1 — nearest assessment"),
  cut("2026-08-20", "Block 2 — next course up"),
  add("2026-08-20", "17:00", "18:30", "Biochem — cellular organisation, amino acids, then proteins", "study",
    "Structure, separation, purification. Ionization and pI calculation are the part that was never covered."),
  add("2026-08-20", "19:00", "20:00", "CMB — rework missed Quiz 1 questions, start the error log", "study"),

  // ── Fri Aug 21 — CMB review live at 8, off after 7 ──
  cut("2026-08-21", "Flex —"),
  cut("2026-08-21", "Gym"),
  add("2026-08-21", "08:00", "09:00", "CMB Exam 1 review — attend live", "study",
    "Live, not the recording. Missing a review to study alone is a bad trade."),
  add("2026-08-21", "16:00", "17:30", "Biochem — Enzymes I and II", "study",
    "Kinetics plots and inhibition types are the highest-yield material on this exam."),

  // ── Sat Aug 22 — last Saturday therapy ──
  cut("2026-08-22", "Hospital shadowing", "Shadowing pauses first in an exam sprint."),
  cut("2026-08-22", "Major driving exposure"),
  cut("2026-08-22", "Legal — storage unit"),
  cut("2026-08-22", "THE BIG BLOCK"),
  cut("2026-08-22", "Lunch"),
  cut("2026-08-22", "Short exposure drive"),
  cut("2026-08-22", "Gym"),
  add("2026-08-22", "10:00", "11:00", "Therapy — last Saturday session", "therapy",
    "From the 30th this moves to Sundays at 10, where it collides with church."),
  add("2026-08-22", "11:30", "15:00", "Biochem — full closed-note self test, all five topics", "study",
    "Cold, then patch only the misses. This is the block that turns the week into a grade."),
  add("2026-08-22", "15:30", "18:00", "CMB — cell structure, cell culture and stem cells, signalling I and II", "study"),

  // ── Sun Aug 23 ──
  cut("2026-08-23", "Long study"),
  cut("2026-08-23", "Groceries"),
  cut("2026-08-23", "Error log — all four courses"),
  cut("2026-08-23", "Weekly reset"),
  cut("2026-08-23", "Cook Mon–Wed meals"),
  add("2026-08-23", "07:30", "08:45", "Biochem — error log, then a second self test on enzymes only", "study",
    "Fresh brain before church. Only the enzymes."),
  add("2026-08-23", "14:00", "16:30", "CMB — cell cycle, cell cycle disruption and cancer", "study",
    "The two lectures that are on the exam but were never on the quiz."),
  add("2026-08-23", "19:30", "20:00", "Weekly reset — confirm BOTH exams are downloadable", "study",
    "A missed download window is an automatic zero however prepared you are. Check both now, not Tuesday night."),

  // ── Mon Aug 24 ──
  cut("2026-08-24", "Block 1 — nearest assessment"),
  cut("2026-08-24", "Block 2 — next course up"),
  add("2026-08-24", "10:00", "11:00", "Micro — Microbial Variation lecture", "work", "During work. Capture mode."),
  add("2026-08-24", "17:00", "18:30", "Biochem — final full self test", "study",
    "Anything under 90 goes straight on the log for tomorrow."),
  add("2026-08-24", "19:00", "20:00", "CMB — full self test across all six topics", "study"),

  // ── Tue Aug 25 — the night before ──
  cut("2026-08-25", "Block 1 — nearest assessment"),
  cut("2026-08-25", "Block 2 — next course up"),
  cut("2026-08-25", "Gym"),
  add("2026-08-25", "17:00", "18:00", "Biochem — error log only. Stop by 8.", "study", "Nothing new tonight."),
  add("2026-08-25", "18:00", "18:30", "CMB — patch the misses only, light", "study"),
  add("2026-08-25", "21:00", "21:20", "Tech check", "rest",
    "Webcam, mic, bandwidth, Examplify login. A dead feed means no points, however well you know it."),

  // ── Wed Aug 26 — BIOCHEM EXAM 1, window midnight to 10am ──
  add("2026-08-26", "06:00", "08:00", "BIOCHEMISTRY EXAM 1 — sit it early in the window", "study",
    "15% of the grade. The window is midnight to 10am — sitting it at 6 still leaves you a normal workday."),
  cut("2026-08-26", "Light review"),
  cut("2026-08-26", "Up, breakfast, at your desk", "Exam window opens at midnight — you\u2019re up for it."),
  cut("2026-08-26", "MCAT"),
  cut("2026-08-26", "WFH ·"),
  add("2026-08-26", "08:00", "11:00", "WFH — desk from 8 · Biochem 8–10 · Physio from 10", "work",
    "You’re home. The exam runs until 8, then you’re at your desk as normal."),
  add("2026-08-26", "10:00", "11:00", "CMB — DNA Structure lecture", "work", "During work."),
  add("2026-08-26", "17:00", "18:30", "CMB — final full review", "study", "Then stop by 8. Nothing new."),

  // ── Thu Aug 27 — CMB EXAM 1, and the Physio review ──
  add("2026-08-27", "06:00", "08:00", "CELL & MOLECULAR EXAM 1 — sit it early in the window", "study", "15%. Midnight to 10am."),
  cut("2026-08-27", "Block 1 — nearest assessment"),
  cut("2026-08-27", "Block 2 — next course up"),
  cut("2026-08-27", "Gym"),
  cut("2026-08-27", "Up, shower, breakfast, out", "Exam window opens at midnight — you\u2019re up for it."),
  cut("2026-08-27", "Work · Micro"),
  add("2026-08-27", "08:30", "12:00", "Work — late start, in at 8:30", "work",
    "Ask for it this week, not that morning. Two hours, once, for a 15% exam."),
  add("2026-08-27", "10:00", "11:00", "Physiology Exam 1 review — attend live", "study", "Even on exam morning. This one is worth it."),
  add("2026-08-27", "13:00", "14:00", "Micro — Genetic Exchange lecture", "work",
    "Moved from 8am to 1pm and it collides with your exam morning. You are still responsible for it — catch the recording."),
  add("2026-08-27", "19:00", "20:00", "Physio — rework missed Quiz 1 questions", "study", "Rest until the evening. Then start."),

  // ── Fri Aug 28 ──
  cut("2026-08-28", "Flex —"),
  cut("2026-08-28", "Gym"),
  add("2026-08-28", "09:00", "10:00", "Microbiology Exam 1 review — attend live", "study"),
  add("2026-08-28", "16:00", "17:30", "Physio — fluid homeostasis and membrane transport", "study"),
  add("2026-08-28", "17:30", "18:00", "Micro — antimicrobial agents", "study"),

  // ── Sat Aug 29 ──
  cut("2026-08-29", "Hospital shadowing"),
  cut("2026-08-29", "Major driving exposure"),
  cut("2026-08-29", "THE BIG BLOCK"),
  cut("2026-08-29", "Lunch"),
  cut("2026-08-29", "Gym"),
  cut("2026-08-29", "Short exposure drive"),
  add("2026-08-29", "09:00", "12:00", "Physio — NMJ and muscle, then heart, blood and circulation", "study"),
  add("2026-08-29", "13:00", "16:00", "Micro — bacterial physiology I and II, gene regulation, microbial variation", "study"),

  // ── Sun Aug 30 — Sunday therapy starts, and it clashes with church ──
  cut("2026-08-30", "Long study"),
  cut("2026-08-30", "Groceries"),
  cut("2026-08-30", "Error log — all four courses"),
  cut("2026-08-30", "Weekly reset"),
  cut("2026-08-30", "Cook Mon–Wed meals"),
  add("2026-08-30", "07:30", "08:45", "Physio — full closed-notes self test, all four topics", "study", "Then patch the misses."),
  add("2026-08-30", "14:00", "16:30", "Micro — genetic exchange, then deck review of all 16 lectures", "study",
    "Every lecture the exam covers, through the deck. This is what the deck was started for."),
  add("2026-08-30", "19:30", "20:00", "Confirm both exams downloaded. Tech check.", "study"),

  // ── Mon Aug 31 — PHYSIO EXAM 1 ──
  add("2026-08-31", "08:00", "10:00", "PHYSIOLOGY EXAM 1", "study", "15%. Fixed 8am start — this one did not move."),
  cut("2026-08-31", "Block 1 — nearest assessment"),
  cut("2026-08-31", "Gym"),
  cut("2026-08-31", "Block 2 — next course up"),
  add("2026-08-31", "17:00", "18:30", "Micro — full self test across all eight exam topics", "study", "Then patch. Tomorrow is the last one."),
  add("2026-08-31", "19:00", "20:00", "Micro — patch the misses", "study"),

  // ── Tue Sep 1 — MICRO EXAM 1, then stop ──
  add("2026-09-01", "08:00", "10:00", "MICROBIOLOGY EXAM 1", "study", "15%. The last of the four."),
  cut("2026-09-01", "Block 1 — nearest assessment"),
  cut("2026-09-01", "Block 2 — next course up"),
  add("2026-09-01", "17:00", "18:30", "Done. Take the evening.", "rest",
    "Four exams in five business days. CMB Quiz 2 is Friday, so pre-load DNA topics Wednesday and Thursday — but not tonight."),
];

export const TEMP_WEEKS: TempWeek[] = [
  {
    id: "exam-1-sprint-2026",
    name: "Exam 1 sprint",
    why: "Four Exam 1s in five business days — Biochem 8/26, CMB 8/27, Physio 8/31, Micro 9/1. Everything cuttable is cut until it\u2019s over.",
    from: "2026-08-19",
    to: "2026-09-01",
    changes: SPRINT,
  },
];

/** The temporary week covering a date, if there is one. */
export function tempWeekFor(date: string): TempWeek | null {
  return TEMP_WEEKS.find(w => date >= w.from && date <= w.to) ?? null;
}

/** Every built-in change landing between two dates, inclusive. */
export function tempChangesBetween(from: string, to: string): DatedChange[] {
  return TEMP_WEEKS.flatMap(w => w.changes).filter(c => c.date >= from && c.date <= to);
}

// Saved overrides carry no category — they arrive as a label and a time. This
// picks a colour from the words so a voice-added block doesn't render grey
// next to everything else.
const CAT_WORDS: Array<[RegExp, Cat]> = [
  [/gym|workout|lift|run|walk/i, "gym"],
  [/study|lecture|review|quiz|exam|test|retriev|flashcard|mcat|biochem|physio|micro|cmb|molecular/i, "study"],
  [/work|class|shift|office/i, "work"],
  [/therapy|therapist|counsel/i, "therapy"],
  [/drive|driving|exposure|heights/i, "exposure"],
  [/lawyer|legal|cook|laundry|clean|grocer|budget|bill|errand|dinner|lunch|breakfast/i, "life"],
  [/church|family|friend|deandra|call|visit|birthday|shadow/i, "people"],
  [/skincare|bed|sleep|rest|break|wind|buffer/i, "rest"],
];

export function catFor(label: string, fallback: Cat = "life"): Cat {
  for (const [re, cat] of CAT_WORDS) if (re.test(label)) return cat;
  return fallback;
}
