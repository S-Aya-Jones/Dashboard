import { NextRequest, NextResponse } from "next/server";
import { getReminders, createReminder } from "@/lib/telegram";

export async function GET() {
  const reminders = await getReminders();
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, body: msgBody, scheduleType, timeOfDay, daysOfWeek, nextRunAt } = body;
  if (!title || !scheduleType || !timeOfDay) {
    return NextResponse.json({ error: "title, scheduleType, and timeOfDay are required" }, { status: 400 });
  }
  const reminder = await createReminder({
    title,
    body:         msgBody ?? undefined,
    scheduleType,
    timeOfDay,
    daysOfWeek:   daysOfWeek ?? undefined,
    nextRunAt:    nextRunAt ?? undefined,
    active:       true,
  });
  return NextResponse.json(reminder, { status: 201 });
}
