import { NextRequest, NextResponse } from "next/server";
import {
  keywordOf, optOut, subscribe, findByPhone, normalisePhone,
  STOP_MSG, HELP_MSG, CONFIRM_MSG,
} from "@/lib/smsSubscribers";
import { parseReply, logEntry, setPlanItem, stepsReply } from "@/lib/habitTexts";
import { chicagoDay } from "@/lib/planBrief";
import { nextTopic, markDone, passed } from "@/lib/studyTopics";
import { aiReply } from "@/lib/aiText";
import { findByPhone as subscriberByPhone } from "@/lib/smsSubscribers";

export const dynamic = "force-dynamic";

// Twilio's inbound webhook: STOP, START and HELP.
//
// Point Twilio's "A message comes in" at this URL for the campaign number.
//
// Twilio does answer STOP itself at the carrier level, but that only stops its
// own sending — this application would carry on queueing messages for a number
// that has withdrawn consent, and the opt-out would be invisible to the one
// place a reviewer or a regulator would look. So the withdrawal is recorded
// here too, per number, taking effect immediately and independently of every
// other subscriber.
//
// Replies go back as TwiML rather than as a fresh API call, so a STOP is
// answered on the same connection even if the send path is blocked.

function twiml(message: string | null) {
  const body = message
    ? `<Response><Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message></Response>`
    : "<Response/>";
  return new NextResponse(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = String(form.get("From") ?? "");
    const body = String(form.get("Body") ?? "");

    const phone = normalisePhone(from);
    if (!phone) return twiml(null);

    switch (keywordOf(body)) {
      case "stop":
        await optOut(phone);
        return twiml(STOP_MSG);

      case "start": {
        // Re-subscribing writes a fresh consent timestamp. The previous one was
        // withdrawn and no longer says anything true.
        const existing = await findByPhone(phone);
        await subscribe({ phone, name: existing?.name ?? null, role: existing?.role ?? "partner", ip: null });
        return twiml(CONFIRM_MSG);
      }

      case "help":
        return twiml(HELP_MSG);

      default:
        break;
    }

    // Not a keyword, so it may be a habit log. Order matters: STOP and HELP are
    // checked first above, because a reply must never be swallowed by the
    // logger when it was meant to stop messages.
    const parsed = parseReply(body);
    const today = chicagoDay();

    switch (parsed?.kind) {
      case "steps":
        await logEntry(today, parsed);
        return twiml(stepsReply(parsed.steps));

      case "drive":
        await logEntry(today, parsed);
        return twiml(`Logged: before ${parsed.before}, peak ${parsed.peak}, after ${parsed.after}.`);

      case "study": {
        await logEntry(today, parsed);

        // The topic only closes on a score. Below 5/6 it stays open and comes
        // back in the next study text, which is the point of ordering them —
        // moving on from a topic she got four out of six on would bury the gap.
        const current = await nextTopic();
        if (!current) {
          return twiml(`Logged: ${parsed.minutes} min. All topics are done.`);
        }
        if (passed(parsed.quiz)) {
          await markDone(current.index, parsed.quiz);
          const after = await nextTopic();
          return twiml(
            `Logged: ${parsed.minutes} min, quiz ${parsed.quiz}. ` +
            `"${current.title}" is done.` +
            (after ? ` Next: ${after.title}.` : " That's all eighteen."),
          );
        }
        return twiml(
          `Logged: ${parsed.minutes} min${parsed.quiz ? `, quiz ${parsed.quiz}` : ""}. ` +
          `Staying on "${current.title}" — it closes at 5/6.`,
        );
      }

      case "skip":
        await logEntry(today, parsed);
        return twiml(`Skipped, noted: ${parsed.reason}`);

      case "plan": {
        if (!parsed.items.length) {
          return twiml('Couldn\'t read that plan. One line each, like "tue drive: Murfreesboro loop https://... 40"');
        }
        for (const item of parsed.items) await setPlanItem(item);
        const days = parsed.items.map(i => `${i.day} ${i.kind}`).join(", ");
        return twiml(`Plan updated: ${days}.`);
      }

      default: {
        // Not a keyword and not a log. Previously this fell into silence, which
        // is what made the texts one-way — she could be told things but could
        // not ask anything.
        //
        // Only subscribers get an answer. An unknown number texting in gets
        // nothing, because replying would be sending an unsolicited message to
        // someone who never consented, which is the exact thing the campaign
        // registration promises not to do.
        const sub = await subscriberByPhone(phone);
        if (!sub?.active) return twiml(null);

        const answer = await aiReply(body);
        return twiml(answer);
      }
    }
  } catch {
    return twiml(null);
  }
}
