import Anthropic from "@anthropic-ai/sdk";
import { firstText } from "@/lib/aiError";
import { chicagoDay } from "@/lib/planBrief";
import { logEntry } from "@/lib/habitTexts";
import { logTrip, setFloor, state as heightState } from "@/lib/heights";
import { learn, type Track } from "@/lib/learned";

// Telling it what you did, in your own words.
//
// Everything that could be logged before had to arrive in a shape: a bare
// number for steps, "study 45 5/6", "drive 60 80 30". Those are fine when she
// already knows what she is reporting. They are no use at all for the message
// she actually sends, which is this one:
//
//   "Today at 1:16 I'm at 12,416 steps. And I did two baby exposures at work.
//    One was taking the elevator up to my dad this morning. Second, there's a
//    way to get to building four where the other walking pad is — you can ride
//    the elevator to the third floor and walk across the parking structure, or
//    take the shuttle, or walk the streets. I took the stairs up to the third
//    one by myself, which is pretty big. Then I walked over. On the way back I
//    did the same and took the elevator down."
//
// Four separate facts, no keywords, and the most important one — she chose the
// stairs over the lift, alone, and did it twice — is buried in the middle of a
// sentence about lunch. The old system would have answered that warmly and
// written down nothing.
//
// So this reads it. One pass, a small model, strict rules about what counts.
//
// The hard rule is that it only records what she says she DID. Past tense,
// already happened. "I'm scared of the bridge tomorrow" is a sentence to
// answer, not an event to file, and a reader that cannot tell the difference
// fills her history with things that never occurred — which is worse than
// recording nothing, because then none of it can be trusted.

export interface Event {
  kind: "steps" | "height" | "exposure" | "drive" | "study" | "skip";
  steps?: number;
  /** Which floor or level she got to, when she says. */
  floor?: number;
  /** How many separate times she did it today. There and back is two. */
  times?: number;
  /** A short name for something repeatable, in her own words. */
  label?: string;
  detail?: string;
  track?: Track;
  before?: number;
  peak?: number;
  after?: number;
  minutes?: number;
  quiz?: string | null;
  reason?: string;
}

const SYSTEM = `Read a message from Aya about what she has done today and return the facts in it as JSON.

Return {"events": [...]} and nothing else. An empty list is a correct and common answer.

Event shapes:
{"kind":"steps","steps":12416}
{"kind":"height","floor":3,"times":2,"detail":"took the stairs to the third floor instead of the lift"}
{"kind":"exposure","label":"Building 4 crossing","detail":"stairs to level 3, across the parking structure to building 4, same on the way back","track":"heights","times":2}
{"kind":"drive","before":60,"peak":80,"after":30}
{"kind":"study","minutes":45,"quiz":"5/6"}
{"kind":"skip","reason":"too tired"}

Rules, in order of importance:

1. Only record what she says she DID, already, today. Past tense. Plans, intentions, fears and questions are not events. "I'm going to try the bridge tomorrow" and "the stairs scare me" both produce an empty list.

2. Never invent a number. If she does not say how many floors, leave floor out. If she does not say a step count, do not estimate one from context.

3. "times" is how many separate repetitions she describes. There and back is 2. If she does not make it clear, use 1.

4. Use "exposure" for something with a place attached that she could do again — a named route, a specific building, a particular crossing. Give it a short label in her own words, the kind of thing she would recognise in a text message three weeks from now. Use "height" for a plain trip upstairs with no repeatable place attached.

5. One real thing can produce two events, and should: going up to the third floor by the stairs is a height event, and the whole route to building four is an exposure. Do not merge them and do not pad.

6. track is "heights", "bridges" or "driving". Stairs, lifts, upper floors, open edges and walkways above ground are "heights".

7. Quote her, trimmed, in detail. Do not editorialise and do not praise.`;

const KINDS = ["steps", "height", "exposure", "drive", "study", "skip"];

/**
 * Whether a message is worth spending a model call on.
 *
 * This started as a six-word minimum and that was wrong in the one case it
 * most needed to be right. She replied to the evening text with
 *
 *   "13202 so far no quiz"
 *
 * — five words, a real step count, and a clear statement that there was no
 * quiz. It fell straight past the logger into the assistant, which complimented
 * her on it and wrote down nothing.
 *
 * A digit is the giveaway. Almost everything she wants recorded has a number in
 * it, and almost nothing she says in passing does — so a short message with a
 * number in it is read, and a short one without is not. Longer messages are
 * read either way, because that is where a day gets described in prose.
 */
export function worthReading(body: string): boolean {
  const t = String(body ?? "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words >= 6) return true;
  return words >= 2 && /\d/.test(t);
}

/**
 * Pull the events out of a model reply.
 *
 * Separate from the call so it can be tested without a key, a network or a
 * bill. Anything malformed is dropped rather than throwing: a model that
 * wraps its JSON in a sentence, or invents a seventh kind, should cost that
 * one event and not her whole message.
 */
export function parseEvents(raw: string): Event[] {
  try {
    const text = String(raw ?? "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1)) as { events?: unknown };
    if (!Array.isArray(parsed.events)) return [];

    return parsed.events.filter((e): e is Event => {
      const x = e as Event;
      return !!x && typeof x === "object" && KINDS.includes(x.kind);
    });
  } catch {
    return [];
  }
}

/** Read a message. Returns an empty list when nothing in it was actually done. */
export async function readEvents(body: string): Promise<Event[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  if (!worthReading(body)) return [];

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: body }],
    });
    return parseEvents(firstText(msg)?.trim() ?? "");
  } catch {
    return [];
  }
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * File what she reported, and say back exactly what was filed.
 *
 * Reading it back matters more than it looks. She cannot see the database, so
 * the only evidence that the app understood her is the reply — and a reply that
 * says "got it!" teaches her nothing about whether the stairs got counted.
 */
export async function applyEvents(events: Event[]): Promise<string | null> {
  if (!events.length) return null;
  const today = chicagoDay();
  const said: string[] = [];

  for (const e of events) {
    try {
      switch (e.kind) {
        case "steps": {
          const n = num(e.steps);
          if (n == null) break;
          await logEntry(today, { kind: "steps", steps: n });
          said.push(`${n.toLocaleString("en-US")} steps`);
          break;
        }

        case "height": {
          const times = Math.min(Math.max(num(e.times) ?? 1, 1), 6);
          const floor = num(e.floor);
          // She names the floor she actually reached, so the ladder follows her
          // rather than the other way round. Going higher than the app thought
          // moves it up; it never moves it down, because one easier day is not
          // a loss of what she has already done.
          if (floor != null) {
            const current = await heightState().catch(() => null);
            if (current && floor > current.floor) await setFloor(floor);
          }
          let last = null;
          for (let i = 0; i < times; i++) last = await logTrip();
          said.push(
            floor != null
              ? `floor ${floor}${times > 1 ? ` ×${times}` : ""}`
              : `${times} trip${times > 1 ? "s" : ""} up`,
          );
          if (last?.advanced) said.push(`you're on floor ${last.floor} now`);
          break;
        }

        case "exposure": {
          if (!e.label?.trim()) break;
          const times = Math.min(Math.max(num(e.times) ?? 1, 1), 6);
          const l = await learn(e.label.trim(), e.detail?.trim() ?? "", e.track ?? "heights", times);
          said.push(
            l.reps === times
              ? `kept "${l.label}" as one you can repeat (${l.reps}/${l.target})`
              : `"${l.label}" ${l.reps}/${l.target}`,
          );
          break;
        }

        case "drive": {
          const b = num(e.before), p = num(e.peak), a = num(e.after);
          if (b == null || p == null || a == null) break;
          await logEntry(today, { kind: "drive", before: b, peak: p, after: a });
          said.push(`drive ${b}/${p}/${a}`);
          break;
        }

        case "study": {
          const m = num(e.minutes);
          if (m == null) break;
          await logEntry(today, { kind: "study", minutes: m, quiz: e.quiz ?? null });
          said.push(`study ${m} min${e.quiz ? `, ${e.quiz}` : ""}`);
          break;
        }

        case "skip": {
          if (!e.reason?.trim()) break;
          await logEntry(today, { kind: "skip", reason: e.reason.trim() });
          said.push(`skipped: ${e.reason.trim()}`);
          break;
        }
      }
    } catch {
      // One bad event must not cost her the rest of the message.
    }
  }

  if (!said.length) return null;
  return `Logged: ${said.join(", ")}.`;
}

/** The whole path: read it, file it, say what was filed. Null if nothing was. */
export async function readAndLog(body: string): Promise<string | null> {
  return applyEvents(await readEvents(body));
}
