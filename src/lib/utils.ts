import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";

export const today = () => format(new Date(), "yyyy-MM-dd");

export const formatDate = (date: string | Date, fmt = "MMMM d, yyyy") => {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
};

export const weekDays = (weekStart: Date) =>
  eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

export const getWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

export const nextWeek = (date: Date) => addWeeks(date, 1);
export const prevWeek = (date: Date) => subWeeks(date, 1);

export const id = () => Math.random().toString(36).slice(2, 10);

export const greetingByTime = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export const dayName = (date: string) => format(parseISO(date), "EEE");

export const toDateInput = (date: string) => date; // already YYYY-MM-DD

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
