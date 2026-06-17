import { ScheduleBlock } from "@/types/dashboard";
import { id } from "@/lib/utils";

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

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

export function defaultBlocks(): ScheduleBlock[] {
  return [
    { id: id(), label: "Work",                 startTime: "07:00", endTime: "14:30", days: WEEKDAYS, type: "work" },
    { id: id(), label: "Walking lunch break",   startTime: "12:00", endTime: "13:00", days: WEEKDAYS, type: "walk", notes: "Step break during work" },
    { id: id(), label: "Decompress walk",       startTime: "14:30", endTime: "15:15", days: WEEKDAYS, type: "walk" },
    { id: id(), label: "MCAT study block",      startTime: "15:15", endTime: "16:45", days: WEEKDAYS, type: "mcat" },
    { id: id(), label: "Exposure therapy",      startTime: "16:45", endTime: "17:15", days: WEEKDAYS, type: "exposure" },
    { id: id(), label: "Evening walk / steps",  startTime: "17:15", endTime: "17:45", days: WEEKDAYS, type: "walk" },
    { id: id(), label: "Dinner",                startTime: "18:00", endTime: "18:45", days: [0,1,2,3,4,5,6], type: "meal" },
    { id: id(), label: "MCAT study block 2",    startTime: "19:00", endTime: "20:30", days: WEEKDAYS, type: "mcat" },
    { id: id(), label: "Wind down",             startTime: "20:30", endTime: "21:30", days: [0,1,2,3,4,5,6], type: "personal", notes: "Progress photo, journal, prep tomorrow" },
    { id: id(), label: "Sleep",                 startTime: "22:30", endTime: "06:30", days: [0,1,2,3,4,5,6], type: "sleep" },
    { id: id(), label: "Weekend MCAT block",    startTime: "10:00", endTime: "12:00", days: [0,6], type: "mcat" },
    { id: id(), label: "Long walk",             startTime: "09:00", endTime: "10:00", days: [0,6], type: "walk" },
  ];
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function blocksForDate(blocks: ScheduleBlock[], date: Date) {
  const dow = date.getDay();
  return blocks.filter(b => b.days.includes(dow)).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}
