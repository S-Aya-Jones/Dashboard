// All dashboard data lives in one JSON blob per user
// Add new features by extending this interface — no schema migrations needed

export interface Task {
  id: string;
  text: string;
  done: boolean;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  section: "daily" | "devotional";
  weeklyGoal: number; // 1–7
  order: number;
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
  done: boolean;
}

export interface AnxietyCheckIn {
  date: string;
  level: number; // 1–10
  note?: string;
}

export interface ExposureEntry {
  id: string;
  date: string;
  description: string;
  anxietyBefore: number;
  peakAnxiety: number;
  anxietyAfter: number;
  durationMinutes: number;
  notes?: string;
  type: "general" | "driving";
}

export interface DrivingLog {
  id: string;
  date: string;
  route: string;
  distanceMiles?: number;
  anxietyBefore: number;
  anxietyAfter: number;
  notes?: string;
}

export interface StudySession {
  id: string;
  date: string;
  cars: number;
  bioBiochem: number;
  chemPhys: number;
  psychSoc: number;
}

export interface PracticeTest {
  id: string;
  date: string;
  total: number;
  cars?: number;
  bioBiochem?: number;
  chemPhys?: number;
  psychSoc?: number;
  notes?: string;
}

export interface MCATResource {
  id: string;
  name: string;
  completionPercent: number;
  notes?: string;
}

export interface ClassEntry {
  id: string;
  name: string;
  day: string;
  time: string;
  location: string;
  notes?: string;
}

export interface Milestone {
  id: string;
  title: string;
  deadline?: string;
  done: boolean;
  category: "meharry" | "application" | "personal";
  notes?: string;
}

export interface LetterOfRec {
  id: string;
  recommender: string;
  institution: string;
  status: "not asked" | "asked" | "confirmed" | "submitted";
  dateSent?: string;
  notes?: string;
}

export interface ShadowingSession {
  id: string;
  date: string;
  location: string;
  physician: string;
  specialty: string;
  hours: number;
  notes?: string;
}

export interface FitnessSession {
  id: string;
  date: string;
  type: "gym" | "tennis" | "walk" | "other";
  durationMinutes: number;
  notes?: string;
}

export interface SleepLog {
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: number; // 1–5
  notes?: string;
}

export interface SkincareProduct {
  id: string;
  name: string;
  brand?: string;
  routine: "am" | "pm" | "both";
  order: number;
  isTesting: boolean;
  startDate?: string;
  notes?: string;
}

export interface SkinCheckIn {
  id: string;
  date: string;
  breakouts: boolean;
  observations: string;
  changes?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  targetPayoff?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  current: number;
  target: number;
  deadline?: string;
}

export interface MonthlyFinance {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  notes?: string;
}

export interface ConnectionLog {
  id: string;
  date: string;
  person: string;
  relationship: string; // friend, family, nephew, etc.
  activity: string;
  notes?: string;
}

export interface WinEntry {
  id: string;
  date: string;
  text: string;
}

export interface Goal {
  id: string;
  text: string;
  category: "medical-school" | "health-mental" | "career" | "personal" | "financial" | "spiritual";
  timeframe: "quarterly" | "yearly";
  quarter?: string; // Q1-2025, etc.
  year?: string;
  done: boolean;
  notes?: string;
}

export interface BookEntry {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  startDate?: string;
  finishedDate?: string;
  status: "reading" | "finished" | "want-to-read";
  type: "book" | "devotional";
  notes?: string;
  rating?: number;
}

export interface VisionItem {
  id: string;
  type: "url" | "upload";
  src: string;
  caption?: string;
  category?: string;
  addedAt: string;
}

export interface YearReflection {
  year: string;
  vision: string;
  nonNegotiables: string;
  focus: string;
  whatToChange: string;
  theme: string;
  buckets: { title: string; description: string }[];
}

export interface WeeklyIntention {
  weekStart: string; // YYYY-MM-DD (Monday)
  intention: string;
  focus: string;
}

export interface DashboardData {
  userId: string;
  updatedAt: string;

  // Today
  anxietyCheckIns: AnxietyCheckIn[];
  tasks: Task[];
  exposureLog: ExposureEntry[];
  drivingLog: DrivingLog[];

  // Habits
  habits: Habit[];
  habitLogs: HabitLog[];

  // Weekly
  weeklyIntentions: WeeklyIntention[];

  // MCAT
  studySessions: StudySession[];
  practiceTests: PracticeTest[];
  mcatResources: MCATResource[];
  mcatTestDate?: string;

  // School
  classes: ClassEntry[];
  milestones: Milestone[];
  lettersOfRec: LetterOfRec[];

  // Shadowing
  shadowingSessions: ShadowingSession[];

  // Fitness
  fitnessSessions: FitnessSession[];
  sleepLogs: SleepLog[];

  // Skincare
  skincareProducts: SkincareProduct[];
  skinCheckIns: SkinCheckIn[];

  // Finances
  creditCards: CreditCard[];
  savingsGoals: SavingsGoal[];
  monthlyFinances: MonthlyFinance[];

  // Connections
  connectionLogs: ConnectionLog[];

  // Wins
  wins: WinEntry[];

  // Goals
  goals: Goal[];

  // Books
  books: BookEntry[];

  // Year
  yearReflections: YearReflection[];

  // Vision Board
  visionBoard?: { items: VisionItem[] };
}

export const defaultDashboardData = (): DashboardData => ({
  userId: "aya",
  updatedAt: new Date().toISOString(),
  anxietyCheckIns: [],
  tasks: [],
  exposureLog: [],
  drivingLog: [],
  habits: [
    { id: "h1", name: "Morning Prayer", icon: "🙏", color: "#d68d84", section: "devotional", weeklyGoal: 7, order: 0 },
    { id: "h2", name: "Bible Study", icon: "📖", color: "#c47a5e", section: "devotional", weeklyGoal: 5, order: 1 },
    { id: "h3", name: "Morning Walk", icon: "🚶🏾‍♀️", color: "#7a816c", section: "daily", weeklyGoal: 5, order: 2 },
    { id: "h4", name: "Skincare AM", icon: "✨", color: "#866a5b", section: "daily", weeklyGoal: 7, order: 3 },
    { id: "h5", name: "Skincare PM", icon: "🌙", color: "#785b4e", section: "daily", weeklyGoal: 7, order: 4 },
    { id: "h6", name: "Study / MCAT", icon: "📚", color: "#8e967d", section: "daily", weeklyGoal: 5, order: 5 },
    { id: "h7", name: "Drink Water", icon: "💧", color: "#cfbb9f", section: "daily", weeklyGoal: 7, order: 6 },
    { id: "h8", name: "No Phone First Hour", icon: "📵", color: "#c98a86", section: "daily", weeklyGoal: 5, order: 7 },
  ],
  habitLogs: [],
  weeklyIntentions: [],
  studySessions: [],
  practiceTests: [],
  mcatResources: [
    { id: "r1", name: "UWorld MCAT", completionPercent: 0 },
    { id: "r2", name: "AAMC Official Materials", completionPercent: 0 },
    { id: "r3", name: "Anki Decks", completionPercent: 0 },
    { id: "r4", name: "Khan Academy", completionPercent: 0 },
  ],
  classes: [],
  milestones: [
    { id: "m1", title: "Meharry MHS Application Opens", deadline: "", done: false, category: "meharry" },
    { id: "m2", title: "Personal Statement Draft 1", deadline: "", done: false, category: "application" },
    { id: "m3", title: "Request Letters of Rec", deadline: "", done: false, category: "application" },
  ],
  lettersOfRec: [],
  shadowingSessions: [],
  fitnessSessions: [],
  sleepLogs: [],
  skincareProducts: [
    { id: "sp1", name: "Gentle Cleanser", routine: "am", order: 0, isTesting: false },
    { id: "sp2", name: "Vitamin C Serum", routine: "am", order: 1, isTesting: false },
    { id: "sp3", name: "SPF 50 Moisturizer", routine: "am", order: 2, isTesting: false },
    { id: "sp4", name: "Oil Cleanser", routine: "pm", order: 0, isTesting: false },
    { id: "sp5", name: "Gentle Cleanser", routine: "pm", order: 1, isTesting: false },
    { id: "sp6", name: "Retinol / Retinoid", routine: "pm", order: 2, isTesting: true, startDate: "" },
    { id: "sp7", name: "PM Moisturizer", routine: "pm", order: 3, isTesting: false },
  ],
  skinCheckIns: [],
  creditCards: [],
  savingsGoals: [],
  monthlyFinances: [],
  connectionLogs: [],
  wins: [],
  goals: [],
  books: [],
  yearReflections: [],
  visionBoard: { items: [] },
});
