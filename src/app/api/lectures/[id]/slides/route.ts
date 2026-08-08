import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { neonClient } from "@/lib/neon";
import { getLecture, updateLecture, ensureLectureTables } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// Slides get read once, here, and stored as text.
//
// The alternative — keeping the deck and attaching it to all twelve generation
// calls — would re-bill every page of it a dozen times and put a term of PDFs
// in the database. Reading it once into a compact transcript of the deck costs
// one pass and leaves something small enough to sit alongside the transcript in
// every later prompt.
const MAX_SLIDES_TEXT = 40000;

// Slides per request. A whole deck in one call overran Vercel's 60s function
// limit and came back as an HTML gateway error, which the client could only
// report as "couldn't read those slides". Windows keep each call short; the
// PDF is marked for prompt caching so re-sending it per window is cheap.
const WINDOW = 12;
const END_MARKER = "END_OF_DECK";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

const DIGEST_SYSTEM = `You are reading a lecture slide deck for a master's student at Meharry Medical College (Biochemistry, Physiology, Microbiology, Cell & Molecular Biology). Her notes are generated from the lecture recording; these slides are the second source, and they carry what the recording cannot — figures, structures, tables, and the exact spelling of terms.

Transcribe the deck slide by slide, in order. For each slide:

SLIDE <n>: <the slide's title, or a short description if untitled>
- every bullet, label, and line of text on the slide, verbatim where it is a term, value, or definition
- for any figure, diagram, graph, pathway, chemical structure or micrograph: a line beginning "FIGURE:" describing what it shows, its axes or steps, and what it is demonstrating. Be specific — this description is the only record of it.
- for any table: reproduce it as a markdown table

Rules:
- Do not summarize, editorialize, or skip slides. A slide with only a title still gets an entry.
- Keep every number, unit, normal range, enzyme, gene and drug name exactly as printed.
- Write chemistry and formulas in plain readable notation, never LaTeX. No $, \\frac or backslash commands. Use ^ for exponents and charges.
- Output plain text only. No preamble, no closing remarks.
- You will be asked for a numbered range of slides. Transcribe only that range.
- If the deck ends before the end of the range, transcribe what exists and then output the single line ${END_MARKER}. Output that line only when you have reached the last slide of the deck.`;

/** Reassemble the staged base64 pieces, in order. */
async function assemble(lectureId: string): Promise<string> {
  const sql = db();
  const rows = await sql`
    SELECT data FROM lecture_slide_parts WHERE lecture_id = ${lectureId} ORDER BY idx ASC
  `;
  return rows.map(r => String(r.data)).join("");
}

async function clearParts(lectureId: string) {
  const sql = db();
  await sql`DELETE FROM lecture_slide_parts WHERE lecture_id = ${lectureId}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureLectureTables();
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "slides";
    // A recording can cover two lectures, so a second deck extends the first
    // rather than replacing it.
    const append = body.append === true;

    // PowerPoint is unzipped in the browser, so its text arrives directly and
    // needs no model pass.
    if (typeof body.text === "string" && body.text.trim()) {
      const prior = append ? (lecture.slidesText ?? "") : "";
      const merged = (prior ? `${prior}\n\n${body.text}` : body.text).slice(0, MAX_SLIDES_TEXT);
      await updateLecture(params.id, {
        slidesText: merged,
        slidesName: append && lecture.slidesName ? `${lecture.slidesName} + ${name}` : name,
      });
      return NextResponse.json({ ok: true, done: true, chars: merged.length });
    }

    // Otherwise the staged PDF pieces are reassembled and read, one window of
    // slides per request.
    const base64 = await assemble(params.id);
    if (!base64) {
      return NextResponse.json({ error: "No slide upload found — send the file first." }, { status: 400 });
    }

    const from = Number.isFinite(body.from) && body.from > 0 ? Math.floor(body.from) : 1;
    const to = from + WINDOW - 1;

    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3500,
        system: DIGEST_SYSTEM,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
              // Re-read per window otherwise; caching makes the repeat cheap.
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: `Course: ${lecture.course}\nLecture: ${lecture.title}\n\nTranscribe slides ${from} to ${to} of this deck.` },
          ],
        }],
      });

      const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const done = raw.includes(END_MARKER) || !raw.trim();
      const text = raw.replace(END_MARKER, "").trim();

      // The first window replaces whatever was there; later ones extend it, so
      // a re-run never doubles up the deck.
      const existing = from === 1 && !append ? "" : (lecture.slidesText ?? "");
      const merged = (existing ? `${existing}\n\n${text}` : text).slice(0, MAX_SLIDES_TEXT);

      await updateLecture(params.id, {
        slidesText: merged,
        slidesName: append && from === 1 && lecture.slidesName ? `${lecture.slidesName} + ${name}` : (lecture.slidesName && from > 1 ? lecture.slidesName : name),
      });

      const finished = done || merged.length >= MAX_SLIDES_TEXT;
      // Staging rows exist only to survive the multi-request upload.
      if (finished) await clearParts(params.id);

      return NextResponse.json({ ok: true, done: finished, next: from + WINDOW, chars: merged.length });
    } catch (e) {
      // Leave the staged pieces in place so a retry doesn't mean re-uploading.
      const raw = String(e);
      if (/\b413\b|too large|exceeds/i.test(raw)) {
        return NextResponse.json(
          { error: "That deck is too big to read in one pass. Split it, or export a smaller PDF." },
          { status: 413 },
        );
      }
      return NextResponse.json({ error: `The slides couldn't be read (${raw.slice(0, 180)})` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureLectureTables();
    await updateLecture(params.id, { slidesText: null, slidesName: null });
    await clearParts(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
