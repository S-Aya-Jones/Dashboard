import { NextRequest, NextResponse } from "next/server";
import { describeAiError } from "@/lib/aiError";
import Anthropic from "@anthropic-ai/sdk";
import { getLecture } from "@/lib/lectures";
import { insertQuestions, countQuestions, clearQuestions } from "@/lib/qbank";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();
const MAX_TRANSCRIPT = 55000;

// Four batches, each its own request — a single call for 45+ questions would
// blow Vercel's 60s cap. Each batch owns different formats so they don't
// duplicate each other's work.
const BATCHES: Array<{ label: string; spec: string }> = [
  {
    label: "Clinical vignettes",
    spec: `Write 8 questions with format "mcq" (single best answer).
payload: { "choices": ["...","...","...","..."] }  — exactly 4 choices
answer: the INDEX of the correct choice as a string, e.g. "2"

All 8 are applied: "A patient presents with…", "In an experiment where X is inhibited…", "What happens to Y if Z rises…". Predict-the-outcome and reason-from-mechanism.`,
  },
  {
    label: "Which one of these",
    spec: `Write 8 questions with format "mcq" (single best answer).
payload: { "choices": ["...","...","...","..."] }  — exactly 4 choices
answer: index of the correct choice as a string

All 8 are DISCRIMINATION questions: every option is a real, related entity from the lecture and only one fits the stem exactly. Enzymes, structures, bonds, organisms, phases — things that are easy to confuse with each other.`,
  },
  {
    label: "Select all that apply",
    spec: `Write 7 questions with format "sata".
payload: { "choices": ["...","...","...","...","..."] }  — exactly 5 choices
answer: comma-separated INDICES of ALL correct choices, e.g. "0,2,4"  (2-4 correct)
Every stem ends with "Select all that apply."`,
  },
  {
    label: "Data interpretation",
    spec: `Write 7 questions with format "data".
payload: { "table": "a small markdown table or short list of values, lab results, or experimental measurements drawn from the lecture", "choices": ["...","...","...","..."] }
answer: index of the correct choice as a string
Each presents values and asks what they indicate, what changed, or what would happen next.`,
  },
  {
    label: "Sequencing & matching",
    spec: `Write 8 questions split between two formats.

FOUR with format "order" — pathways, cascades, cycles:
payload: { "items": ["step text", ...] }  — 4-6 steps in SCRAMBLED order
answer: comma-separated indices of payload.items in CORRECT sequence, e.g. "2,0,3,1"

FOUR with format "match":
payload: { "left": ["term","term","term","term"], "right": ["description","description","description","description"] }
answer: comma-separated index into payload.right for each payload.left item, in order, e.g. "2,0,3,1"
Use enzyme→function, organism→disease, hormone→effect, structure→role.`,
  },
  {
    label: "Written & draw-it",
    spec: `Write 8 free-response questions she answers in writing (or sketches on paper), then self-grades against a rubric.

FOUR with format "short":
payload: { "rubric": ["specific point a full-credit answer must contain", "...", "..."] }  — 3-5 points
answer: a complete model answer, 3-6 sentences

FOUR with format "trace" — the "draw this" questions:
prompt must ask her to DRAW or TRACE something: a pathway, cascade, feedback loop, labelled structure, a graph of a relationship, or a flow of events. e.g. "Draw the complete pathway from X to Y, labeling every enzyme and the rate-limiting step."
payload: { "rubric": ["each element the drawing must include", "...", "..."] }  — 4-6 points
answer: a model description of the correct drawing, as an ordered walkthrough she can check her sketch against`,
  },
];

const SYSTEM_BASE = `You write exam questions for a graduate biomedical science course at Meharry Medical College. The student is an MHS pre-med student; her exams are graduate-level.

Return ONLY a JSON object (no markdown fences):
{ "questions": [ { "topic": "...", "format": "...", "difficulty": "core|exam|hard", "prompt": "...", "payload": {...}, "answer": "...", "explanation": "..." } ] }

Universal rules:
- "topic" is a short subject label (2-4 words) so questions can be grouped and weak areas found. Reuse consistent topic names.
- Every question must be answerable from the lecture material you are given. Never invent facts not present.
- Distractors must be plausible — things a student who half-knows the material would pick. No filler options.
- "explanation" must teach: why the answer is right, and why the most tempting wrong option is wrong.
- Spread questions across the WHOLE lecture, not just the opening.
- Write at real exam difficulty. Prefer application, prediction, and discrimination over recall of definitions.`;

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try harder */ }
  try {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* truncated — salvage below */ }

  // Truncated mid-array: keep every complete question object we can parse
  const objects: unknown[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = cleaned.indexOf("[") + 1; i < cleaned.length && i > 0; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try { objects.push(JSON.parse(cleaned.slice(start, i + 1))); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  if (objects.length) return { questions: objects };
  throw new Error("model returned unparseable output");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const batch = Number(req.nextUrl.searchParams.get("batch") ?? "0");
  if (!Number.isInteger(batch) || batch < 0 || batch >= BATCHES.length) {
    return NextResponse.json({ error: `batch must be 0-${BATCHES.length - 1}` }, { status: 400 });
  }

  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });
    const transcript = (lecture.transcript ?? "").trim();
    if (!transcript) return NextResponse.json({ error: "lecture has no transcript yet" }, { status: 400 });

    const { label, spec } = BATCHES[batch];

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4500,
      system: `${SYSTEM_BASE}\n\nTHIS BATCH — ${label}:\n${spec}`,
      messages: [{
        role: "user",
        content: (() => {
          // Figures and exact values live on the slides, and those are what
          // graduate-level questions are actually built from.
          const slides = (lecture.slidesText ?? "").trim().slice(0, 18000);
          const base = `Course: ${lecture.course}\nLecture: ${lecture.title}\n\nTranscript:\n\n${transcript.slice(0, MAX_TRANSCRIPT)}`;
          return slides
            ? `${base}\n\n=== SLIDES FOR THIS LECTURE ===\n\n${slides}`
            : base;
        })(),
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseJson(raw);
    const items = Array.isArray(parsed.questions) ? parsed.questions : [];
    // Batch 0 starts a fresh bank so re-running (Resume) never duplicates
    if (batch === 0) await clearQuestions(params.id);
    const added = await insertQuestions(params.id, lecture.course, items);
    const total = await countQuestions(params.id);

    return NextResponse.json({ ok: true, batch, label, added, total });
  } catch (e) {
    const f = describeAiError(e);
    return NextResponse.json(
      { error: f.message, blocking: f.blocking, batch },
      { status: f.blocking ? 402 : 500 },
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ total: await countQuestions(params.id), batches: BATCHES.length });
}
