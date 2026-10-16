import Anthropic from "@anthropic-ai/sdk";
import { firstText } from "@/lib/aiError";
import { chicagoDay, dayLine } from "@/lib/planBrief";
import { wholePlan, dayOf, atHome } from "@/lib/habitTexts";
import { driveWindow, daylight } from "@/lib/daylight";
import { dailyHeightLine } from "@/lib/heights";
import { nextTopic } from "@/lib/studyTopics";
import { places, bridges, progressRows, buildTracks } from "@/lib/driving";
import { driveOptions } from "@/lib/driveOptions";
import { loadData } from "@/lib/db";
import { schoolIsPaused } from "@/lib/modules";
import { getActionableEmails } from "@/lib/gmail";
import { CARDS, SAVINGS, nextPayday, money } from "@/lib/paycheckPlan";

// The morning text, written rather than assembled.
//
// Her description of the ideal one: the walk, anything worth knowing about
// money or email, and where to drive — in a single message, because "I know I
// can only do so much" and six pings is six chances to start ignoring them.
//
// So this gathers everything that might be worth saying, hands it to a model,
// and asks for the few lines that actually are. Most mornings there is no bill
// and no email and it should say so by not mentioning them. A briefing that
// always has five sections is a briefing that gets skimmed.
//
// It degrades rather than fails: with no API key, or on any error, the caller
// falls back to the plain assembled text. A missing briefing is worse than a
// boring one.

export interface MorningFacts {
  date: string;
  weekday: string;
  /** No work car park, no lift, no commute — and the quietest roads of her week. */
  workingFromHome: boolean;
  sunset: string | null;
  driveWindow: string | null;
  darkEarly: string | null;
  schedule: string;
  /** The climb: one floor at a time, possible wherever she is. */
  heightStep: string | null;
  studyTopic: string | null;
  plannedDrive: { detail: string; link: string | null } | null;
  driveOptions: string[];
  money: { nextPayday: string | null; daysToPayday: number | null; perCheckSpending: number; savingsPerCheck: number } | null;
  billsSoon: string[];
  emailsWorthKnowing: string[];
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
}

export async function gatherMorning(dateStr = chicagoDay()): Promise<MorningFacts> {
  const day = dayOf(dateStr);

  const [plan, topic, placeList, bridgeList, state, data, mail, heightLine] = await Promise.all([
    wholePlan().catch(() => []),
    nextTopic().catch(() => null),
    places().catch(() => []),
    bridges().catch(() => []),
    progressRows().catch(() => []),
    loadData().catch(() => null),
    getActionableEmails().catch(() => ({ deadlines: [], health: [], bills: [], action: [] })),
    dailyHeightLine().catch(() => null),
  ]);

  const opts = driveOptions({
    places: placeList, bridges: bridgeList,
    tracks: buildTracks(state, placeList), drivenKeys: [],
  });

  const planned = plan.find(p => p.day === day && p.kind === "drive");
  const payday = nextPayday(dateStr);
  const home = atHome(day);
  const light = daylight(dateStr);
  const window = driveWindow(dateStr);

  return {
    date: dateStr,
    weekday: day,
    workingFromHome: home,
    sunset: light?.sunsetLabel ?? null,
    driveWindow: window.label,
    darkEarly: window.note,
    schedule: dayLine(dateStr),
    heightStep: heightLine,
    studyTopic: topic?.title ?? null,
    plannedDrive: planned ? { detail: planned.detail, link: planned.link } : null,
    driveOptions: opts.options.map(o => `${o.label} — ${o.detail}${o.link ? ` ${o.link}` : ""}`),
    money: {
      nextPayday: payday,
      daysToPayday: payday ? daysBetween(dateStr, payday) : null,
      perCheckSpending: CARDS[1].lines.reduce((n, l) => n + l.perCheck, 0),
      savingsPerCheck: SAVINGS.perCheck,
    },
    // Bills she has actually recorded, not every line of the plan — the plan
    // is the same every fortnight and saying it daily is noise.
    billsSoon: (data?.recurringBills ?? [])
      .filter(b => typeof b?.dayOfMonth === "number")
      .filter(b => {
        const d = new Date(`${dateStr}T12:00:00`).getDate();
        const gap = b.dayOfMonth - d;
        return gap >= 0 && gap <= 3;
      })
      .map(b => `${b.name} ${money(Number(b.amount ?? 0))} due on the ${b.dayOfMonth}`),
    // School mail is dropped while the programme is suspended. A deadline she
    // is not sitting is the most alarming line the briefing can carry and the
    // one she can do nothing about.
    emailsWorthKnowing: [...mail.deadlines, ...mail.bills, ...mail.action]
      .filter(e => !(schoolIsPaused(data?.pausedModules) && e.category === "school"))
      .slice(0, 3)
      .map(e => `${e.senderName ?? e.senderEmail ?? "someone"}: ${e.subject ?? ""}`.trim()),
  };
}

const SYSTEM = `You write one morning text message for Aya. It is the only message she gets before work, so it carries everything worth carrying — and nothing else.

Rules:
- Under 420 characters. It is an SMS.
- Plain text, no markdown, no emoji, no greeting, no sign-off.
- Always include the walk: 45 minutes on the treadmill at 1.5 to 2 mph, goal 20,000 steps.
- Always include heightStep, word for word, when there is one. It is the day's heights work and it is the same whether she is at the office or at home.
- On a workingFromHome day she is not going to an office: no car park, no lift, no drive home. The walk is her own treadmill or the block. If there is a driveWindow, you may offer it once as the quietest roads of her week — an offer, not an instruction.
- Say the sunset time only when darkEarly is set, and then say it once.
- If there is a drive today, name the place and paste its link exactly as given. Never invent a street, route or place name.
- Mention money only if something is actually happening: a bill due in the next three days, or payday today or tomorrow. The fortnightly plan is the same every time and is not news.
- Mention email only if one of the listed ones genuinely needs her before this evening.
- If there is nothing to say about money or email, say nothing about them. Do not write "nothing to report".
- Order: walk, then today's drive or study, then the small exposure, then anything noticed.

Tone: a competent friend with the facts, not a coach. No encouragement, no exclamation marks. She knows what she is doing.`;

/** The composed text, or null to fall back to the plain assembled one. */
export async function composeMorning(dateStr = chicagoDay()): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const facts = await gatherMorning(dateStr);
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(facts, null, 1) }],
    });
    const text = firstText(msg)?.trim();
    return text && text.length > 20 ? text : null;
  } catch {
    return null;
  }
}
