import { DashboardData } from "@/types/dashboard";
import { differenceInCalendarDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, format, addDays } from "date-fns";

export interface RoadmapPhase {
  id: 1 | 2 | 3;
  name: string;
  weekRange: string;
  focus: string;
  actions: string[];
}

// Based on the standard 19.5-week high-yield-target plan: content+Anki first,
// then UWorld-centric practice, then AAMC official material + full lengths
// in the final stretch — practice and review beat passive content review.
export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    id: 1,
    name: "Content + Anki",
    weekRange: "Weeks 1–8",
    focus: "Stop the bleeding on content gaps",
    actions: [
      "Work through content once (Kaplan books or Khan Academy)",
      "Anki every single day — Pankow P/S deck + AnKing/MileDown science deck",
      "1–2 CARS passages daily (Jack Westin)",
      "Light passage practice only — save UWorld depth for phase 2",
    ],
  },
  {
    id: 2,
    name: "Practice-Heavy (UWorld)",
    weekRange: "Weeks 9–15",
    focus: "Learn to apply content under passage pressure",
    actions: [
      "UWorld becomes the center of gravity — passages daily",
      "Review every miss to the root cause, not just the right answer",
      "Anki continues daily",
      "CARS continues daily",
    ],
  },
  {
    id: 3,
    name: "AAMC + Full Lengths",
    weekRange: "Weeks 16–19.5",
    focus: "Calibrate against the real test-makers' material",
    actions: [
      "Burn through AAMC Section Banks, Question Packs, Full-Lengths 1–4",
      "Weekly full-length under real timing (Sat 7:30am, simulate everything)",
      "Review every FL obsessively",
      "Final two weeks: remaining AAMC FLs + the Sample test",
    ],
  },
];

function computeStreak(dates: Set<string>): number {
  let streak = 0;
  let cur = new Date();
  let dayIndex = 0;
  while (dayIndex <= 365) {
    const ds = format(cur, "yyyy-MM-dd");
    if (dates.has(ds)) {
      streak++;
    } else if (dayIndex !== 0) {
      // missing day breaks the streak, unless it's just today not logged yet
      break;
    }
    cur = addDays(cur, -1);
    dayIndex++;
  }
  return streak;
}

export interface RoadmapData {
  testDate: string | null;
  daysRemaining: number | null;
  weeksRemaining: number | null;
  phase: RoadmapPhase | null;
  weeklyHourTarget: number | null;
  hoursLoggedThisWeek: number;
  ankiStreak: number;
  carsStreak: number;
  uworldPassagesTotal: number;
  uworldAvgPercent: number | null;
  aamcFlScores: { date: string; total: number }[];
  aamcFlTrend: number | null; // avg of last 3
}

export function computeRoadmap(data: DashboardData): RoadmapData {
  const logs = data.mcatDailyLogs ?? [];
  const ankiDates = new Set(logs.filter(l => l.ankiDone).map(l => l.date));
  const carsDates = new Set(logs.filter(l => l.carsDone).map(l => l.date));
  const uworldPassagesTotal = logs.reduce((s, l) => s + (l.uworldPassages ?? 0), 0);
  const withUworld = logs.filter(l => l.uworldPercent !== undefined);
  const uworldAvgPercent = withUworld.length
    ? Math.round(withUworld.reduce((s, l) => s + (l.uworldPercent ?? 0), 0) / withUworld.length)
    : null;

  const aamcFlScores = (data.practiceTests ?? [])
    .filter(t => t.source === "aamc_fl" || t.source === "aamc_sample")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({ date: t.date, total: t.total }));
  const last3 = aamcFlScores.slice(-3);
  const aamcFlTrend = last3.length ? Math.round(last3.reduce((s, t) => s + t.total, 0) / last3.length) : null;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const sessionHours = data.studySessions
    .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
    .reduce((s, sess) => s + sess.cars + sess.bioBiochem + sess.chemPhys + sess.psychSoc, 0);
  const timerHours = (data.studyTimerLogs ?? [])
    .filter(l => isWithinInterval(parseISO(l.date), { start: weekStart, end: weekEnd }))
    .reduce((s, l) => s + l.durationSeconds, 0) / 3600;
  const hoursLoggedThisWeek = Math.round((sessionHours + timerHours) * 10) / 10;

  const ankiStreak = computeStreak(ankiDates);
  const carsStreak = computeStreak(carsDates);

  if (!data.mcatTestDate) {
    return {
      testDate: null, daysRemaining: null, weeksRemaining: null, phase: null, weeklyHourTarget: null,
      hoursLoggedThisWeek, ankiStreak, carsStreak, uworldPassagesTotal, uworldAvgPercent, aamcFlScores, aamcFlTrend,
    };
  }

  const daysRemaining = differenceInCalendarDays(parseISO(data.mcatTestDate), new Date());
  const weeksRemaining = Math.max(0, Math.round((daysRemaining / 7) * 10) / 10);
  const phase = weeksRemaining > 11.5 ? ROADMAP_PHASES[0] : weeksRemaining > 4.5 ? ROADMAP_PHASES[1] : ROADMAP_PHASES[2];
  const weeklyHourTarget = weeksRemaining <= 5 ? 32 : weeksRemaining <= 11.5 ? 28 : 25;

  return {
    testDate: data.mcatTestDate, daysRemaining, weeksRemaining, phase, weeklyHourTarget,
    hoursLoggedThisWeek, ankiStreak, carsStreak, uworldPassagesTotal, uworldAvgPercent, aamcFlScores, aamcFlTrend,
  };
}
