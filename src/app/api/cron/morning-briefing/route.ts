import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadData } from "@/lib/db";
import { getAuthedClient } from "@/lib/google";
import { google } from "googleapis";
import { getPlaidClient, getPlaidItems, decryptToken } from "@/lib/plaid";
import nodemailer from "nodemailer";

const client = new Anthropic();

async function getAccounts() {
  try {
    const items = await getPlaidItems("aya");
    if (!items.length) return [];
    const plaid = getPlaidClient();
    const all = [];
    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp = await plaid.accountsGet({ access_token: token });
        for (const acc of resp.data.accounts) {
          all.push({
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            current: acc.balances.current,
            available: acc.balances.available,
            limit: acc.balances.limit,
          });
        }
      } catch { /* skip failed items */ }
    }
    return all;
  } catch { return []; }
}

async function getRecentTransactions() {
  try {
    const items = await getPlaidItems("aya");
    if (!items.length) return [];
    const plaid = getPlaidClient();
    const all = [];
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    for (const item of items) {
      try {
        const token = decryptToken(item.access_token_enc);
        const resp = await plaid.transactionsGet({
          access_token: token,
          start_date: since,
          end_date: today,
          options: { count: 100 },
        });
        for (const tx of resp.data.transactions) {
          if (tx.amount > 0) { // positive = money out
            all.push({
              name: tx.name,
              amount: tx.amount,
              date: tx.date,
              category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? "OTHER",
            });
          }
        }
      } catch { /* skip */ }
    }
    return all.sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

async function getTodayCalendarEvents() {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) return [];
    const auth = getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const resp = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    return (resp.data.items ?? []).map(e => ({
      title: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date,
      allDay: !e.start?.dateTime,
      location: e.location,
    }));
  } catch { return []; }
}

async function getImportantEmails() {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) return [];
    const auth = getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });
    const list = await gmail.users.threads.list({
      userId: "me",
      q: "in:inbox is:unread",
      maxResults: 20,
    });
    const threads = list.data.threads ?? [];
    const summaries = [];
    for (const t of threads.slice(0, 10)) {
      try {
        const detail = await gmail.users.threads.get({
          userId: "me", id: t.id!, format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const msg = detail.data.messages?.[0];
        const headers = msg?.payload?.headers ?? [];
        const get = (name: string) => headers.find(h => h.name === name)?.value ?? "";
        summaries.push({
          subject: get("Subject") || "(no subject)",
          from: get("From"),
          snippet: detail.data.snippet ?? "",
        });
      } catch { /* skip */ }
    }
    return summaries;
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [data, accounts, transactions, calendarEvents, emails] = await Promise.all([
      loadData(),
      getAccounts(),
      getRecentTransactions(),
      getTodayCalendarEvents(),
      getImportantEmails(),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // 75 Hard status
    const h75 = data.seventyFiveHard;
    const startDate = h75?.startDate ?? "2026-06-14";
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const dayNum = Math.max(1, Math.floor((todayD.getTime() - start.getTime()) / 86400000) + 1);
    const yesterdayLog = h75?.logs.find(l => l.date === yesterday);
    const todayLog = h75?.logs.find(l => l.date === today);

    // Sleep
    const lastSleep = data.sleepLogs?.slice(-1)[0];

    // Steps
    const walkingLogs = data.workout?.walkingLogs ?? [];
    const yesterdaySteps = walkingLogs.find(l => l.date === yesterday)?.steps;

    // Weight
    const weights = data.workout?.bodyWeight ?? [];
    const latestWeight = weights.slice(-1)[0];

    // MCAT study sessions this week
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recentStudy = (data.studySessions ?? []).filter(s => s.date >= weekAgo);
    const studyTimerThisWeek = (data.studyTimerLogs ?? [])
      .filter(l => l.date >= weekAgo)
      .reduce((sum, l) => sum + Math.round((l.durationSeconds ?? 0) / 60), 0);

    // Budget categories
    const budgetCategories = data.budgetCategories ?? [];
    const categorySpend: Record<string, number> = {};
    const thisMonth = today.slice(0, 7);
    for (const tx of transactions) {
      if (tx.date.startsWith(thisMonth)) {
        const cat = tx.category;
        categorySpend[cat] = (categorySpend[cat] ?? 0) + tx.amount;
      }
    }

    const overBudget = budgetCategories
      .filter(bc => categorySpend[bc.category] > bc.monthlyLimit)
      .map(bc => ({
        category: bc.category,
        spent: categorySpend[bc.category],
        limit: bc.monthlyLimit,
        over: categorySpend[bc.category] - bc.monthlyLimit,
      }));

    // Checking balance
    const checkingAccount = accounts.find(a => a.type === "depository" && a.subtype === "checking");
    const savingsAccount = accounts.find(a => a.type === "depository" && a.subtype === "savings");
    const creditAccounts = accounts.filter(a => a.type === "credit");

    // Upcoming bills (next 7 days)
    const todayDay = new Date().getDate();
    const upcomingBills = (data.recurringBills ?? []).filter(b => {
      const diff = b.dayOfMonth - todayDay;
      return diff >= 0 && diff <= 7;
    });

    // Build context for Claude
    const context = {
      today,
      dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
      "75hard": {
        dayNumber: dayNum,
        active: todayD >= start,
        yesterdayCompleted: yesterdayLog ? {
          workout: yesterdayLog.workout,
          steps: yesterdayLog.steps,
          water: yesterdayLog.water,
          mcat: yesterdayLog.mcat,
          progressPhoto: yesterdayLog.progressPhoto,
          diet: yesterdayLog.diet,
          exposureTherapy: yesterdayLog.exposureTherapy,
        } : null,
        todayStarted: todayLog ? Object.values(todayLog).some(v => v === true) : false,
      },
      health: {
        lastSleepQuality: lastSleep?.quality,
        lastSleepHours: lastSleep && lastSleep.wakeTime && lastSleep.bedtime
          ? (() => {
              const [bh, bm] = lastSleep.bedtime.split(":").map(Number);
              const [wh, wm] = lastSleep.wakeTime.split(":").map(Number);
              const hours = (wh + (wm / 60)) - (bh + (bm / 60));
              return hours < 0 ? hours + 24 : hours;
            })()
          : null,
        yesterdaySteps,
        latestWeight: latestWeight?.weight,
      },
      finances: {
        checkingBalance: checkingAccount?.available ?? checkingAccount?.current,
        savingsBalance: savingsAccount?.current,
        creditCards: creditAccounts.map(a => ({
          name: a.name,
          balance: Math.abs(a.current ?? 0),
          limit: a.limit,
          utilization: a.limit ? Math.round((Math.abs(a.current ?? 0) / a.limit) * 100) : null,
        })),
        overBudgetCategories: overBudget,
        upcomingBills,
        recentLargeSpends: transactions.filter(t => t.amount > 50).slice(0, 5),
      },
      mcat: {
        studySessionsThisWeek: recentStudy.length,
        studyMinutesThisWeek: studyTimerThisWeek,
        testDate: data.mcatTestDate,
        daysSinceLastSession: (() => {
          const all = [...(data.studySessions ?? []), ...(data.studyTimerLogs ?? [])]
            .map(s => s.date).sort().reverse();
          if (!all.length) return null;
          const last = new Date(all[0]);
          return Math.floor((Date.now() - last.getTime()) / 86400000);
        })(),
      },
      calendar: {
        todayEvents: calendarEvents,
      },
      email: {
        unreadCount: emails.length,
        importantEmails: emails.slice(0, 5),
      },
    };

    const systemPrompt = `You are Aya's personal AI assistant delivering her morning briefing via SMS. Aya is a pre-med student working toward medical school (Meharry), doing 75 Hard, managing her finances carefully, and building a disciplined life.

Your job: write a concise, warm, intelligent morning briefing that feels like it came from someone who KNOWS her life — not a generic bot.

Format rules:
- Start with "Good morning Aya - Day [X] of 75 Hard"
- Use plain text only — NO emojis, no markdown, no asterisks, no bullet symbols — this is a plain SMS
- Use line breaks to separate sections
- Be specific — use actual numbers, actual names, actual dates
- If something needs her attention, say so directly
- End with one sharp motivational line specific to where she is right now
- Keep it under 300 words total
- Sections: 75 Hard recap → Health → Money → MCAT → Calendar → Emails → Closing

Tone: warm, direct, like a brilliant friend who has full context on her life. Not corporate. Not generic.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const rawBriefing = msg.content[0].type === "text" ? msg.content[0].text : "Good morning Aya! Your morning briefing had a hiccup — check your dashboard.";
    // Strip emojis/symbols so SMS gateway renders cleanly
    // eslint-disable-next-line no-control-regex
    const briefing = rawBriefing.replace(/[^\x00-\x7F]/g, "").replace(/\s{2,}/g, " ").trim();

    // Send via T-Mobile gateway
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const phone = process.env.USER_PHONE_NUMBER ?? "6156811609";

    if (gmailUser && gmailPass) {
      const digits = phone.replace(/\D/g, "").replace(/^1/, "");
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } });
      await transporter.sendMail({
        from: gmailUser,
        to: `${digits}@tmomail.net`,
        subject: " ",
        text: briefing,
      });
    }

    // Save briefing to SMS log
    const sms = data.sms ?? { phoneNumber: phone, enabled: true, messages: [], reminders: [] };
    sms.messages = [...(sms.messages ?? []), {
      id: `briefing-${Date.now()}`,
      direction: "outbound" as const,
      body: briefing,
      timestamp: new Date().toISOString(),
    }];
    data.sms = sms;

    const { saveData } = await import("@/lib/db");
    await saveData(data);

    return NextResponse.json({ success: true, briefing });
  } catch (e) {
    console.error("Morning briefing error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
