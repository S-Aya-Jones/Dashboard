import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLadder, getRoutes, getSessions, getCheckins } from "@/lib/exposure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// Reads what she has ACTUALLY done — every logged session, her real routes,
// her fear ratings over time — and proposes the next steps from that. Nothing
// generic: if she's already driving daily, it says so and moves on.

const SYSTEM = `You are planning graded exposure steps for a specific person, working from her real logged data. She is a graduate student with a driving phobia, a height phobia, and panic disorder. She is in therapy with two therapists.

She is explicit that she does NOT want generic beginner advice like "sit in the parked car" — she already drives. Read her data and pitch steps at her actual current level, one notch harder than what she has already proven she can do.

Return ONLY JSON (no markdown fences):
{
  "readAloud": "2-3 sentences telling her what her own data shows — cite specific numbers, routes and trends. Warm, direct, no flattery.",
  "steps": [
    {
      "title": "a concrete, specific action she could do this week",
      "why": "what in her data makes this the right next step",
      "when": "which slot in her week this fits — Mon extended drive home, Thu 4:30 short drive, Sat 12:30 big session, or a work break for heights",
      "phobia": "driving | heights",
      "difficulty": 55,
      "route": "the name of one of her saved routes if relevant, else empty string"
    }
  ],
  "watchFor": "one honest caution based on her data — avoidance creeping in, a step repeated so often it stopped challenging her, or exposure scheduled too close to an assessment"
}

Rules:
- Exactly 3 steps, ordered easiest to hardest
- Reference her real route names, real fear numbers, and real repetition counts wherever possible
- difficulty is 0-100 on her own fear scale, estimated from her history
- If her data shows she has plateaued on something, say so and escalate
- If she has logged very little, say that plainly and pick steps that produce data
- Never suggest exposure the night before a quiz or exam`;

export async function POST() {
  try {
    const [ladder, routes, sessions, checkins] = await Promise.all([
      getLadder(), getRoutes(), getSessions(60), getCheckins(4),
    ]);

    if (!sessions.length && !routes.length) {
      return NextResponse.json({
        plan: {
          readAloud: "There's nothing logged yet, so there's nothing to reason from. Save one route you already drive and log the next drive you take — after that this gets specific.",
          steps: [],
          watchFor: "",
        },
      });
    }

    const context = {
      savedRoutes: routes.map(r => ({
        name: r.name, from: r.origin, to: r.destination,
        minutes: r.minutes, noBridge: r.noBridge, noHighway: r.noHighway,
        timesDriven: r.timesDriven, lastDriven: r.lastDriven, notes: r.notes,
      })),
      sessionHistory: sessions.map(s => ({
        date: s.doneAt.slice(0, 10), phobia: s.phobia, what: s.label,
        fearBefore: s.sudBefore, fearPeak: s.sudPeak, fearAfter: s.sudAfter,
        minutes: s.minutes, panicked: s.panic, notes: s.notes,
      })),
      ladderProgress: ladder.map(l => ({
        phobia: l.phobia, step: l.title, fearRating: l.sud,
        timesDone: l.reps, mastered: l.mastered,
      })),
      recentCheckins: checkins,
      herWeek: "Works 7:00-2:30 with classes 8-12. Monday drive home is an extended route. Thursday 4:30 short exposure drive. Saturday 12:30 is the big session right after therapy. Heights doses happen on 10:00 and 1:30 work breaks. Never the night before an assessment.",
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let plan;
    try { plan = JSON.parse(cleaned); }
    catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("could not parse plan");
      plan = JSON.parse(m[0]);
    }

    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
