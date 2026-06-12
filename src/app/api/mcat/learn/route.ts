import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MCATQuestion } from "@/types/dashboard";
import { randomUUID } from "crypto";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an elite MCAT tutor with board-level accuracy in all MCAT content areas. You genuinely teach — not just summarize.

═══ TEACHING mode ═══
Structure every lesson exactly like this:

## [Concept Name]
**Why this matters on the MCAT:** (one sentence connecting the concept to real test questions)

### Core Mechanism
(3–5 bullet points explaining the mechanism, process, or principle accurately)

### Key Facts to Know
(bullet list of highest-yield, most tested facts)

### Clinical / MCAT Application
(a realistic MCAT-style scenario or passage hook showing how this is tested)

### Memory Hook
(a vivid mnemonic, analogy, or mental model — make it stick)

### MCAT Traps ⚠️
(1–2 common wrong-answer pitfalls on this exact topic)

**Quick Check:** [one conceptual question] → [answer]

═══ CHAT mode ═══
Answer follow-up questions clearly and accurately. Be concise but thorough. Reference what was just taught. Keep the student focused on MCAT-relevant aspects.

═══ AID mode ═══
Respond based on the aidType:

"mnemonic" → Create a specific, creative mnemonic. Use **bold** on the key letters/words that map to the mnemonic. Explain each part clearly.

"table" → Create a well-formatted markdown comparison table. Use | col | col | col | syntax with a header row and --- separator. Include 3–5 columns of meaningful comparisons.

"diagram" → Create a clear text-based flowchart or pathway using → arrows, labeled steps, and indentation. Show sequence, relationships, or feedback loops.

"flashcards" → Create exactly 5 high-quality flashcards covering the most testable aspects. After your brief intro sentence, put this on its own line:
CARDS::[{"front":"Question here?","back":"Answer here."},{"front":"...","back":"..."},{"front":"...","back":"..."},{"front":"...","back":"..."},{"front":"...","back":"..."}]

"question" → Create one rigorous MCAT-style multiple choice question. After a one-sentence intro, put this on its own line:
QUESTION::{"stem":"Full question stem here","choices":[{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],"correctLetter":"B","explanation":"B is correct because... A is wrong because... C is wrong because... D is wrong because...","subject":"Biology","topic":"Specific Topic","difficulty":"medium"}

═══ ACCURACY RULES ═══
All facts must be scientifically accurate. Use **bold** for key terms throughout. MCAT has zero tolerance for incorrect information — when uncertain, say so.`;

interface LearnRequest {
  concept: string;
  subject?: string;
  mode: "teach" | "chat" | "aid";
  message?: string;
  aidType?: string;
  characterId?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const PERSONALITIES: Record<string, string> = {
  professor: "You are Prof. Nova, a warm and knowledgeable professor. Explain with clear structure, correct scientific terminology, and genuine encouragement.",
  monster:   "You are Moxy, an enthusiastic monster who LOVES science! Use exciting analogies, celebrate breakthroughs with energy. Stay accurate but make it FUN.",
  robot:     "You are ARIA (Advanced Reasoning Intelligence Assistant). Be precise, logical, systematic. Use numbered steps, eliminate fluff, maximize clarity.",
  owl:       "You are Sage, a wise owl who teaches through questions and metaphors. Use Socratic dialogue, draw analogies from nature, foster deep understanding.",
};

export async function POST(req: Request) {
  try {
    const body: LearnRequest = await req.json();
    const { concept, subject, mode, message, aidType, characterId, history = [] } = body;

    if (!concept?.trim()) {
      return NextResponse.json({ error: "Concept is required" }, { status: 400 });
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // Replay history
    for (const h of history) {
      messages.push({ role: h.role, content: h.content });
    }

    // Build current user message
    if (mode === "teach") {
      const subjectCtx = subject ? ` (MCAT subject: ${subject})` : "";
      messages.push({
        role: "user",
        content: `TEACHING mode. Teach me about: "${concept}"${subjectCtx}`,
      });
    } else if (mode === "chat" && message) {
      messages.push({ role: "user", content: message });
    } else if (mode === "aid" && aidType) {
      const prompts: Record<string, string> = {
        mnemonic: `AID mode, aidType: mnemonic. Create a memorable mnemonic for "${concept}".`,
        table:    `AID mode, aidType: table. Create a comparison/summary table for "${concept}".`,
        diagram:  `AID mode, aidType: diagram. Create a step-by-step diagram or flowchart for "${concept}".`,
        flashcards: `AID mode, aidType: flashcards. Generate 5 high-quality flashcards for "${concept}". Return CARDS:: JSON on its own line.`,
        question: `AID mode, aidType: question. Generate one rigorous MCAT MCQ about "${concept}". Return QUESTION:: JSON on its own line.`,
      };
      messages.push({
        role: "user",
        content: prompts[aidType] ?? `AID mode. Help me study "${concept}".`,
      });
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const personalityLine = PERSONALITIES[characterId ?? "professor"] ?? PERSONALITIES.professor;
    const systemWithPersonality = personalityLine + "\n\n" + SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemWithPersonality,
      messages,
    });

    const rawText = (response.content[0] as { type: string; text: string }).text;

    let cleanText = rawText;
    let cards: { front: string; back: string }[] | undefined;
    let question: MCATQuestion | undefined;

    // Extract CARDS:: line
    const cardsMatch = rawText.match(/^CARDS::\[[\s\S]*?\]$/m);
    if (cardsMatch) {
      try {
        cards = JSON.parse(cardsMatch[0].slice("CARDS::".length));
        cleanText = rawText.replace(cardsMatch[0], "").trim();
      } catch { /* keep raw text */ }
    }

    // Extract QUESTION:: line
    const questionMatch = rawText.match(/^QUESTION::\{[\s\S]*?\}$/m);
    if (questionMatch) {
      try {
        const raw = JSON.parse(questionMatch[0].slice("QUESTION::".length));
        question = {
          id: randomUUID(),
          subject: raw.subject || subject || "General",
          topic: raw.topic || concept,
          difficulty: (["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "medium") as "easy" | "medium" | "hard",
          stem: raw.stem,
          choices: raw.choices,
          correctLetter: raw.correctLetter,
          explanation: raw.explanation || "",
          createdAt: new Date().toISOString(),
        };
        cleanText = rawText.replace(questionMatch[0], "").trim();
      } catch { /* keep raw text */ }
    }

    return NextResponse.json({ text: cleanText, cards, question });
  } catch (e) {
    console.error("Learn API error:", e);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
