import Anthropic from "@anthropic-ai/sdk";
import { firstText } from "@/lib/aiError";
import { wholePlan, logsBetween, weekBounds, dayOf, STUDY_DAYS, DRIVE_DAYS } from "@/lib/habitTexts";
import { progress as studyProgress } from "@/lib/studyTopics";
import { places, progressRows, buildTracks, routeLink } from "@/lib/driving";
import { dayLine, whyToday, chicagoDay } from "@/lib/planBrief";

// Texting back.
//
// Every scheduled text is one-way, and a reply that isn't a number or a keyword
// used to fall off the end of the inbound handler into silence. This is what
// answers instead: her own data, handed to a model with the question she asked.
//
// Two rules shape the whole thing.
//
// It must know. "Where should I practice driving today?" is only worth asking
// if the answer is the actual next rung on her actual ladder, with her actual
// route link — not a paragraph about how driving takes practice. So the context
// is assembled from the database every time rather than summarised into the
// prompt once.
//
// It must be short. This arrives as an SMS. Two segments is 320 characters, and
// anything past that is both a worse answer and a more expensive one.

export const MAX_REPLY_CHARS = 300;

/**
 * Everything the model is allowed to know, gathered fresh.
 *
 * Deliberately not the whole dashboard. Her journal, her money and her medical
 * details are not in here — a question about where to drive does not need them,
 * and the smallest context that answers the question is also the one least
 * likely to say something she did not ask to hear.
 */
export async function replyContext() {
  const today = chicagoDay();
  const { start, end } = weekBounds(today);

  const [plan, logs, study, placeList, rungState] = await Promise.all([
    wholePlan().catch(() => []),
    logsBetween(start, end).catch(() => []),
    studyProgress().catch(() => null),
    places().catch(() => []),
    progressRows().catch(() => []),
  ]);

  const tracks = buildTracks(rungState, placeList);
  const day = dayOf(today);
  const home = placeList.find(p => p.key === "home")?.address ?? null;
  const work = placeList.find(p => p.key === "work")?.address ?? null;

  const steps = logs.filter(l => l.kind === "steps" && l.steps != null);
  const drives = logs.filter(l => l.kind === "drive");

  return {
    today,
    weekday: day,
    isStudyDay: STUDY_DAYS.includes(day),
    isDriveDay: DRIVE_DAYS.includes(day),
    scheduleToday: dayLine(today),
    temporaryWeek: whyToday(today),

    // Spelled out rather than given as "0 of 18". That string was read as
    // eighteen study sessions due today, and she was told she had them —
    // a number lifted out of one meaning and handed back in another. A field
    // name that says what the number counts cannot be misread that way.
    foundations: study
      ? {
          nextTopicToStudy: study.next?.title ?? null,
          topicsFinishedSoFar: study.doneCount,
          topicsInTheWholeList: study.total,
        }
      : null,

    // The current rung on each ladder, with the route link already built so the
    // model never has to construct a URL — and never gets the chance to invent
    // one that goes somewhere she didn't ask for.
    exposure: tracks.map(t => ({
      track: t.track,
      next: t.current
        ? { title: t.current.title, why: t.current.why, doneSoFar: t.current.done, needs: t.current.target, link: t.current.link }
        : null,
      progress: `${t.doneCount}/${t.rungs.length}`,
    })),
    routeHomeToWork: home && work ? routeLink(home, work) : null,

    plannedToday: {
      study: plan.find(p => p.day === day && p.kind === "study") ?? null,
      drive: plan.find(p => p.day === day && p.kind === "drive") ?? null,
    },

    thisWeek: {
      stepsLogged: steps.length,
      stepsAverage: steps.length ? Math.round(steps.reduce((n, s) => n + (s.steps ?? 0), 0) / steps.length) : null,
      drivesDone: drives.length,
      lastDriveAnxiety: drives.length
        ? { before: drives[drives.length - 1].anxBefore, peak: drives[drives.length - 1].anxPeak, after: drives[drives.length - 1].anxAfter }
        : null,
      skips: logs.filter(l => l.kind === "skip").map(l => l.reason),
    },
  };
}

const SYSTEM = `You are the assistant inside Aya's personal dashboard, answering a text message.

Hard limits:
- Reply in under ${MAX_REPLY_CHARS} characters. This is an SMS. One or two sentences.
- Plain text. No markdown, no bullets, no emoji, no greeting, no sign-off.
- Never invent a street, route, bridge or place name. If a link is in the context, paste it exactly; if there isn't one, say what kind of route to pick and let her choose it.

What she is doing: she is on a break from school, working, and rebuilding two things — a driving phobia and a fear of heights. She does not take interstates. Bridges and heights are the hard parts. Her exposure ladders advance by repetition, not by distance: a rung is done when it has been repeated enough times, and an unfamiliar road becomes familiar by being driven again rather than by being replaced with a different one.

Every number in the context means exactly what its field name says and nothing else. Never restate one as a different quantity: topicsInTheWholeList is how many topics exist in her foundations list in total, not how many are scheduled today. She has at most one study block in a day, and at most one drive. If you cannot say where a number came from, leave it out.

Answer from the context you are given. If she asks where to practise driving, name the current rung on the driving or bridges track and include its link if there is one. If the context does not contain the answer, say so in one sentence rather than guessing.

What this app can actually do by text. Never tell her you can't do one of these — she asked to journal by text and was told it was outside what you do, and it was not:
- Save a journal entry or a prayer. She can say she wants to journal and send it in the next message, or text "journal <anything>".
- Log steps (a number on its own), a study session ("study 45 5/6"), a drive ("drive 60 80 30" for anxiety before, peak and after), a skipped day, or a bridge crossing ("crossed <bridge>").
- Move today's drive or study to another day. If she says she can't do today's, that already happens automatically.
- Save an address ("set home <address>", "add place <name>, <address>") or a bridge ("add bridge <name>").
- Give three named places to drive today ("drive"), the state of everything ("status"), or the Sunday reset ("reset").

If she asks for one of those, confirm it and give the exact words to text, in as few as possible. Never tell her to ask someone else about what this app does, and never refer her to her therapist for a technical question — you are the one who knows.

Be direct and warm. She has heard enough encouragement; what helps is the specific next thing.`;

/**
 * Answer one inbound text, or null when there is nothing useful to say.
 *
 * Returning null is a real outcome: with no API key configured, or on any
 * failure, the right behaviour is silence rather than an apology she did not
 * ask for and will be charged to receive.
 */
export async function aiReply(question: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const context = await replyContext();
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Her message: ${question}\n\nContext:\n${JSON.stringify(context, null, 1)}`,
      }],
    });

    const text = firstText(msg)?.trim();
    if (!text) return null;
    // Trimmed rather than truncated mid-word: a sentence that stops halfway
    // reads as a bug, and she is paying per segment either way.
    if (text.length <= MAX_REPLY_CHARS) return text;
    const cut = text.slice(0, MAX_REPLY_CHARS);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    return lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.trimEnd();
  } catch {
    return null;
  }
}
