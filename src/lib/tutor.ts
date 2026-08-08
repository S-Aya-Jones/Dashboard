import { neonClient } from "@/lib/neon";

// The teaching assistant is grounded in her own material.
//
// A general-purpose chatbot can already explain the Krebs cycle. What it
// can't do is explain it the way her professor did, using the terminology on
// her slides, while knowing that she has missed two questions on regulation
// in the last fortnight. That's the whole difference, and it's why this
// assembles context from her lectures and her error log before answering.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

export interface LectureContext {
  id: string;
  title: string;
  course: string;
  outline: string;
  examFocus: string | null;
}

export interface MissContext {
  question: string;
  correct: string | null;
  chosen: string | null;
  lectureTitle: string | null;
  missedAt: string;
}

export interface TutorContext {
  course: string;
  lectures: LectureContext[];
  misses: MissContext[];
  hasMaterial: boolean;
}

/**
 * Everything the tutor should know before answering.
 *
 * Outlines rather than transcripts: an outline is the distilled lecture and a
 * fraction of the size, so several fit in context where two transcripts
 * wouldn't. When a single lecture is in focus its transcript is included too,
 * because then the depth is worth the room.
 */
export async function buildTutorContext(
  course: string,
  focusLectureId?: string,
): Promise<TutorContext> {
  const sql = db();

  const rows = await sql`
    SELECT id, title, course, outline, exam_focus, transcript
    FROM lectures
    WHERE course = ${course} AND status = 'ready'
    ORDER BY created_at DESC
    LIMIT 12
  `;

  const lectures: LectureContext[] = rows.map((r) => {
    const isFocus = focusLectureId && r.id === focusLectureId;
    const outline = String(r.outline ?? "");
    // The focused lecture gets its transcript as well; the rest get the
    // outline only, capped so one enormous lecture can't crowd out the others.
    const body = isFocus && r.transcript
      ? `${outline}\n\n--- Full transcript ---\n${String(r.transcript).slice(0, 24000)}`
      : outline.slice(0, 6000);
    return {
      id: String(r.id),
      title: String(r.title),
      course: String(r.course),
      outline: body,
      examFocus: r.exam_focus ? String(r.exam_focus) : null,
    };
  });

  const missRows = await sql`
    SELECT e.question, e.correct, e.chosen, e.missed_at, l.title AS lecture_title
    FROM error_log e
    LEFT JOIN lectures l ON l.id = e.lecture_id
    WHERE e.course = ${course}
    ORDER BY e.missed_at DESC
    LIMIT 40
  `;

  const misses: MissContext[] = missRows.map((r) => ({
    question: String(r.question),
    correct: r.correct ? String(r.correct) : null,
    chosen: r.chosen ? String(r.chosen) : null,
    lectureTitle: r.lecture_title ? String(r.lecture_title) : null,
    missedAt: String(r.missed_at),
  }));

  return {
    course,
    lectures,
    misses,
    hasMaterial: lectures.some((l) => l.outline.trim().length > 0),
  };
}

/** The context, rendered for the model. */
export function renderContext(ctx: TutorContext): string {
  const parts: string[] = [];

  if (ctx.lectures.length) {
    parts.push("=== HER LECTURES IN THIS COURSE ===");
    for (const l of ctx.lectures) {
      parts.push(`\n--- Lecture: ${l.title} (id: ${l.id}) ---\n${l.outline}`);
      if (l.examFocus) parts.push(`Exam focus flagged for this lecture: ${l.examFocus}`);
    }
  } else {
    parts.push("=== SHE HAS NO PROCESSED LECTURES IN THIS COURSE YET ===");
  }

  if (ctx.misses.length) {
    parts.push("\n=== QUESTIONS SHE HAS ACTUALLY GOT WRONG ===");
    parts.push("These are her real misses, most recent first. Weight your teaching toward them.");
    for (const m of ctx.misses.slice(0, 25)) {
      parts.push(
        `- ${m.question}` +
        (m.correct ? `\n  correct: ${m.correct}` : "") +
        (m.chosen ? `\n  she chose: ${m.chosen}` : "") +
        (m.lectureTitle ? `\n  from: ${m.lectureTitle}` : "")
      );
    }
  }

  return parts.join("\n");
}

export type TutorMode = "explain" | "quiz" | "drill-misses" | "exam-prep";

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  explain:
    "She's asking you to teach something. Explain it properly and in depth — she's a graduate health-sciences student, not a beginner. Build from the mechanism up rather than listing facts. Use a concrete example. Then ask her one question that checks she actually followed, and stop.",
  quiz:
    "Quiz her. Ask ONE question at a time, at the difficulty of a graduate course exam, drawn from her lecture material. Wait for her answer before revealing anything. When she answers, say whether she's right, explain WHY the right answer is right and why hers was wrong if it was, then ask the next one.",
  "drill-misses":
    "Work through the things she has actually got wrong. Pick one miss, re-teach the underlying concept rather than just restating the answer, then ask her a fresh question testing the same idea in different words. One at a time.",
  "exam-prep":
    "She has an assessment coming. Focus on what's most likely to be tested and what she's weakest on. Be direct about priorities — say what to study first and what to leave. Where her lectures flag exam focus, weight toward that.",
};

export function buildSystemPrompt(ctx: TutorContext, mode: TutorMode): string {
  return `You are Aya's teaching assistant for ${ctx.course}. She is a Master of Health Sciences student aiming for medical school, sitting the MCAT in November 2026.

${MODE_INSTRUCTIONS[mode]}

GROUNDING — this is the important part:
- Teach from HER lecture material below wherever it covers the topic. Use her professor's framing and terminology.
- When you use something from a specific lecture, name it: "your Water Structure lecture covered this as…".
- If she asks about something her lectures don't cover, say so plainly — "this isn't in your notes, but here's the standard picture" — and then answer anyway. Never pretend something came from her material when it didn't.
- If her material and general knowledge conflict, say so rather than silently picking one. Her exam will follow her professor.

HOW TO TEACH:
- Graduate level. Don't over-simplify, don't pad, don't flatter.
- Mechanism before memorisation. She needs to reason on exam day, not recite.
- Keep it tight — a few paragraphs, not an essay. She studies in 90-minute blocks with a job and a commute.
- Plain text. No markdown headers, no bullet-point walls, no LaTeX. Write in sentences. Use real symbols (→, ⇌, ×, ≈, subscripts) rather than notation.
- End most turns with one question back to her. Teaching is not lecturing.

${renderContext(ctx)}`;
}
