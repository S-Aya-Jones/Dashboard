import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadData, saveData } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Ask Claude to interpret the message and extract structured data
  const systemPrompt = `You are Aya's personal dashboard assistant. She texts you natural language updates about her day — workouts, weight, sleep, steps, habits, notes, mood, food, etc.

Extract everything you can from her message and return a JSON object. Be smart — "just crushed legs" means workout done, "woke up at 7" means sleep data, "143 this morning" means weight, etc.

Today's date: ${today}

Return ONLY valid JSON with these optional fields (only include fields you can extract):
{
  "reply": "<warm, motivating 1-2 sentence response acknowledging what she shared>",
  "weight": <number in lbs, null if not mentioned>,
  "steps": <number, null if not mentioned>,
  "workout": {
    "completed": <true/false>,
    "type": "<gym|walk|tennis|other>",
    "notes": "<what she said about the workout>"
  },
  "sleep": {
    "bedtime": "<HH:MM 24h format, null if unknown>",
    "wakeTime": "<HH:MM 24h format, null if unknown>",
    "quality": <1-5, estimate from context if she says good/bad/tired>,
    "notes": "<sleep notes>"
  },
  "note": "<any general note or update worth saving>",
  "mood": "<one word: great/good/okay/tired/stressed>"
}`;

  let parsed: Record<string, unknown> = {};
  let reply = "Got it! ✓";

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    reply = (parsed.reply as string) ?? reply;
  } catch {
    reply = "Got it! I had trouble parsing the details but I saved your message.";
  }

  // Update dashboard with extracted data
  try {
    const data = await loadData();

    // Weight
    if (typeof parsed.weight === "number" && parsed.weight > 0) {
      const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      wd.bodyWeight = [...(wd.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight: parsed.weight as number }];
      data.workout = wd;
    }

    // Steps
    if (typeof parsed.steps === "number" && parsed.steps > 0) {
      const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      wd.walkingLogs = [...(wd.walkingLogs ?? []).filter(l => l.date !== today), { date: today, steps: parsed.steps as number }];
      data.workout = wd;
    }

    // Workout session
    const wo = parsed.workout as Record<string, unknown> | undefined;
    if (wo?.completed) {
      const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
      const newSession = {
        id: `session-${Date.now()}`,
        date: today,
        type: (wo.type as string) ?? "gym",
        durationMinutes: 60,
        notes: (wo.notes as string) ?? message,
        completed: true,
      };
      wd.sessionLogs = [...(wd.sessionLogs ?? []), newSession];
      data.workout = wd;
    }

    // Sleep
    const sl = parsed.sleep as Record<string, unknown> | undefined;
    if (sl && (sl.bedtime || sl.wakeTime || sl.quality)) {
      const sleepLog = {
        date: today,
        bedtime: (sl.bedtime as string) ?? "23:00",
        wakeTime: (sl.wakeTime as string) ?? "07:00",
        quality: (sl.quality as number) ?? 3,
        notes: (sl.notes as string) ?? undefined,
      };
      const existing = data.fitnessSleepLogs ?? data.sleepLogs ?? [];
      const filtered = existing.filter((s: { date: string }) => s.date !== today);
      if ("fitnessSleepLogs" in data) {
        (data as Record<string, unknown>).fitnessSleepLogs = [...filtered, sleepLog];
      } else {
        (data as Record<string, unknown>).sleepLogs = [...filtered, sleepLog];
      }
    }

    // Store message in SMS log
    const sms = data.sms ?? { phoneNumber: "siri", enabled: true, messages: [], reminders: [] };
    sms.messages = [
      ...(sms.messages ?? []),
      {
        id: `sms-in-${Date.now()}`,
        direction: "inbound" as const,
        body: message,
        timestamp: now,
        parsedAction: Object.keys(parsed).filter(k => k !== "reply" && k !== "mood").join(", ") || undefined,
      },
      {
        id: `sms-out-${Date.now()}`,
        direction: "outbound" as const,
        body: reply,
        timestamp: now,
      },
    ];
    data.sms = sms;

    await saveData(data);
  } catch { /* non-fatal — still return reply */ }

  return NextResponse.json({ reply, parsed });
}
