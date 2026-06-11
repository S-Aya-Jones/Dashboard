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

export interface BigMove {
  id: string;
  transactionId: string;
  status: "intentional" | "oops";
  note?: string;
  taggedAt: string;
}

export interface MerchantCategoryOverride {
  nameContains: string;
  category:     string;
}

export interface FinancesConfig {
  bigTicketThreshold:        number;
  watchListMerchants:        string[];
  bigMoves:                  BigMove[];
  recurringHidden:           string[];
  recurringFlagged:          string[];
  merchantCategoryOverrides: MerchantCategoryOverride[];
}

export interface MonthlyFinance {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  notes?: string;
}

export interface PaycheckConfig {
  takeHomePerCheck: number;
  savingsPercent: number;   // 0–100
  nextPayday: string;       // YYYY-MM-DD
  employer?: string;           // e.g. "HCA Healthcare"
  projectedTakeHome?: number;  // user's manually-set expected amount
}

export interface BudgetLine {
  id: string;
  label: string;
  amountPerCheck: number;
  category: "transfer" | "housing" | "food" | "transport" | "savings" | "utilities" | "other";
  toAccount?: string;  // e.g. "Bank of America"
  color?: string;
  isDetected?: boolean;
}

export interface BaseBudgetItem {
  id: string;
  category: string;
  emoji: string;
  monthlyLimit: number;
}

export interface BudgetPlanItem {
  id: string;
  category: string;
  emoji: string;
  plannedMonthly: number;
  notes?: string;
}

export interface BudgetPlan {
  id: string;
  name: string;
  createdAt: string;
  monthlyIncome: number;
  items: BudgetPlanItem[];
}

export interface CreditScoreEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  score: number;      // 300–850
  source: string;     // "Credit Karma", "Chase", "Experian", etc.
  notes?: string;
}

export interface SelfCareItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;             // cost per appointment
  frequencyWeeks: number;   // every N weeks
  frequencyLabel?: string;  // human-readable label e.g. "Monthly", "Quarterly"
  lastDone?: string;        // YYYY-MM-DD
  color?: string;
  priority?: number;        // 0 = highest priority; controls tie-breaking in scheduling
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;       // 1–31
  lastPaidDate?: string;    // YYYY-MM-DD — if >= current payday, bill is paid this period
}

export interface P2PTransfer {
  id: string;
  date: string;             // YYYY-MM-DD
  person: string;
  amount: number;
  direction: "sent" | "received";
  platform: "zelle" | "venmo" | "cashapp" | "cash" | "other";
  note?: string;
}

export interface AccountTransfer {
  id: string;
  date: string;             // YYYY-MM-DD
  fromAccount: string;
  toAccount: string;
  amount: number;
  purpose?: string;         // e.g. "savings", "self-care fund"
}

export interface SinkingFund {
  id: string;
  name: string;
  targetAmount: number;    // total cost of the thing
  frequencyMonths: number; // 3 = quarterly, 6 = semi-annual, 12 = yearly
  saved: number;           // amount saved so far
  color?: string;
  notes?: string;
}

export interface AffordGoal {
  id: string;
  name: string;
  price: number;
  savedSoFar: number;
  createdAt: string;
}

export interface BudgetCategory {
  category: string; // Plaid category key e.g. FOOD_AND_DRINK
  monthlyLimit: number;
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
  linkedPlaidAccountId?: string;
  plaidLinkStartBalance?: number;
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

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  photos: string[];
  rating: number; // 1–5
  tags: string[];
  notes?: string;
  createdAt: string;
  calories?: number;
  protein?: number; // grams
  aiDescription?: string;
}

export interface RecipeIngredient {
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  photos: string[];
  tags: string[];
  dietaryTags: string[];
  servings?: number;
  caloriesPerServing?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  rating?: number;
  createdAt: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  section: string;
  checked: boolean;
  addedAt: string;
  fromRecipeId?: string;
}

export interface PantryItem {
  id: string;
  name: string;
  inStock: boolean;
  updatedAt: string;
}

export interface ShetritionImage {
  id: string;
  src: string;
  caption?: string;
  addedAt: string;
}

export interface NutritionData {
  meals: MealEntry[];
  recipes: Recipe[];
  groceryItems: GroceryItem[];
  pantryItems: PantryItem[];
  shetritionImages: ShetritionImage[];
}

export interface HealthDailySnapshot {
  steps?: number;
  activeEnergy?: number; // kcal
  exerciseMinutes?: number;
  restingHR?: number; // bpm
  sleepHours?: number;
  weight?: number;
  mindfulMinutes?: number;
}

export interface HealthWorkout {
  id: string;
  type: string;
  startedAt: string; // ISO
  durationMin: number;
  calories?: number;
  distance?: number;
  source: "apple_health";
}

export interface HealthData {
  lastImportAt: string;
  daily: { [date: string]: HealthDailySnapshot };
  workouts: HealthWorkout[];
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

export interface SmsMessage {
  id: string;
  direction: "outbound" | "inbound";
  body: string;
  timestamp: string; // ISO
  parsedAction?: string; // human-readable description of what was parsed
}

export interface SmsReminder {
  id: string;
  label: string;
  message: string; // the text that gets sent
  time: string;    // "HH:MM" 24-hour
  enabled: boolean;
  days: number[];  // 0=Mon…6=Sun (empty = all days)
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface SmsData {
  phoneNumber: string;
  telegramChatId?: string;
  telegramBotUsername?: string;
  enabled: boolean;
  messages: SmsMessage[];
  reminders: SmsReminder[];
  pushSubscription?: PushSubscriptionData;
}

export interface MCATQuestion {
  id: string;
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  choices: { letter: string; text: string }[];
  correctLetter: string;
  explanation: string;
  createdAt: string;
  folder?: string;
}

export interface MCATQuizAttempt {
  questionId: string;
  selectedLetter: string | null;
  correct: boolean;
  flagged: boolean;
  timeSpentSeconds: number;
}

export interface MCATQuizSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  mode: "tutor" | "timed";
  timeLimitMinutes?: number;
  questionIds: string[];
  attempts: MCATQuizAttempt[];
  subjects: string[];
  topics: string[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject?: string;
  topic?: string;
  tags: string[];
  deck: string;
  createdAt: string;
  // Anki SM-2 / Miles Down compatible fields
  state: "new" | "learning" | "review" | "relearning";
  interval: number;       // days (review state) or ignored (learning state)
  easeFactor: number;     // default 2.5 (250%)
  repetitions: number;    // successful consecutive reviews
  lapses: number;         // times failed as a review card
  learningStep: number;   // current index in learning/relearning steps array
  nextReview: string;     // ISO timestamp for learning/relearning; YYYY-MM-DD for review
  lastReview?: string;    // ISO timestamp of last rating
}

export interface FlashcardReviewLog {
  cardId: string;
  date: string;
  rating: 0 | 1 | 2 | 3;  // Again=0, Hard=1, Good=2, Easy=3
  responseTimeMs: number;
}

export interface StudyTimerLog {
  id: string;
  date: string;           // YYYY-MM-DD
  subject: string;
  topic?: string;
  durationSeconds: number;
  startedAt: string;      // ISO
}

export interface DiagnosticSectionResult {
  name: string;
  questionIds: string[];
  attempts: MCATQuizAttempt[];
  timeLimitMinutes: number;
  startedAt?: string;
  completedAt?: string;
  scaledScore?: number;   // 118–132
}

export interface DiagnosticSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  sections: DiagnosticSectionResult[];
  totalScore?: number;    // 472–528
}

export interface BeautyAnalysisEntry {
  id: string;
  date: string;
  photoThumb: string;
  skinScore: number;
  overallRating: number;
  apparentAge: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any;
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
  mcatQuestions?: MCATQuestion[];
  mcatQuizSessions?: MCATQuizSession[];
  flashcards?: Flashcard[];
  flashcardReviews?: FlashcardReviewLog[];
  studyTimerLogs?: StudyTimerLog[];
  diagnosticSessions?: DiagnosticSession[];
  ankiSettings?: { newPerDay: number; reviewPerDay: number };
  ankiDailyCount?: { date: string; newSeen: number; reviewSeen: number };

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
  beautyAnalyses?: BeautyAnalysisEntry[];

  // Finances
  creditCards: CreditCard[];
  savingsGoals: SavingsGoal[];
  monthlyFinances: MonthlyFinance[];
  budgetCategories: BudgetCategory[];
  financesConfig: FinancesConfig;
  paycheckConfig?: PaycheckConfig;
  paycheckPlans?: Record<string, { overrides: Record<string, number>; savingsOverride?: number; incomeOverride?: number; oneTimeItems: { id: string; label: string; amount: number; category: string }[]; checkIns?: Record<string, { checkedAt: string; actualAmount?: number }> }>;
  selfCareItems?: SelfCareItem[];
  recurringBills?: RecurringBill[];
  budgetLines?: BudgetLine[];
  creditScores?: CreditScoreEntry[];
  p2pTransfers?: P2PTransfer[];
  accountTransfers?: AccountTransfer[];
  sinkingFunds?: SinkingFund[];
  affordGoals?: AffordGoal[];
  monthlyIncome?: number;
  baseBudget?: BaseBudgetItem[];
  budgetPlans?: BudgetPlan[];

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

  // Nutrition & Food Journal
  nutrition?: NutritionData;

  // Apple Health (via Health Auto Export)
  health?: HealthData;

  // Workout program
  workout?: WorkoutData;

  // SMS / Texting
  sms?: SmsData;

  // 75 Hard
  seventyFiveHard?: SeventyFiveHardData;
}

export interface SeventyFiveHardDayLog {
  date: string; // YYYY-MM-DD
  workout: boolean;
  steps: boolean;
  water: boolean; // 64oz
  mcat: boolean;  // 90 min
  progressPhoto: boolean;
  exposureTherapy: boolean;
  diet: boolean;
  notes?: string;
  failed?: boolean;
  progressPhotoUrl?: string;
  weightPhotoUrl?: string;
}

export interface SeventyFiveHardData {
  startDate: string; // YYYY-MM-DD (Thursday)
  currentDay: number; // 1-75
  active: boolean;
  completedAt?: string;
  logs: SeventyFiveHardDayLog[];
}

// ── Workout ────────────────────────────────────────────────────────────────

export interface WorkoutSetLog {
  weight: number; // lbs, 0 for bodyweight
  reps: number;
}

export interface ExerciseSessionLog {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetLog[];
}

export interface WorkoutSessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  programDayId: string;
  dayLabel: string;
  exercises: ExerciseSessionLog[];
  completedAt?: string; // ISO
}

export interface WalkingLog {
  date: string; // YYYY-MM-DD
  steps?: number;
  miles?: number;
}

export interface MeasurementEntry {
  date: string; // YYYY-MM-DD
  waist: number; // inches
  hips: number;  // inches
  bust?: number; // inches
}

export interface BodyWeightEntry {
  date: string; // YYYY-MM-DD
  weight: number; // lbs
}

export interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number; // heaviest weight lifted
  reps: number; // reps at that weight
  achievedDate: string; // YYYY-MM-DD
}

export interface BodyScanPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  angle: "front" | "back" | "left" | "right" | "all"; // angle or "all" if multiple
  photoData: string; // base64 image data
  height?: number; // inches or cm (user's height when photo taken)
  weight?: number; // lbs or kg (optional weight at time of photo)
  analysis?: {
    bodyFat: { low: number; high: number; category?: string; note?: string };
    compositionScore: number;
    potentialScore?: number;
    honestAssessment?: string;
    strengths?: string[];
    areas?: string[];
    roadmap?: {
      thirtyDay?: { focus: string; expectedChange: string; actions: string[] };
      ninetyDay?: { focus: string; expectedChange: string; actions: string[] };
      sixMonth?: { focus: string; expectedChange: string; actions: string[] };
    };
  };
}

export interface FormCheckPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  exerciseName: string;
  exerciseId: string;
  photoData: string; // base64 image data
  formScore?: number; // 0-100
  corrections?: string[];
}

export interface AvatarVideoUrl {
  exerciseId: string;
  exerciseName: string;
  videoUrl: string; // HeyGen video URL
  generatedAt: string; // ISO datetime
  avatarPrompt?: string; // The prompt used to generate this video
}

export interface WorkoutData {
  sessionLogs: WorkoutSessionLog[];
  walkingLogs: WalkingLog[];
  measurements: MeasurementEntry[];
  bodyWeight: BodyWeightEntry[];
  personalRecords?: ExercisePR[]; // PR tracking per exercise
  bodyScanPhotos?: BodyScanPhoto[]; // Body scan photo history for progress tracking
  formCheckPhotos?: FormCheckPhoto[]; // Form check photo history
  avatarVideoUrls?: AvatarVideoUrl[]; // HeyGen avatar video URLs for exercises
  lastAPTCheckDate?: string; // YYYY-MM-DD
  lastMeasurementReminder?: string; // YYYY-MM-DD
  goalWeight?: number;
  programStartDate?: string; // YYYY-MM-DD
}

export const defaultDashboardData = (): DashboardData => ({
  userId: "aya",
  updatedAt: new Date().toISOString(),
  anxietyCheckIns: [],
  tasks: [],
  exposureLog: [],
  drivingLog: [],
  habits: [
    { id: "h1", name: "Morning Prayer", icon: "🙏", color: "#DA667B", section: "devotional", weeklyGoal: 7, order: 0 },
    { id: "h2", name: "Bible Study", icon: "📖", color: "#71816D", section: "devotional", weeklyGoal: 5, order: 1 },
    { id: "h3", name: "Morning Walk", icon: "🚶🏾‍♀️", color: "#71816D", section: "daily", weeklyGoal: 5, order: 2 },
    { id: "h4", name: "Skincare AM", icon: "✨", color: "#8A9E87", section: "daily", weeklyGoal: 7, order: 3 },
    { id: "h5", name: "Skincare PM", icon: "🌙", color: "#342A21", section: "daily", weeklyGoal: 7, order: 4 },
    { id: "h6", name: "Study / MCAT", icon: "📚", color: "#71816D", section: "daily", weeklyGoal: 5, order: 5 },
    { id: "h7", name: "Drink Water", icon: "💧", color: "#C9B79C", section: "daily", weeklyGoal: 7, order: 6 },
    { id: "h8", name: "No Phone First Hour", icon: "📵", color: "#DA667B", section: "daily", weeklyGoal: 5, order: 7 },
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
  budgetCategories: [],
  financesConfig: {
    bigTicketThreshold: 100,
    watchListMerchants: ["sephora", "ulta", "amazon", "starbucks", "coffee", "doordash", "ubereats", "grubhub", "uber", "lyft"],
    bigMoves: [],
    recurringHidden: [],
    recurringFlagged: [],
    merchantCategoryOverrides: [
      { nameContains: "hos corp amer",  category: "FOOD_AND_DRINK" },
      { nameContains: "midnight oil",   category: "FOOD_AND_DRINK" },
      { nameContains: "ymca",           category: "PERSONAL_CARE"  },
    ],
  },
  connectionLogs: [],
  wins: [],
  goals: [],
  books: [],
  yearReflections: [],
  visionBoard: { items: [] },
  nutrition: { meals: [], recipes: [], groceryItems: [], pantryItems: [], shetritionImages: [] },
  workout: { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] },
  sms: {
    phoneNumber: "",
    enabled: false,
    messages: [],
    reminders: [
      { id: "sms-r1", label: "Workout Reminder", message: "Time to train! 💪 Reply DONE when you finish, or SKIP for a rest day.", time: "09:00", enabled: true, days: [0,1,2,3,4] },
      { id: "sms-r2", label: "Evening Check-in", message: "Quick check-in! Reply with: weight in lbs (e.g. 130lbs) or steps (e.g. 8500 steps). How'd today go?", time: "20:00", enabled: false, days: [] },
      { id: "sms-r3", label: "Motivation Boost", message: "You're building something incredible. One rep at a time. See you in the gym today?", time: "07:30", enabled: false, days: [0,2,4] },
    ],
  },
});
