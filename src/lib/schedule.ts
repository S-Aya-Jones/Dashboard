import { Briefcase, Footprints, Brain, Flame, Utensils, Moon, Sparkles, Circle, LucideIcon } from "lucide-react";
import { ScheduleBlock } from "@/types/dashboard";
import { id } from "@/lib/utils";

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const OFFICE_DAYS = [1, 2, 4, 5]; // commute days
const WFH_DAY = [3]; // Wednesday — no commute, no treadmill

export const TYPE_META: Record<ScheduleBlock["type"], { color: string; label: string }> = {
  work:     { color: "#7C5CFC", label: "Work" },
  walk:     { color: "#10B981", label: "Walk" },
  mcat:     { color: "#A78BFA", label: "MCAT" },
  exposure: { color: "#F59E0B", label: "Exposure" },
  meal:     { color: "#FB923C", label: "Meal" },
  sleep:    { color: "#38BDF8", label: "Sleep" },
  personal: { color: "#F472B6", label: "Personal" },
  other:    { color: "#94A3B8", label: "Other" },
};

export const TYPE_ICON: Record<ScheduleBlock["type"], LucideIcon> = {
  work:     Briefcase,
  walk:     Footprints,
  mcat:     Brain,
  exposure: Flame,
  meal:     Utensils,
  sleep:    Moon,
  personal: Sparkles,
  other:    Circle,
};

export function defaultBlocks(): ScheduleBlock[] {
  return [
    // ── Office days (Mon, Tue, Thu, Fri) — 15 min commute each way ──
    { id: id(), label: "Commute to work",       startTime: "06:45", endTime: "07:00", days: OFFICE_DAYS, type: "other" },
    { id: id(), label: "Treadmill walk (lunch)", startTime: "11:00", endTime: "12:00", days: OFFICE_DAYS, type: "walk", notes: "Office treadmill — caps at 2.0mph" },
    { id: id(), label: "Commute home",          startTime: "14:30", endTime: "14:45", days: OFFICE_DAYS, type: "other" },
    { id: id(), label: "Buffer / breathing room", startTime: "14:45", endTime: "15:00", days: OFFICE_DAYS, type: "personal" },
    { id: id(), label: "Decompress walk",       startTime: "15:00", endTime: "15:45", days: OFFICE_DAYS, type: "walk" },
    { id: id(), label: "MCAT study block",      startTime: "15:45", endTime: "17:45", days: OFFICE_DAYS, type: "mcat" },
    { id: id(), label: "Exposure therapy",      startTime: "17:45", endTime: "18:15", days: OFFICE_DAYS, type: "exposure" },
    { id: id(), label: "Evening walk / steps",  startTime: "18:15", endTime: "19:00", days: OFFICE_DAYS, type: "walk" },
    { id: id(), label: "Dinner",                startTime: "19:00", endTime: "19:30", days: OFFICE_DAYS, type: "meal" },
    { id: id(), label: "MCAT study block 2",    startTime: "19:30", endTime: "21:30", days: OFFICE_DAYS, type: "mcat" },
    { id: id(), label: "Wind down",             startTime: "21:30", endTime: "22:00", days: OFFICE_DAYS, type: "personal", notes: "Progress photo, journal, prep tomorrow" },

    // ── WFH day (Wednesday) — no commute, no treadmill, therapy at lunch ──
    { id: id(), label: "Therapy session",       startTime: "12:00", endTime: "13:00", days: WFH_DAY, type: "personal", notes: "Weekly therapy appointment" },
    { id: id(), label: "Buffer / breathing room", startTime: "14:30", endTime: "14:45", days: WFH_DAY, type: "personal" },
    { id: id(), label: "Decompress walk",       startTime: "14:45", endTime: "15:30", days: WFH_DAY, type: "walk" },
    { id: id(), label: "MCAT study block",      startTime: "15:30", endTime: "17:30", days: WFH_DAY, type: "mcat" },
    { id: id(), label: "Exposure therapy",      startTime: "17:30", endTime: "18:00", days: WFH_DAY, type: "exposure", notes: "Keep light — therapy day" },
    { id: id(), label: "Evening walk / steps",  startTime: "18:00", endTime: "18:45", days: WFH_DAY, type: "walk" },
    { id: id(), label: "Dinner",                startTime: "19:00", endTime: "19:30", days: WFH_DAY, type: "meal" },
    { id: id(), label: "MCAT study block 2",    startTime: "19:30", endTime: "21:30", days: WFH_DAY, type: "mcat" },
    { id: id(), label: "Wind down",             startTime: "21:30", endTime: "22:00", days: WFH_DAY, type: "personal", notes: "Progress photo, journal, prep tomorrow" },

    // ── Work block, all weekdays (office or home) ──
    { id: id(), label: "Work",                  startTime: "07:00", endTime: "14:30", days: WEEKDAYS, type: "work" },

    // ── Sleep — fixed 8 hours every night ──
    { id: id(), label: "Sleep",                 startTime: "22:00", endTime: "06:00", days: [0,1,2,3,4,5,6], type: "sleep" },

    // ── Weekend ──
    { id: id(), label: "Long walk",             startTime: "09:00", endTime: "10:30", days: [0,6], type: "walk" },
    { id: id(), label: "Buffer / breathing room", startTime: "10:30", endTime: "10:45", days: [0,6], type: "personal" },
    { id: id(), label: "Weekend MCAT block",    startTime: "10:45", endTime: "12:45", days: [0,6], type: "mcat" },
    { id: id(), label: "Meal prep & groceries", startTime: "13:00", endTime: "14:30", days: [0], type: "meal", notes: "Prep lunches/dinners for the week ahead" },
    { id: id(), label: "Afternoon walk",        startTime: "16:00", endTime: "17:00", days: [0,6], type: "walk" },
    { id: id(), label: "Exposure therapy",      startTime: "17:30", endTime: "18:00", days: [0,6], type: "exposure" },
    { id: id(), label: "Dinner",                startTime: "19:00", endTime: "19:30", days: [0,6], type: "meal" },
    { id: id(), label: "Weekend MCAT block 2",  startTime: "19:30", endTime: "21:00", days: [0,6], type: "mcat" },
    { id: id(), label: "Wind down",             startTime: "21:30", endTime: "22:00", days: [0,6], type: "personal", notes: "Progress photo, journal, prep tomorrow" },
  ];
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export function formatRange12(start: string, end: string) {
  return `${formatTime12(start)}–${formatTime12(end)}`;
}

export function blocksForDate(blocks: ScheduleBlock[], date: Date) {
  const dow = date.getDay();
  return blocks.filter(b => b.days.includes(dow)).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}
