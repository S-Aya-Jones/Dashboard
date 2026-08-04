import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// All course deadlines extracted from syllabi
// CDT = UTC-5 (Aug-Oct), CST = UTC-6 (Nov+)
const DEADLINES = [
  // ── Microbiology (GMHS-706) ──
  { id: "course-micro-q1",  course: "Microbiology", type: "quiz", title: "Microbiology — Quiz 1",  date: "2026-08-19T18:00:00.000Z" },
  { id: "course-micro-e1",  course: "Microbiology", type: "exam", title: "Microbiology — Exam 1",  date: "2026-09-01T13:00:00.000Z" },
  { id: "course-micro-q2",  course: "Microbiology", type: "quiz", title: "Microbiology — Quiz 2",  date: "2026-09-16T18:00:00.000Z" },
  { id: "course-micro-e2",  course: "Microbiology", type: "exam", title: "Microbiology — Exam 2",  date: "2026-10-06T13:00:00.000Z" },
  { id: "course-micro-q3",  course: "Microbiology", type: "quiz", title: "Microbiology — Quiz 3",  date: "2026-10-16T13:00:00.000Z" },
  { id: "course-micro-q4",  course: "Microbiology", type: "quiz", title: "Microbiology — Quiz 4",  date: "2026-11-02T19:00:00.000Z" },
  { id: "course-micro-q5",  course: "Microbiology", type: "quiz", title: "Microbiology — Quiz 5",  date: "2026-11-11T19:00:00.000Z" },
  { id: "course-micro-e3",  course: "Microbiology", type: "exam", title: "Microbiology — Exam 3",  date: "2026-11-18T14:00:00.000Z" },

  // ── Cell & Molecular Biology (GMHS-710) ──
  { id: "course-cmb-q1",   course: "Cell & Molecular Bio", type: "quiz", title: "CMB — Quiz 1",    date: "2026-08-17T18:00:00.000Z" },
  { id: "course-cmb-e1",   course: "Cell & Molecular Bio", type: "exam", title: "CMB — Exam 1",    date: "2026-08-25T13:00:00.000Z" },
  { id: "course-cmb-q2",   course: "Cell & Molecular Bio", type: "quiz", title: "CMB — Quiz 2",    date: "2026-09-04T13:00:00.000Z" },
  { id: "course-cmb-q3",   course: "Cell & Molecular Bio", type: "quiz", title: "CMB — Quiz 3",    date: "2026-09-18T13:00:00.000Z" },
  { id: "course-cmb-e2",   course: "Cell & Molecular Bio", type: "exam", title: "CMB — Exam 2",    date: "2026-09-22T13:00:00.000Z" },
  { id: "course-cmb-q4",   course: "Cell & Molecular Bio", type: "quiz", title: "CMB — Quiz 4",    date: "2026-10-07T18:00:00.000Z" },
  { id: "course-cmb-q5",   course: "Cell & Molecular Bio", type: "quiz", title: "CMB — Quiz 5",    date: "2026-10-26T18:00:00.000Z" },
  { id: "course-cmb-e3",   course: "Cell & Molecular Bio", type: "exam", title: "CMB — Exam 3",    date: "2026-11-09T14:00:00.000Z" },

  // ── Physiology (GMHS-709) ──
  { id: "course-phys-q1",  course: "Physiology", type: "quiz", title: "Physiology — Quiz 1",       date: "2026-08-13T18:00:00.000Z" },
  { id: "course-phys-e1",  course: "Physiology", type: "exam", title: "Physiology — Exam 1",       date: "2026-08-31T13:00:00.000Z" },
  { id: "course-phys-q2",  course: "Physiology", type: "quiz", title: "Physiology — Quiz 2",       date: "2026-09-11T18:00:00.000Z" },
  { id: "course-phys-q3",  course: "Physiology", type: "quiz", title: "Physiology — Quiz 3",       date: "2026-10-02T13:00:00.000Z" },
  { id: "course-phys-e2",  course: "Physiology", type: "exam", title: "Physiology — Exam 2",       date: "2026-10-09T13:00:00.000Z" },
  { id: "course-phys-q4",  course: "Physiology", type: "quiz", title: "Physiology — Quiz 4",       date: "2026-10-23T13:00:00.000Z" },
  { id: "course-phys-q5",  course: "Physiology", type: "quiz", title: "Physiology — Quiz 5",       date: "2026-11-06T14:00:00.000Z" },
  { id: "course-phys-e3",  course: "Physiology", type: "exam", title: "Physiology — Exam 3",       date: "2026-11-20T14:00:00.000Z" },

  // ── Biochemistry ──
  { id: "course-bioch-q1", course: "Biochemistry", type: "quiz", title: "Biochemistry — Quiz 1",   date: "2026-08-14T18:00:00.000Z" },
  { id: "course-bioch-e1", course: "Biochemistry", type: "exam", title: "Biochemistry — Exam 1",   date: "2026-08-24T13:00:00.000Z" },
  { id: "course-bioch-q2", course: "Biochemistry", type: "quiz", title: "Biochemistry — Quiz 2",   date: "2026-09-10T13:00:00.000Z" },
  { id: "course-bioch-q3", course: "Biochemistry", type: "quiz", title: "Biochemistry — Quiz 3",   date: "2026-09-25T13:00:00.000Z" },
  { id: "course-bioch-e2", course: "Biochemistry", type: "exam", title: "Biochemistry — Exam 2",   date: "2026-10-12T13:00:00.000Z" },
  { id: "course-bioch-q4", course: "Biochemistry", type: "quiz", title: "Biochemistry — Quiz 4",   date: "2026-10-30T13:00:00.000Z" },
  { id: "course-bioch-q5", course: "Biochemistry", type: "quiz", title: "Biochemistry — Quiz 5",   date: "2026-11-12T14:00:00.000Z" },
  { id: "course-bioch-e3", course: "Biochemistry", type: "exam", title: "Biochemistry — Exam 3",   date: "2026-11-16T14:00:00.000Z" },
];

export async function POST() {
  const sql = db();

  // Ensure email_events table exists
  await sql`
    CREATE TABLE IF NOT EXISTS email_events (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email_id       TEXT NOT NULL,
      event_type     TEXT NOT NULL,
      title          TEXT NOT NULL,
      event_date     TEXT NOT NULL,
      is_past        BOOLEAN NOT NULL DEFAULT false,
      source_subject TEXT,
      source_sender  TEXT,
      source_preview TEXT,
      notified       BOOLEAN DEFAULT false,
      created_at     TEXT DEFAULT NOW()::TEXT
    )
  `;

  const now = new Date();

  // Delete existing course seeds then re-insert (idempotent)
  await sql`DELETE FROM email_events WHERE email_id LIKE 'course-%'`;

  let inserted = 0;
  for (const d of DEADLINES) {
    const eventDate = new Date(d.date);
    const isPast = eventDate < now;
    await sql`
      INSERT INTO email_events (id, email_id, event_type, title, event_date, is_past, source_subject, source_sender, source_preview)
      VALUES (
        ${d.id},
        ${d.id},
        'deadline',
        ${d.title},
        ${d.date},
        ${isPast},
        ${d.title},
        ${d.course},
        ${`${d.type === "exam" ? "Exam" : "Quiz"} — check Blackboard for study guide`}
      )
      ON CONFLICT (id) DO UPDATE SET
        title      = EXCLUDED.title,
        event_date = EXCLUDED.event_date,
        is_past    = EXCLUDED.is_past
    `;
    inserted++;
  }

  const upcoming = DEADLINES.filter(d => new Date(d.date) >= now);
  const past     = DEADLINES.filter(d => new Date(d.date) < now);

  return NextResponse.json({
    ok: true,
    seeded: inserted,
    upcoming: upcoming.length,
    past: past.length,
    message: `Seeded ${inserted} course deadlines (${upcoming.length} upcoming, ${past.length} past)`,
  });
}
