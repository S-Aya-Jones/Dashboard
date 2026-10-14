import { loadData, saveData } from "@/lib/db";
import type { JournalEntry } from "@/types/dashboard";
import { chicagoDay } from "@/lib/planBrief";
import {
  places, setPlace, bridges, addBridge, logBridge, progressRows, buildTracks,
} from "@/lib/driving";
import { driveOptions, optionsText } from "@/lib/driveOptions";
import { progress as studyProgress } from "@/lib/studyTopics";
import { logsBetween, weekBounds, dayOf } from "@/lib/habitTexts";
import { parseCommand, parseDecline, RESET_PROMPT, type Command } from "@/lib/textCommands";
import {
  planFor, setPlanItem, clearPlanItem, DRIVE_DAYS, STUDY_DAYS, type Day,
} from "@/lib/habitTexts";
import {
  openResetWindow, resetWindowOpen, closeResetWindow,
  parseReview, saveReview, reviewAck, weekEndFor,
} from "@/lib/weeklyReset";

// Carrying out what she texted.
//
// Separate from parsing on purpose: parseCommand decides what she meant and
// touches nothing, this does the writing. It means the parser can be tested
// without a database, and a change to wording can never quietly change what
// gets written.

/** Save a journal entry that arrived by text. */
async function writeJournal(body: string, kind: "journal" | "prayer"): Promise<string> {
  const data = await loadData();
  const entry: JournalEntry = {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: chicagoDay(),
    createdAt: new Date().toISOString(),
    body,
    // Dictated into Messages far more often than typed, and either way it
    // arrived as speech-to-text. Marking it spoken keeps the page honest.
    source: "spoken",
    kind,
    ...(kind === "prayer" ? {} : { tags: ["weekly"] as string[] }),
  } as JournalEntry;

  await saveData({ ...data, journal: [...(data.journal ?? []), entry] });

  const words = body.trim().split(/\s+/).length;
  return kind === "prayer"
    ? `Saved to your prayers. ${words} words.`
    : `Saved to your journal. ${words} words.`;
}

/** The three named places to drive today. */
async function optionsReply(): Promise<string> {
  const [placeList, bridgeList, state] = await Promise.all([places(), bridges(), progressRows()]);
  const tracks = buildTracks(state, placeList);
  return optionsText(driveOptions({ places: placeList, bridges: bridgeList, tracks, drivenKeys: [] }));
}

/** Where everything stands, in one message. */
async function statusReply(): Promise<string> {
  const today = chicagoDay();
  const { start, end } = weekBounds(today);
  const [study, bridgeList, logs, placeList] = await Promise.all([
    studyProgress().catch(() => null),
    bridges().catch(() => []),
    logsBetween(start, end).catch(() => []),
    places().catch(() => []),
  ]);

  const steps = logs.filter(l => l.kind === "steps" && l.steps != null);
  const avg = steps.length ? Math.round(steps.reduce((n, s) => n + (s.steps ?? 0), 0) / steps.length) : null;
  const nextBridge = bridgeList.find(b => b.reps < b.target);

  const lines = [
    study ? `Foundations ${study.doneCount}/${study.total}. Next: ${study.next?.title ?? "all done"}.` : null,
    nextBridge ? `Next bridge: ${nextBridge.label} (${nextBridge.reps}/${nextBridge.target}).` : null,
    avg ? `Steps this week: ${avg.toLocaleString("en-US")} average over ${steps.length}.` : "No steps logged this week.",
    `Drives logged: ${logs.filter(l => l.kind === "drive").length}.`,
    placeList.length ? null : "No addresses saved yet — text: set home <address>",
  ].filter(Boolean);

  return lines.join("\n");
}

const WEEK: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * The next day that carries this kind of block, after today.
 *
 * Her scheduled days, in order, wrapping round the week — so Thursday's drive
 * lands on Saturday rather than on "tomorrow", which would put a drive on a
 * day that was never meant to have one.
 */
function nextDayFor(kind: "drive" | "study", from: Day): Day | null {
  const days = kind === "drive" ? DRIVE_DAYS : STUDY_DAYS;
  const start = WEEK.indexOf(from);
  for (let i = 1; i <= 7; i++) {
    const d = WEEK[(start + i) % 7];
    if (days.includes(d)) return d;
  }
  return null;
}

/**
 * Read a message as backing out of today, and move the thing rather than
 * answering about it.
 *
 * Returns null when nothing is planned today, or nothing of the kind she
 * named — then it is just a sentence, and the assistant takes it.
 */
export async function maybeDecline(body: string): Promise<string | null> {
  const said = parseDecline(body);
  if (!said) return null;

  const today = dayOf(chicagoDay()) as Day;
  const kinds: Array<"drive" | "study"> = said.what ? [said.what] : ["drive", "study"];

  for (const kind of kinds) {
    const item = await planFor(today, kind);
    if (!item) continue;

    const to = nextDayFor(kind, today);
    if (!to) continue;

    // If that day already has one, this would overwrite it. Say so instead —
    // losing a plan she made is worse than making her pick a day.
    if (await planFor(to, kind)) {
      return `${capitalise(to)} already has a ${kind}. Text "move ${kind} to <day>" with where you want this one.`;
    }

    await clearPlanItem(today, kind);
    await setPlanItem({ ...item, day: to });
    return `Moved to ${capitalise(to)}: ${item.detail}. Nothing owing today.`;
  }

  return null;
}

const DAY_NAME: Record<Day, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
};
const capitalise = (d: Day) => DAY_NAME[d];

/**
 * Read a message as the answer to the Sunday reset, if one is owing.
 *
 * Returns null when no reset is open or the message is too short to be the
 * answer to four questions — a "yeah" or a "k" after the prompt is not a
 * review, and recording it as one would put an empty week on the dashboard.
 *
 * The raw text is saved before the parsing runs, so her words survive even if
 * the model is down, out of credit, or returns nonsense.
 */
export async function maybeReview(body: string): Promise<string | null> {
  if (!(await resetWindowOpen())) return null;
  const text = body.trim();
  if (text.split(/\s+/).length < 5) return null;

  await writeJournal(text, "journal");
  const review = await parseReview(text);
  await saveReview(weekEndFor(), review, text);
  await closeResetWindow();
  return reviewAck(review);
}

/**
 * Run a command.
 *
 * Returns null when the text wasn't a command at all, which hands it to the
 * assistant to answer as a question.
 */
export async function runCommand(body: string): Promise<string | null> {
  const cmd: Command = parseCommand(body);
  if (!cmd) return null;

  switch (cmd.kind) {
    case "journal":
      return writeJournal(cmd.body, "journal");

    case "prayer":
      return writeJournal(cmd.body, "prayer");

    case "setHome":
      await setPlace("home", "Home", cmd.address, "anchor");
      return "Home saved. Route links will avoid interstates from here on.";

    case "setWork":
      await setPlace("work", "Work", cmd.address, "anchor");
      return "Work saved.";

    case "addPlace":
      await setPlace(`dest-${Date.now()}`, cmd.label, cmd.address, "destination");
      return `Added ${cmd.label}. Text "drive" for today's three options.`;

    case "addBridge": {
      const existing = await bridges();
      await addBridge({ label: cmd.label, rank: existing.length + 1, doneBefore: cmd.doneBefore });
      return cmd.doneBefore
        ? `Added ${cmd.label}, marked as one you've driven before.`
        : `Added ${cmd.label}.`;
    }

    case "droveBridge": {
      const list = await bridges();
      // Matched loosely because she will text "crossed the charlotte overpass"
      // rather than the label she typed three weeks ago.
      const needle = cmd.label.toLowerCase();
      const hit = list.find(b => b.label.toLowerCase().includes(needle) || needle.includes(b.label.toLowerCase()));
      if (!hit) return `I don't have a bridge matching "${cmd.label}". Text: add bridge ${cmd.label}`;
      await logBridge(hit.id);
      const left = hit.target - hit.reps - 1;
      return left > 0
        ? `${hit.label} logged. ${left} more to make it ordinary.`
        : `${hit.label} logged — that's it done.`;
    }

    case "drove":
      return `Noted: ${cmd.label}. Reply "drive 60 80 30" with your before, peak and after if you want it logged.`;

    case "options":
      return optionsReply();

    case "reset":
      // Opening the window is what makes the next message an answer rather
      // than a question. Without it her reply reads as a sentence for the
      // assistant and the numbers in it go nowhere.
      await openResetWindow();
      return RESET_PROMPT;

    case "status":
      return statusReply();

    case "move": {
      // Moving is a delete plus an insert, because the plan is keyed on the day
      // — there is no row to edit, only a day that has one or doesn't.
      const from = cmd.from ?? (dayOf(chicagoDay()) as Day);
      const item = await planFor(from, cmd.what);
      if (!item) {
        return `Nothing planned for ${from} ${cmd.what}. Text: ${cmd.what === "drive" ? "plan" : "plan"} ${cmd.to} ${cmd.what}: <what>`;
      }
      await clearPlanItem(from, cmd.what);
      await setPlanItem({ ...item, day: cmd.to });
      return `Moved: ${item.detail} is now ${cmd.to}, not ${from}.`;
    }
  }
}
