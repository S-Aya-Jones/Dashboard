import { NextRequest, NextResponse } from "next/server";
import {
  replyTelegram,
  logInbound,
  parseRemindCommand,
  createReminder,
  getReminders,
  toggleReminder,
  formatTimeOfDay,
  formatDaysOfWeek,
} from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (incoming !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = update.message as Record<string, unknown> | undefined;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = (msg.chat as Record<string, unknown>).id as number;
  const raw    = (msg.text as string).trim();

  // Auto-capture chatId if not yet configured
  if (!process.env.TELEGRAM_CHAT_ID) {
    await replyTelegram(
      chatId,
      `Your chat ID is <code>${chatId}</code>\n\nAdd this to your environment variables:\nTELEGRAM_CHAT_ID=${chatId}`,
    );
    await logInbound(raw, "chat_id_reveal", { chatId });
    return NextResponse.json({ ok: true });
  }

  // /remind
  if (/^\/remind(\s|@)/i.test(raw)) {
    const parsed = parseRemindCommand(raw);
    if (!parsed) {
      await replyTelegram(
        chatId,
        "Couldn't parse that. Try:\n" +
        "/remind Study orgo daily at 7:00pm\n" +
        "/remind Lift mon,wed,fri at 6:00am",
      );
      await logInbound(raw, "remind_parse_fail", { raw });
    } else {
      const r = await createReminder({
        title:        parsed.title,
        scheduleType: parsed.scheduleType,
        timeOfDay:    parsed.timeOfDay,
        daysOfWeek:   parsed.daysOfWeek,
        active:       true,
      });
      const timeStr  = formatTimeOfDay(r.timeOfDay);
      const schedStr = r.scheduleType === "daily"
        ? "daily"
        : `every ${formatDaysOfWeek(r.daysOfWeek ?? [])}`;
      await replyTelegram(chatId, `✅ Reminder set!\n<b>${r.title}</b>\n${schedStr} at ${timeStr}`);
      await logInbound(raw, "remind_created", { id: r.id, title: r.title });
    }
    return NextResponse.json({ ok: true });
  }

  // /list
  if (/^\/list(@|\s|$)/i.test(raw)) {
    const reminders = await getReminders();
    const active    = reminders.filter(r => r.active);
    if (active.length === 0) {
      await replyTelegram(chatId, "No active reminders.\nCreate one with: /remind &lt;title&gt; daily at 7:00pm");
    } else {
      const lines = active.map((r, i) => {
        const timeStr  = formatTimeOfDay(r.timeOfDay);
        const schedStr = r.scheduleType === "daily" ? "daily" : formatDaysOfWeek(r.daysOfWeek ?? []);
        return `${i + 1}. <b>${r.title}</b> — ${schedStr} at ${timeStr}`;
      });
      await replyTelegram(chatId, `📋 Active reminders:\n${lines.join("\n")}\n\nTurn off: /off &lt;number&gt;`);
    }
    await logInbound(raw, "list", {});
    return NextResponse.json({ ok: true });
  }

  // /off [n]
  if (/^\/off(@|\s|$)/i.test(raw)) {
    const reminders = await getReminders();
    const active    = reminders.filter(r => r.active);
    const match     = raw.match(/\/off\s+(\d+)/i);
    if (!match) {
      if (active.length === 0) {
        await replyTelegram(chatId, "No active reminders.");
      } else {
        const lines = active.map((r, i) => `${i + 1}. ${r.title} — ${formatTimeOfDay(r.timeOfDay)}`);
        await replyTelegram(chatId, `Which to turn off?\n${lines.join("\n")}\n\nReply: /off &lt;number&gt;`);
      }
    } else {
      const idx = parseInt(match[1]) - 1;
      if (idx < 0 || idx >= active.length) {
        await replyTelegram(chatId, `No reminder #${idx + 1}. Use /list to see options.`);
      } else {
        await toggleReminder(active[idx].id, false);
        await replyTelegram(chatId, `⏸ Turned off: <b>${active[idx].title}</b>`);
        await logInbound(raw, "reminder_off", { id: active[idx].id });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // /on [n]
  if (/^\/on(\s|@)/i.test(raw)) {
    const reminders = await getReminders();
    const inactive  = reminders.filter(r => !r.active);
    const match     = raw.match(/\/on\s+(\d+)/i);
    if (!match) {
      if (inactive.length === 0) {
        await replyTelegram(chatId, "No inactive reminders.");
      } else {
        const lines = inactive.map((r, i) => `${i + 1}. ${r.title} — ${formatTimeOfDay(r.timeOfDay)}`);
        await replyTelegram(chatId, `Which to turn on?\n${lines.join("\n")}\n\nReply: /on &lt;number&gt;`);
      }
    } else {
      const idx = parseInt(match[1]) - 1;
      if (idx < 0 || idx >= inactive.length) {
        await replyTelegram(chatId, `No paused reminder #${idx + 1}.`);
      } else {
        await toggleReminder(inactive[idx].id, true);
        await replyTelegram(chatId, `▶️ Turned on: <b>${inactive[idx].title}</b>`);
        await logInbound(raw, "reminder_on", { id: inactive[idx].id });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // /start or /help
  if (/^\/start(@|\s|$)/i.test(raw) || /^\/help(@|\s|$)/i.test(raw)) {
    await replyTelegram(
      chatId,
      "👋 Aya's Dashboard bot\n\n" +
      "📋 Commands:\n" +
      "/remind &lt;title&gt; daily at 7:00pm — set daily reminder\n" +
      "/remind &lt;title&gt; mon,wed,fri at 6:00am — set weekly\n" +
      "/list — show active reminders\n" +
      "/off &lt;n&gt; — pause a reminder\n" +
      "/on &lt;n&gt; — resume a reminder\n" +
      "/log &lt;note&gt; — save a note\n\n" +
      "Or just type anything to log it.",
    );
    await logInbound(raw, "help", {});
    return NextResponse.json({ ok: true });
  }

  // /log or free text — store note
  const noteText      = raw.startsWith("/log ") ? raw.slice(5).trim() : raw;
  const isExplicitLog = raw.startsWith("/log ");
  await logInbound(raw, isExplicitLog ? "explicit_log" : "free_text", { note: noteText });
  await replyTelegram(chatId, "📝 Logged.");

  return NextResponse.json({ ok: true });
}
