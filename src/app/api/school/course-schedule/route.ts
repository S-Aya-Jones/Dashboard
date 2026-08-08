import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { upsertObligation } from "@/lib/obligations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// The course schedule arrives as a PDF of week-by-week grids. Extracting it by
// hand means rewriting the week plan every term; extracting it here means she
// uploads the new one and the study blocks re-aim themselves.
//
// Only assessments are pulled out. Individual lecture titles are noise — she
// knows she has Biochem on Monday; what she needs is the date of Quiz 3.

const SYSTEM = `You read a graduate course schedule and pull out every graded
assessment and review session.

Return ONLY a JSON array. Each item:
{
  "course": "Biochemistry" | "Microbiology" | "Physiology" | "Cell & Molecular Biology",
  "kind": "quiz" | "exam" | "review" | "final",
  "title": "Biochemistry Quiz 1",
  "date": "YYYY-MM-DD"
}

Rules:
- Include quizzes, examinations, exam reviews and finals. Nothing else.
- Do NOT include ordinary lectures, Independent Study, or Rap Sessions.
- The grid is laid out in columns by weekday. An assessment belongs to the day
  whose column it sits in — be careful, the text may arrive column-jumbled.
- Every date must be a real date in the schedule. Never invent one.
- If you cannot place something confidently, leave it out.
- Return [] if there are no assessments.`;

interface Extracted {
  course: string;
  kind: string;
  title: string;
  date: string;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const year = Number(form.get("year")) || new Date().getFullYear();
    // Two-step on purpose: she sees what was found before any of it becomes a
    // notification she'll be woken up by.
    const commit = form.get("commit") === "1";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach the schedule PDF." }, { status: 400 });
    }
    if (file.size > 4_000_000) {
      return NextResponse.json({ error: "That PDF is too large to upload here." }, { status: 400 });
    }

    // Send the PDF itself rather than extracted text. The schedule is a grid,
    // and text extraction flattens the columns so an assessment loses the day
    // it belonged to — reading the document directly keeps the layout.
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: `${SYSTEM}\n\nThe academic year starts in ${year}. Dates written as MM/DD belong to that year, rolling into ${year + 1} after December.`,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Pull out every assessment. Return only the JSON array." },
        ],
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const found: Extracted[] = [];
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Extracted[];
        if (Array.isArray(parsed)) found.push(...parsed);
      } catch { /* fall through to the empty-result response below */ }
    }

    // Guard the model's output before any of it reaches the obligations table.
    const seen = new Set<string>();
    const unique = found.filter((a) => {
      if (!a?.date || !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !a.title) return false;
      const key = `${a.course}|${a.title}|${a.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!commit) {
      return NextResponse.json({
        ok: true,
        preview: true,
        imported: 0,
        assessments: unique.sort((x, y) => x.date.localeCompare(y.date)),
      });
    }

    for (const a of unique) {
      const isExam = /exam|final/i.test(a.kind) || /exam|final/i.test(a.title);
      const isReview = /review/i.test(a.kind) || /review/i.test(a.title);

      // Per the 6 Aug schedule-update email: everything opens at 12:00 AM on
      // the day and the time printed on the grid is the START of the window,
      // not the deadline. Quizzes run 8–9, exams 8–10, and they are due at the
      // END of that window. Storing 8:00 would have made every reminder an
      // hour pessimistic and the "due now" ping fire while she still had the
      // whole window left.
      const dueTime = isReview ? "08:00" : isExam ? "10:00" : "09:00";

      const window = isReview
        ? a.course
        : `${a.course} · opens 12:00am, ${isExam ? "8–10am" : "8–9am"} testing window, due ${isExam ? "10am" : "9am"}. Help is only available inside the window.`;

      await upsertObligation({
        source: "school",
        kind: isExam ? "exam" : "assignment",
        title: a.title,
        detail: window,
        dueAt: `${a.date}T${dueTime}:00-05:00`,
        // Exams get a longer runway than quizzes.
        leadDays: isExam ? [10, 7, 3, 1, 0] : [5, 3, 1, 0],
        // Stable id so re-uploading an amended schedule updates rather than
        // duplicates.
        externalId: `course-${a.course}-${a.title}-${a.date}`.replace(/\s+/g, "-").toLowerCase(),
      });
    }

    return NextResponse.json({
      ok: true,
      imported: unique.length,
      assessments: unique.sort((x, y) => x.date.localeCompare(y.date)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read that schedule" },
      { status: 500 }
    );
  }
}
