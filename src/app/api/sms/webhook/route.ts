import { NextRequest, NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { SmsMessage } from "@/types/dashboard";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = (form.get("From") as string ?? "").trim();
  const raw  = (form.get("Body")  as string ?? "").trim();
  const body = raw.toLowerCase().replace(/[!?.]+$/, "").trim();

  let reply  = "Got it! ✓";
  let action = "";

  // Parse intent
  if (body === "done" || body === "workout done" || body === "finished" || body === "complete" || body === "completed") {
    action = "Workout marked complete";
    reply  = "Workout logged! You showed up and that's the whole game. 🔥 Keep that streak going.";
  } else if (body === "skip" || body === "rest" || body === "rest day") {
    action = "Rest day logged";
    reply  = "Rest day noted. Recovery is part of the program. See you next session. 💤";
  } else if (/(\d+\.?\d*)\s*lbs?$/.test(body) || /^weight\s+(\d+\.?\d*)/.test(body) || /^(\d+\.?\d*)\s*pounds?/.test(body)) {
    const match = body.match(/(\d+\.?\d*)/);
    if (match) {
      const w = parseFloat(match[1]);
      action = `Body weight logged: ${w} lbs`;
      reply  = `Weight logged: ${w} lbs 📊 Progress is progress — keep going!`;
      // Update body weight in dashboard
      try {
        const data = await loadData();
        const today = new Date().toISOString().slice(0, 10);
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.bodyWeight = [...(wd.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight: w }];
        data.workout = wd;
        await saveData(data);
      } catch { /* non-fatal */ }
    }
  } else if (/(\d{3,6})\s*steps?/.test(body) || /^steps?\s+(\d{3,6})/.test(body)) {
    const match = body.match(/(\d{3,6})/);
    if (match) {
      const steps = parseInt(match[1]);
      action = `Steps logged: ${steps.toLocaleString()}`;
      reply  = `${steps.toLocaleString()} steps logged! ${steps >= 10000 ? "10k+ — you crushed it! 🏆" : steps >= 8000 ? "Goal hit! 🎯" : "Keep moving — you've got this!"}`;
      try {
        const data = await loadData();
        const today = new Date().toISOString().slice(0, 10);
        const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
        wd.walkingLogs = [...(wd.walkingLogs ?? []).filter(l => l.date !== today), { date: today, steps }];
        data.workout = wd;
        await saveData(data);
      } catch { /* non-fatal */ }
    }
  } else if (body === "help" || body === "commands" || body === "?") {
    reply = "📋 Commands:\n• DONE — log workout complete\n• SKIP — log rest day\n• 130lbs — log body weight\n• 8500 steps — log steps\n• HELP — show this menu";
    action = "Help requested";
  } else if (body === "yes" || body === "yep" || body === "yeah" || body === "yup") {
    reply  = "Let's go! 💪 Message me DONE when you finish.";
    action = "Acknowledged";
  } else {
    reply = `Got your message! 👋 Reply HELP to see what I can track for you.`;
  }

  // Store incoming message
  try {
    const data = await loadData();
    const inbound: SmsMessage = {
      id: `sms-${Date.now()}`,
      direction: "inbound",
      body: raw,
      timestamp: new Date().toISOString(),
      parsedAction: action || undefined,
    };
    const sms = data.sms ?? { phoneNumber: from, enabled: true, messages: [], reminders: [] };
    sms.messages = [...(sms.messages ?? []), inbound];
    data.sms = sms;
    await saveData(data);
  } catch { /* non-fatal */ }

  // TwiML response
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
