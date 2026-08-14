import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError, firstText } from "@/lib/aiError";
import { NewOverride, validate } from "@/lib/scheduleOverrides";
import { WEEK, DAY_SHORT } from "@/lib/weekPlan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic();

// Turning "see Tiffany Baker for an hour right after work Thursday" into dated
// changes. Nothing is written here — this only proposes, and the caller shows
// her the result before anything is saved. A schedule that rearranges itself on
// a misheard word is worse than one she edits by hand.

const DOW_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 0: "Sunday",
};

function weekContext(): string {
  return [1, 2, 3, 4, 5, 6, 0]
    .map(d => {
      const blocks = (WEEK[d]?.blocks ?? [])
        .map(b => `${b.start}-${b.end} ${b.label}`)
        .join("; ");
      return `${DAY_SHORT[d]}: ${blocks}`;
    })
    .join("\n");
}

function system(today: string, todayDow: number): string {
  return `You turn a student's spoken or typed note into concrete changes to one week of her calendar.

Today is ${today}, a ${DOW_NAMES[todayDow]}.

Her recurring week already looks like this:
${weekContext()}

Return ONLY JSON, no fences:
{ "changes": [ { "kind": "add" | "cancel", "date": "YYYY-MM-DD", "label": "short name", "startTime": "HH:MM", "endTime": "HH:MM", "note": "optional one line" } ],
  "clarify": "a question, only if you genuinely cannot place it" }

Rules:
- Resolve every date to an actual YYYY-MM-DD inside the next 14 days. "this week" means the week containing today. "after work" is 14:30 on a weekday. "before work" is before 07:00.
- Times are 24-hour. If she gives a duration and a start, compute the end. If she gives no duration, use one hour.
- A move is a "cancel" of the existing block plus an "add" of the new one. For a cancel, label must match words from the existing block above.
- If she is vague about the day but clear about everything else ("one day this week after work"), pick the day with the least in it already and say which you chose in the note.
- Only ask via "clarify" when placing it would be a guess that matters — a wrong date is worse than a question. Otherwise return changes and leave clarify out.
- Keep labels short and plain: "Tiffany Baker — tuition balance", not a sentence.`;
}

function parseJson(raw: string): { changes?: NewOverride[]; clarify?: string } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Say what you want to change." }, { status: 400 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: system(today, now.getDay()),
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    });

    const parsed = parseJson(firstText(msg));

    // Never hand the caller something that would fail on write.
    const changes = (parsed.changes ?? []).filter(c => !validate(c));
    const rejected = (parsed.changes ?? []).length - changes.length;

    if (!changes.length) {
      return NextResponse.json({
        changes: [],
        clarify: parsed.clarify ?? "I couldn't tell what to change — try naming a day and a time.",
      });
    }

    return NextResponse.json({ changes, clarify: parsed.clarify ?? null, rejected });
  } catch (e) {
    const f = describeAiError(e);
    return NextResponse.json(
      {
        error: f.message,
        blocking: f.blocking,
        // The manual form does not need the model, so say so rather than
        // leaving her stuck behind a billing problem.
        fallback: "You can still add it by hand below.",
      },
      { status: f.blocking ? 402 : 502 },
    );
  }
}
