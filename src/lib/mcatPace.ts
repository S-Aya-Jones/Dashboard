import { DashboardData } from "@/types/dashboard";
import { differenceInCalendarDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";

// AAMC + most prep companies (Blueprint, Kaplan) recommend 300-350 total
// content-review + practice hours for a competitive score from a standing start.
const RECOMMENDED_TOTAL_HOURS = 330;
// Most guides cap sustainable weekly study load around 20-25hrs/week to avoid burnout.
const MAX_SUSTAINABLE_WEEKLY_HOURS = 25;

export interface McatPace {
  testDate: string | null;
  daysRemaining: number | null;
  weeksRemaining: number | null;
  totalRecommendedHours: number;
  hoursLoggedTotal: number;
  hoursRemaining: number;
  weeklyHourTarget: number | null;
  hoursLoggedThisWeek: number;
  onTrack: boolean | null;
  status: "no-date" | "behind" | "on-track" | "ahead" | "test-passed";
}

function hoursFromStudySessions(data: DashboardData) {
  return data.studySessions.reduce((s, sess) => s + sess.cars + sess.bioBiochem + sess.chemPhys + sess.psychSoc, 0);
}

function hoursFromTimerLogs(data: DashboardData) {
  return (data.studyTimerLogs ?? []).reduce((s, l) => s + l.durationSeconds, 0) / 3600;
}

export function computeMcatPace(data: DashboardData): McatPace {
  const hoursLoggedTotal = Math.round((hoursFromStudySessions(data) + hoursFromTimerLogs(data)) * 10) / 10;
  const hoursRemaining = Math.max(0, RECOMMENDED_TOTAL_HOURS - hoursLoggedTotal);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const sessionHoursThisWeek = data.studySessions
    .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
    .reduce((s, sess) => s + sess.cars + sess.bioBiochem + sess.chemPhys + sess.psychSoc, 0);
  const timerHoursThisWeek = (data.studyTimerLogs ?? [])
    .filter(l => isWithinInterval(parseISO(l.date), { start: weekStart, end: weekEnd }))
    .reduce((s, l) => s + l.durationSeconds, 0) / 3600;
  const hoursLoggedThisWeek = Math.round((sessionHoursThisWeek + timerHoursThisWeek) * 10) / 10;

  if (!data.mcatTestDate) {
    return {
      testDate: null, daysRemaining: null, weeksRemaining: null,
      totalRecommendedHours: RECOMMENDED_TOTAL_HOURS, hoursLoggedTotal, hoursRemaining,
      weeklyHourTarget: null, hoursLoggedThisWeek, onTrack: null, status: "no-date",
    };
  }

  const daysRemaining = differenceInCalendarDays(parseISO(data.mcatTestDate), new Date());

  if (daysRemaining <= 0) {
    return {
      testDate: data.mcatTestDate, daysRemaining, weeksRemaining: 0,
      totalRecommendedHours: RECOMMENDED_TOTAL_HOURS, hoursLoggedTotal, hoursRemaining,
      weeklyHourTarget: null, hoursLoggedThisWeek, onTrack: null, status: "test-passed",
    };
  }

  const weeksRemaining = Math.max(1, Math.round((daysRemaining / 7) * 10) / 10);
  const rawWeeklyTarget = hoursRemaining / weeksRemaining;
  const weeklyHourTarget = Math.round(Math.min(rawWeeklyTarget, MAX_SUSTAINABLE_WEEKLY_HOURS) * 10) / 10;

  const onTrack = hoursLoggedThisWeek >= weeklyHourTarget * 0.85;
  const status: McatPace["status"] = rawWeeklyTarget > MAX_SUSTAINABLE_WEEKLY_HOURS ? "behind" : onTrack ? "on-track" : hoursLoggedThisWeek > weeklyHourTarget ? "ahead" : "behind";

  return {
    testDate: data.mcatTestDate, daysRemaining, weeksRemaining,
    totalRecommendedHours: RECOMMENDED_TOTAL_HOURS, hoursLoggedTotal, hoursRemaining,
    weeklyHourTarget, hoursLoggedThisWeek, onTrack, status,
  };
}
