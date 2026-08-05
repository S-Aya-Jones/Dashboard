import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLecture, getChunkTexts, updateLecture } from "@/lib/lectures";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// Generation runs in stages, each its own request, because Vercel caps a
// function at 60s and one combined call exceeded it (504).
//   notes → summary + outline
//   map   → mermaid concept map
//   exam  → objectives, high-yield, predicted questions, traps
//   quiz  → quiz + flashcards
type Stage = "notes1" | "notes2" | "map" | "exam" | "quiz" | "cards";

const MAX_TRANSCRIPT = 60000;

const CONTEXT = `The student is a master's (MHS) student at Meharry Medical College on a pre-med track, taking Biochemistry, Physiology, Microbiology, and Cell & Molecular Biology. Her assessments are graduate-level quizzes and exams. She needs materials that prepare her for those exams — not summaries of what was said.`;

const PROMPTS: Record<Stage, { system: string; maxTokens: number }> = {
  notes1: {
    maxTokens: 4500,
    system: `You write graduate-level study notes from a lecture transcript. ${CONTEXT}

You are given the FIRST HALF of a lecture. Cover it completely.

Return ONLY JSON (no markdown fences):
{
  "title": "specific topic title for the whole lecture, e.g. 'Cardiac Action Potentials & Excitation-Contraction Coupling'",
  "summary": "2-3 sentences: what this lecture covers and why it matters clinically",
  "outline": "notes for this half, in markdown"
}

The outline is her primary study document — it must be able to REPLACE re-watching the lecture. Requirements:
- Use ## for major topics, ### for subtopics
- Explain MECHANISMS step by step, not just names. If the lecture describes a pathway, cascade, or process, write out the actual sequence of steps with the molecules/structures involved.
- **Bold** every key term, enzyme, hormone, structure, or value the first time it appears
- Include every number, normal range, threshold, and value stated in the lecture
- Use markdown tables to compare things the lecture contrasts (types, classes, mechanisms, phases)
- Add a "> " blockquote line marked **Why this matters:** under complex sections, connecting the concept to physiology or disease
- Where the lecturer signals emphasis ("this is important", "you'll see this again", "remember"), mark that content with **[EMPHASIZED]** at the end of the line
- Be thorough. Long, complete notes are the goal — do not compress or summarize away detail.`,
  },

  notes2: {
    maxTokens: 4500,
    system: `You write graduate-level study notes from a lecture transcript. ${CONTEXT}

You are given the SECOND HALF of a lecture. Cover it completely. Do not repeat the first half.

Return ONLY JSON (no markdown fences):
{
  "outline": "notes for this half, in markdown — continue the same heading style"
}

The outline is her primary study document — it must be able to REPLACE re-watching the lecture. Requirements:
- Use ## for major topics, ### for subtopics
- Explain MECHANISMS step by step, not just names. If the lecture describes a pathway, cascade, or process, write out the actual sequence of steps with the molecules/structures involved.
- **Bold** every key term, enzyme, hormone, structure, or value the first time it appears
- Include every number, normal range, threshold, and value stated in the lecture
- Use markdown tables to compare things the lecture contrasts (types, classes, mechanisms, phases)
- Add a "> " blockquote line marked **Why this matters:** under complex sections, connecting the concept to physiology or disease
- Where the lecturer signals emphasis ("this is important", "you'll see this again", "remember"), mark that content with **[EMPHASIZED]** at the end of the line
- Be thorough. Long, complete notes are the goal — do not compress or summarize away detail.`,
  },

  map: {
    maxTokens: 3000,
    system: `You build a concept map from a lecture transcript. ${CONTEXT}

Return ONLY JSON (no markdown fences):
{ "conceptMap": "a mermaid flowchart" }

Requirements for the mermaid diagram:
- Start with: flowchart TD
- Group related concepts into subgraphs by theme, e.g. subgraph S1["Regulation"] ... end
- 18-28 nodes total — enough to show the real structure of the topic
- LABEL THE EDGES with the relationship: A -->|activates| B, A -->|inhibits| B, A -->|leads to| B, A -->|requires| B. Unlabeled arrows are much less useful — label most of them.
- Show causal/mechanistic chains, not just categories. The map should let her trace a process start to finish.
- End with class definitions to color-code node roles, exactly in this style:
  classDef core fill:#7C5CFC,stroke:#5b3fd4,color:#fff
  classDef process fill:#e8ecff,stroke:#7C5CFC,color:#1a1a2e
  classDef outcome fill:#2bb3a3,stroke:#1e8a7e,color:#fff
  classDef warn fill:#ffe3d0,stroke:#e8842c,color:#1a1a2e
  and assign them: class A,B core   class C,D process   etc.

SYNTAX RULES — a syntax error makes the map unusable:
- Node ids: short alphanumerics only (N1, ATP, Ca2)
- Label text inside ["..."] must NOT contain parentheses, commas, quotes, colons, or slashes. Use plain words and hyphens.
- Edge labels inside |...| must be 1-3 plain words, no punctuation.`,
  },

  exam: {
    maxTokens: 4500,
    system: `You predict what a graduate course will actually test from this lecture. ${CONTEXT}

Return ONLY JSON (no markdown fences):
{
  "objectives": ["what she is expected to be able to DO after this lecture — each starts with a verb like Explain, Compare, Predict, Trace, Calculate"],
  "highYield": [ { "topic": "concept name", "why": "why this is likely tested — lecturer emphasis, mechanistic centrality, classic exam material", "confidence": "high" } ],
  "predictedQuestions": [ { "question": "a full exam-style question as it might actually appear, including vignettes where appropriate", "type": "multiple choice | short answer | essay", "howToAnswer": "the key points a full-credit answer must contain" } ],
  "traps": ["specific confusions, look-alike terms, or reversed relationships students get wrong on exams for this material"]
}

Give 5-6 objectives, 6 high-yield topics (confidence: high/medium), 5 predicted questions, 4 traps.
Base predictions on: what the lecturer emphasized or repeated, what is mechanistically central, what has clinical correlation, and what is classically tested in this subject. Be specific to THIS lecture's content — no generic study advice.`,
  },

  quiz: {
    maxTokens: 4500,
    system: `You write exam-level practice questions from a lecture transcript. ${CONTEXT}

Return ONLY JSON (no markdown fences):
{ "quiz": [ { "q": "question text", "choices": ["A","B","C","D"], "answer": 0, "explanation": "why the right answer is right AND why the most tempting wrong answer is wrong", "difficulty": "exam-level" } ] }

Exactly 10 questions, written at the difficulty of a real graduate exam:
- Most should be APPLICATION: clinical vignettes, "what happens if X is blocked", predict-the-outcome, interpret-the-data, compare-two-conditions. Avoid "what is the definition of X".
- Every distractor must be plausible — something a student who half-knows the material would pick. No throwaway options.
- The explanation must teach: state why the answer is correct, then explicitly address why the most tempting distractor is wrong.
- Cover the full breadth of the lecture, not just the beginning.
`,
  },

  cards: {
    maxTokens: 3000,
    system: `You write flashcards from a lecture transcript. ${CONTEXT}

Return ONLY JSON (no markdown fences):
{ "flashcards": [ { "front": "prompt", "back": "answer" } ] }

Exactly 15, atomic and testable:
- Mechanisms ("What triggers X?"), relationships ("What happens to Y when Z rises?"), values, and distinctions
- Front asks one specific thing; back answers it completely but concisely
- No vague prompts like "Describe the lecture topic"
- Spread across the whole lecture`,
  },
};

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("model returned unparseable output");
    return JSON.parse(m[0]);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const stage = (req.nextUrl.searchParams.get("stage") ?? "notes1") as Stage;
  if (!PROMPTS[stage]) {
    return NextResponse.json({ error: `unknown stage '${stage}'` }, { status: 400 });
  }

  try {
    const lecture = await getLecture(params.id);
    if (!lecture) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Stage 1 assembles the transcript; later stages reuse the stored one
    let transcript = lecture.transcript ?? "";
    if (stage === "notes1" || !transcript) {
      const chunks = await getChunkTexts(params.id);
      transcript = chunks.join("\n\n").trim();
      if (!transcript) {
        return NextResponse.json({ error: "no transcript chunks found" }, { status: 400 });
      }
      await updateLecture(params.id, { status: "generating", transcript });
    }

    // Notes are written in halves so neither call approaches the 60s cap
    const capped = transcript.slice(0, MAX_TRANSCRIPT);
    const mid = Math.floor(capped.length / 2);
    const slice =
      stage === "notes1" ? capped.slice(0, mid) :
      stage === "notes2" ? capped.slice(mid) :
      capped;
    const part =
      stage === "notes1" ? " (first half)" :
      stage === "notes2" ? " (second half)" : "";

    const { system, maxTokens } = PROMPTS[stage];
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{
        role: "user",
        content: `Course: ${lecture.course}\n\nLecture transcript${part}:\n\n${slice}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseJson(raw);

    if (stage === "notes1") {
      await updateLecture(params.id, {
        title: parsed.title || lecture.title,
        summary: parsed.summary ?? "",
        outline: parsed.outline ?? "",
      });
    } else if (stage === "notes2") {
      const first = (await getLecture(params.id))?.outline ?? "";
      await updateLecture(params.id, { outline: `${first}\n\n${parsed.outline ?? ""}`.trim() });
    } else if (stage === "map") {
      await updateLecture(params.id, { conceptMap: parsed.conceptMap ?? "" });
    } else if (stage === "exam") {
      await updateLecture(params.id, { examFocus: JSON.stringify(parsed) });
    } else if (stage === "quiz") {
      await updateLecture(params.id, { quiz: JSON.stringify(parsed.quiz ?? []) });
    } else {
      await updateLecture(params.id, {
        flashcards: JSON.stringify(parsed.flashcards ?? []),
        status: "ready",
      });
    }

    return NextResponse.json({ ok: true, stage });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300), stage }, { status: 500 });
  }
}
