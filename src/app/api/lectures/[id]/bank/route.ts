import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLecture } from "@/lib/lectures";
import { insertQuestions, countQuestions } from "@/lib/qbank";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();
const MAX_TRANSCRIPT = 55000;

// Four batches, each its own request — a single call for 45+ questions would
// blow Vercel's 60s cap. Each batch owns different formats so they don't
// duplicate each other's work.
const BATCHES: Array<{ label: string; spec: string }> = [
  {
    label: "Single best answer",
    spec: `Write 14 questions with format "mcq" (single best answer).
payload: { "choices": ["...","...","...","..."] }  — exactly 4 choices
answer: the INDEX of the correct choice as a string, e.g. "2"

Mix of:
- 6 clinical/applied vignettes ("A patient presents with…", "In an experiment where X is inhibited…")
- 4 mechanism questions ("What is the immediate consequence of…", "Which step is rate-limiting…")
- 4 "which one of these" discrimination questions where all options are real, related entities and only one fits the stem exactly`,
  },
  {
    label: "Select-all + data interpretation",
    spec: `Write 12 questions split between two formats.

SIX with format "sata" (select all that apply):
payload: { "choices": ["...","...","...","...","..."] }  — exactly 5 choices
answer: comma-separated INDICES of ALL correct choices, e.g. "0,2,4"  (2-4 should be correct)
Stem must say "Select all that apply."

SIX with format "data" (interpret values, then choose):
payload: { "table": "a small markdown table or a short list of values/results from the lecture", "choices": ["...","...","...","..."] }
answer: index of the correct choice as a string
These present lab values, experimental results, or measurements and ask what they indicate.`,
  },
  {
    label: "Sequencing + matching",
    spec: `Write 10 questions split between two formats.

FIVE with format "order" (put the steps in sequence) — ideal for pathways, cascades, cycles:
payload: { "items": ["step text", "step text", ...] }  — 4-6 steps, listed in SCRAMBLED order
answer: comma-separated indices of payload.items in their CORRECT sequence, e.g. "2,0,3,1"

FIVE with format "match" (match column A to column B):
payload: { "left": ["term","term","term","term"], "right": ["description","description","description","description"] }
answer: comma-separated index into payload.right for each payload.left item, in order, e.g. "2,0,3,1"
Use for enzyme→function, organism→disease, hormone→effect, structure→role.`,
  },
  {
    label: "Written & trace-it",
    spec: `Write 10 free-response questions the student answers in writing (or sketches on paper), then self-grades against a rubric.

FIVE with format "short":
payload: { "rubric": ["specific point a full-credit answer must contain", "...", "..."] }  — 3-5 rubric points
answer: a complete model answer, 3-6 sentences

FIVE with format "trace" — these are the "draw this / trace the pathway" questions:
prompt must ask her to DRAW or TRACE something: a pathway, a cascade, a feedback loop, a structure with labels, a graph of a relationship, or a flow of events. e.g. "Draw the complete pathway from X to Y, labeling every enzyme and the rate-limiting step."
payload: { "rubric": ["each element the drawing must include", "...", "..."] }  — 4-6 rubric points
answer: a complete model description of what the correct drawing contains, written as an ordered walkthrough she can compare her sketch against`,
  },
];

const SYSTEM_BASE = `You write exam questions for a graduate biomedical science course at Meharry Medical College. The student is an MHS pre-med student; her exams are graduate-level.

Return ONLY a JSON object (no markdown fences):
{ "questions": [ { "topic": "...", "format": "...", "difficulty": "core|exam|hard", "prompt": "...", "payload": {...}, "answer": "...", "explanation": "..." } ] }

Universal rules:
- "topic" is a short subject label (2-4 words) so questions can be grouped and weak areas found. Reuse consistent topic names.
- Every question must be answerable from the lecture transcript. Never invent facts not present.
- Distractors must be plausible — things a student who half-knows the material would pick. No filler options.
- "explanation" must teach: why the answer is right, and why the most tempting wrong option is wrong.
- Spread questions across the WHOLE lecture, not just the opening.
- Write at real exam difficulty. Prefer application, prediction, and discrimination over recall of definitions.`;

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("model returned unparseable output");
  return JSON.parse(m[0]);
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
      max_tokens: 8000,
      system: `${SYSTEM_BASE}\n\nTHIS BATCH — ${label}:\n${spec}`,
      messages: [{
        role: "user",
        content: `Course: ${lecture.course}\nLecture: ${lecture.title}\n\nTranscript:\n\n${transcript.slice(0, MAX_TRANSCRIPT)}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseJson(raw);
    const items = Array.isArray(parsed.questions) ? parsed.questions : [];
    const added = await insertQuestions(params.id, lecture.course, items);
    const total = await countQuestions(params.id);

    return NextResponse.json({ ok: true, batch, label, added, total });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300), batch }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ total: await countQuestions(params.id), batches: BATCHES.length });
}
