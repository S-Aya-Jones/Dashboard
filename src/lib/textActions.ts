import { loadData, saveData } from "@/lib/db";
import type { JournalEntry } from "@/types/dashboard";
import { chicagoDay } from "@/lib/planBrief";
import {
  places, setPlace, bridges, addBridge, logBridge, progressRows, buildTracks,
} from "@/lib/driving";
import { driveOptions, optionsText } from "@/lib/driveOptions";
import { progress as studyProgress } from "@/lib/studyTopics";
import { logsBetween, weekBounds } from "@/lib/habitTexts";
import { parseCommand, RESET_PROMPT, type Command } from "@/lib/textCommands";

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
      return RESET_PROMPT;

    case "status":
      return statusReply();
  }
}
