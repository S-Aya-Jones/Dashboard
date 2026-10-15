import { chicagoDay } from "@/lib/planBrief";
import {
  todayA, todayB, todayC, todayDMon, todayDThu, dowOf,
  isCDay, isDMonDay, isDThuDay, isADay, aCounts,
  recordRep, recordSkip, nudge, consumePrediction,
} from "@/lib/exposure/engine";
import { addPrediction, setSetting, settings, markOff, queueLine } from "@/lib/exposure/store";
import type { TrackKey } from "@/lib/exposure/rungs";
import { whereLine } from "@/lib/exposure/lines";

// What she texts back.
//
//   p 70                  how sure the scary thing happens, before the rep
//   drive 40 75 20 no     before, peak, after, did it happen
//   h 30 60 15 no         the height rep, same shape
//   skip drive <reason>   or skip h <reason>
//   set floor 4           comfort floor
//   set deck 2            usual Capitol View deck
//   next drive            and back, hold, across drive sun h mon thu
//   where                 every track
//   therapist ok          unlocks B9 and B10
//   off                   no drive and no height lines today
//
// Parsed here and nowhere else, ahead of the older formats, because "drive 40
// 75 20 no" and the old "drive 60 80 30" would otherwise both match and the
// older one would quietly drop the answer that matters most.

export type Reply =
  | { kind: "prediction"; value: number }
  | { kind: "rep"; what: "drive" | "h"; before: number; peak: number; after: number; happened: boolean }
  | { kind: "skip"; what: "drive" | "h"; reason: string }
  | { kind: "setFloor"; value: number }
  | { kind: "setDeck"; value: number }
  | { kind: "nudge"; dir: "next" | "back" | "hold"; track: TrackKey }
  | { kind: "where" }
  | { kind: "therapistOk" }
  | { kind: "off" }
  | null;

const TRACK_WORD: Record<string, TrackKey> = {
  drive: "A", sun: "B", h: "C", mon: "DMON", thu: "DTHU",
};

function yesNo(w: string | undefined): boolean | null {
  if (!w) return null;
  const t = w.toLowerCase().replace(/[^a-z]/g, "");
  if (["no", "n", "nope", "didnt", "didntHappen".toLowerCase()].includes(t)) return false;
  if (["yes", "y", "yep", "yeah", "did"].includes(t)) return true;
  return null;
}

export function parseExposureReply(body: string): Reply {
  const raw = String(body ?? "").trim();
  if (!raw) return null;
  const words = raw.split(/\s+/);
  const head = words[0].toLowerCase().replace(/[^a-z]/g, "");
  const nums = (from: number) =>
    words.slice(from).map(w => Number(w.replace(/[^0-9]/g, ""))).filter(n => Number.isFinite(n));

  if (head === "p") {
    const v = Number(words[1]?.replace(/[^0-9]/g, ""));
    return Number.isFinite(v) && v >= 0 && v <= 100 ? { kind: "prediction", value: v } : null;
  }

  if (head === "where") return words.length === 1 ? { kind: "where" } : null;
  if (head === "off") return words.length === 1 ? { kind: "off" } : null;

  if (head === "therapist" && words[1]?.toLowerCase().startsWith("ok")) {
    return { kind: "therapistOk" };
  }

  if (head === "skip") {
    const what = words[1]?.toLowerCase().replace(/[^a-z]/g, "");
    if (what !== "drive" && what !== "h") return null;
    const reason = words.slice(2).join(" ").trim();
    return reason ? { kind: "skip", what, reason } : null;
  }

  if (head === "set") {
    const what = words[1]?.toLowerCase().replace(/[^a-z]/g, "");
    const v = Number(words[2]?.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(v) || v < 0) return null;
    if (what === "floor") return { kind: "setFloor", value: v };
    if (what === "deck") return { kind: "setDeck", value: v };
    return null;
  }

  if (head === "next" || head === "back" || head === "hold") {
    const t = TRACK_WORD[words[1]?.toLowerCase().replace(/[^a-z]/g, "") ?? ""];
    return t ? { kind: "nudge", dir: head, track: t } : null;
  }

  if (head === "drive" || head === "h") {
    const n = nums(1);
    if (n.length < 3) return null;
    const happened = yesNo(words[words.length - 1]);
    // The yes or no is the only part that decides whether it was clean, so a
    // reply without one is not logged. Guessing it would quietly invent her
    // progress in whichever direction the guess went.
    if (happened == null) return null;
    return {
      kind: "rep",
      what: head === "drive" ? "drive" : "h",
      before: n[0], peak: n[1], after: n[2],
      happened,
    };
  }

  return null;
}

/** Which track a "drive" or "h" log belongs to on a given day. */
export async function trackFor(what: "drive" | "h", dateStr: string): Promise<{ track: TrackKey; rung: string; counted: boolean } | null> {
  const d = dowOf(dateStr);

  if (what === "drive") {
    if (d === "sun") {
      const b = await todayB(dateStr);
      return b ? { track: "B", rung: b.rung, counted: true } : null;
    }
    if (!isADay(dateStr)) return null;
    const a = await todayA(dateStr);
    // Monday is logged in full and never counted.
    return a ? { track: "A", rung: a.rung, counted: aCounts(dateStr) } : null;
  }

  if (isDMonDay(dateStr)) {
    const m = await todayDMon(dateStr);
    return m ? { track: "DMON", rung: `deck ${m.deck} floor ${m.floor}`, counted: true } : null;
  }
  if (isDThuDay(dateStr)) {
    const t = await todayDThu(dateStr);
    return t ? { track: "DTHU", rung: t.rung, counted: true } : null;
  }
  if (isCDay(dateStr)) {
    const c = await todayC(dateStr);
    // Wednesday at home is its own thing and does not move the C ladder.
    return c ? { track: "C", rung: c.rung, counted: c.rung !== "CWED" } : null;
  }
  return null;
}

/** Run one reply. Returns the text to send back, or null if it was not one. */
export async function runExposureReply(body: string): Promise<string | null> {
  const r = parseExposureReply(body);
  if (!r) return null;
  const today = chicagoDay();

  switch (r.kind) {
    case "prediction":
      await addPrediction(today, r.value);
      return `Noted: ${r.value} out of 100. Go.`;

    case "where":
      return whereLine();

    case "off":
      await markOff(today);
      return "Off today. No drive line and no height line.";

    case "therapistOk":
      await setSetting("therapistOk", "1");
      return "B9 and B10 unlocked.";

    case "setFloor":
      await setSetting("comfortFloor", String(r.value));
      return `Comfort floor set to ${r.value}.`;

    case "setDeck":
      await setSetting("usualDeck", String(r.value));
      return `Usual deck set to ${r.value}.`;

    case "nudge":
      return nudge(r.track, r.dir);

    case "skip": {
      const t = await trackFor(r.what, today);
      if (!t) return `Nothing on ${r.what === "drive" ? "the drive" : "the height"} track today.`;
      await recordSkip(today, t.track, t.rung, r.reason);
      return `Skipped, noted: ${r.reason}`;
    }

    case "rep": {
      const t = await trackFor(r.what, today);
      if (!t) return `Nothing on ${r.what === "drive" ? "the drive" : "the height"} track today, so I have not logged that.`;

      const predicted = await consumePrediction(today);
      const adv = await recordRep({
        dateStr: today,
        track: t.track,
        rung: t.rung,
        before: r.before,
        peak: r.peak,
        after: r.after,
        happened: r.happened,
        counted: t.counted,
      });
      if (adv.line) await queueLine(t.track, adv.line);

      const bits = [`Logged ${t.rung}: ${r.before}, ${r.peak}, ${r.after}, ${r.happened ? "yes" : "no"}.`];
      // The prediction is only worth anything next to what actually happened.
      if (predicted != null && !r.happened) {
        bits.push(`You said ${predicted} out of 100 and it did not happen.`);
      } else if (predicted != null) {
        bits.push(`You said ${predicted} out of 100.`);
      }
      if (!t.counted) bits.push("Logged, not counted.");
      return bits.join(" ");
    }
  }
}

export { settings };
