// Everything she can change by text.
//
// Her words: "I want to be able to make updates via text message for several
// different places." The dashboard is where things are looked at; the phone is
// where they get changed, because the phone is what is in her hand when the
// thing actually happens.
//
// Two rules keep this from becoming a command line she has to remember.
//
// A command is recognised by its first word only, and everything after it is
// taken literally. "journal today was heavy" needs no quoting, no punctuation
// and no structure — the whole point is that it can be dictated while walking
// to the car.
//
// Anything not recognised is not an error. It falls through to the assistant,
// which answers it as a question. A wrong guess here would swallow a sentence
// she meant someone to read.

export type Command =
  | { kind: "journal"; body: string }
  | { kind: "prayer"; body: string }
  | { kind: "setHome"; address: string }
  | { kind: "setWork"; address: string }
  | { kind: "addPlace"; label: string; address: string }
  | { kind: "addBridge"; label: string; doneBefore: boolean }
  | { kind: "droveBridge"; label: string }
  | { kind: "drove"; label: string }
  | { kind: "options" }
  | { kind: "reset" }
  | { kind: "status" }
  | { kind: "move"; what: "drive" | "study"; from: Day | null; to: Day }
  | null;

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const DAY_WORDS: Record<string, Day> = {
  mon: "mon", monday: "mon",
  tue: "tue", tues: "tue", tuesday: "tue",
  wed: "wed", weds: "wed", wednesday: "wed",
  thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
  fri: "fri", friday: "fri",
  sat: "sat", saturday: "sat",
  sun: "sun", sunday: "sun",
};

export function dayWord(w: string): Day | null {
  return DAY_WORDS[w.trim().toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

/** Leading word, lowercased, and the rest untouched. */
function split(body: string): { head: string; rest: string } {
  const t = String(body ?? "").trim();
  const i = t.search(/\s/);
  if (i < 0) return { head: t.toLowerCase(), rest: "" };
  return { head: t.slice(0, i).toLowerCase(), rest: t.slice(i + 1).trim() };
}

export function parseCommand(body: string): Command {
  const { head, rest } = split(body);

  switch (head) {
    case "journal":
    case "j":
      return rest ? { kind: "journal", body: rest } : null;

    case "pray":
    case "prayer":
      return rest ? { kind: "prayer", body: rest } : null;

    case "drive":
    case "drives":
    case "options":
      // "drive 60 80 30" is an anxiety log and is matched earlier; this is the
      // bare word, asking where to go.
      return rest ? null : { kind: "options" };

    case "reset":
    case "sunday":
      return rest ? null : { kind: "reset" };

    case "status":
      // Only when it is the whole message. "where" was an alias here and it
      // ate "where should I practice driving today" — a question answered as a
      // status report, which is the precise failure this file is meant to
      // avoid. A command word followed by more words is a sentence.
      return rest ? null : { kind: "status" };

    case "set": {
      const { head: what, rest: value } = split(rest);
      if (!value) return null;
      if (what === "home") return { kind: "setHome", address: value };
      if (what === "work") return { kind: "setWork", address: value };
      return null;
    }

    case "add": {
      const { head: what, rest: value } = split(rest);
      if (!value) return null;

      if (what === "place") {
        // "add place the mall, 1000 Example Rd" — comma separates name from
        // address. Without one, the first two words are the name, which is
        // wrong often enough that the comma is worth asking for.
        const comma = value.indexOf(",");
        if (comma < 0) return null;
        const label = value.slice(0, comma).trim();
        const address = value.slice(comma + 1).trim();
        return label && address ? { kind: "addPlace", label, address } : null;
      }

      if (what === "bridge") {
        // A trailing "done before" marks one she has crossed and lost, which
        // changes what the app says about it rather than where it sits.
        const m = value.match(/^(.*?)(?:[,\s]+done\s+before)\s*$/i);
        return m
          ? { kind: "addBridge", label: m[1].trim(), doneBefore: true }
          : { kind: "addBridge", label: value, doneBefore: false };
      }
      return null;
    }

    case "move":
    case "push": {
      // "move drive to saturday", "push thursday drive to sat". The thing being
      // moved and the day it lands on; the day it came from is optional because
      // nine times out of ten it is today.
      const words = rest.split(/\s+/).filter(Boolean);
      const what = words.find(w => /^(drive|study)$/i.test(w))?.toLowerCase() as "drive" | "study" | undefined;
      if (!what) return null;

      const toIdx = words.findIndex(w => /^to$/i.test(w));
      const to = toIdx >= 0 ? dayWord(words.slice(toIdx + 1).join("")) : null;
      if (!to) return null;

      // A day named before "to" is the one it is moving off.
      const before = toIdx > 0 ? words.slice(0, toIdx).map(dayWord).find(Boolean) ?? null : null;
      return { kind: "move", what, from: before, to };
    }

    case "crossed":
      return rest ? { kind: "droveBridge", label: rest } : null;

    case "drove":
      return rest ? { kind: "drove", label: rest } : null;

    default:
      return null;
  }
}

// "I don't think I can do this today."
//
// Her words, and the thing she actually wants to be able to say — not "move
// drive to saturday". The command form stays because it is exact; this is for
// the sentence she will really send, at 7:50 in the morning, in the car park.
//
// Deliberately narrow. It only fires when something is actually planned for
// today, so the worst case is a sentence reaching the assistant instead, which
// is where it would have gone anyway. The reverse mistake — quietly wiping a
// drive off the plan because she texted "can't believe I did that today" — is
// the one worth engineering against, which is what PAST rules out.
const DECLINE = /\b(can'?t|can ?not|won'?t be able|not going to make|not gonna make|don'?t think i can|too much today|need to skip|have to skip|gotta skip|skipping)\b/i;
const TODAY = /\b(today|tonight|this (one|morning|afternoon|evening)|it)\b/i;
const PAST = /\b(did|done|drove|crossed|finished|went|made it|managed)\b/i;

/**
 * Read a message as backing out of today's plan.
 *
 * `what` is null when she didn't name it — the caller resolves that from what
 * is actually on today, because on most days only one thing is.
 */
export function parseDecline(body: string): { what: "drive" | "study" | null } | null {
  const t = String(body ?? "").trim();
  if (!t || t.endsWith("?")) return null;
  if (!DECLINE.test(t) || !TODAY.test(t)) return null;
  if (PAST.test(t)) return null;

  const what = /\bdriv/i.test(t) ? "drive" : /\bstud/i.test(t) ? "study" : null;
  return { what };
}

/** What the Sunday reset asks, in one message she can answer in one reply. */
export const RESET_QUESTIONS = [
  "1. What did you avoid this week, and what did you face?",
  "2. One thing you did for someone else.",
  "3. One thing you're proud of that nobody saw.",
  "4. Savings balance, drives done, workouts, applications sent.",
];

export const RESET_PROMPT =
  "Sunday reset. Answer in one message, however it comes out — it goes straight into your journal.\n" +
  RESET_QUESTIONS.join("\n");

export const HELP_TEXT =
  "Things you can text me:\n" +
  "drive — three places to drive today\n" +
  "journal <anything> — saves a journal entry\n" +
  "pray <anything> — same, kept separate\n" +
  "a number — your steps\n" +
  "study 45 5/6 — minutes and quiz\n" +
  "drive 60 80 30 — anxiety before, peak, after\n" +
  "crossed <bridge> — logs a crossing\n" +
  "add place <name>, <address>\n" +
  "add bridge <name>, done before\n" +
  "set home <address>\n" +
  "status — where everything stands\n" +
  "move drive to saturday — shifts it\n" +
  "Or just ask me something.";
