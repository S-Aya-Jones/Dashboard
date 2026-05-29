import { differenceInCalendarDays, parseISO } from "date-fns";

export type ExerciseCategory = "compound" | "isolation" | "core" | "mobility" | "flexibility";

export interface ProgramExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  formCue: string;
  category: ExerciseCategory;
  isBodyweight?: boolean;
  isGlute?: boolean;
  videoId?: string;
  motivCues?: string[]; // coaching cues spoken periodically during the exercise
}

export const CATEGORY_CUES: Record<ExerciseCategory, string[]> = {
  compound: [
    "Drive through your heels.",
    "Full range of motion — all the way up, all the way down.",
    "Brace your core before every rep.",
    "Last rep, same quality as the first.",
    "Control the weight on the way down.",
    "Chest tall. Own the movement.",
    // pitfalls
    "Common mistake: rushing the reps. Slow it down.",
    "Don't let your lower back do the work your glutes should be doing.",
    "Two feet, equal pressure — don't favor one side.",
    "Braced core protects your spine on every rep.",
    "The eccentric — the lowering phase — is where the muscle actually builds.",
  ],
  isolation: [
    "Squeeze and hold at the top.",
    "Slow and controlled — feel the muscle working.",
    "It's not about the weight. It's about the connection.",
    "Mind-muscle. Are you feeling it?",
    "Pause at the peak contraction.",
    // pitfalls
    "Don't swing or use momentum — that's just cheating your muscles.",
    "Lighter weight with perfect form beats heavy and sloppy every single time.",
    "The mind-muscle connection is the entire point here.",
    "If you can't feel it, you're probably going too heavy.",
  ],
  core: [
    "Low back stays pressed to the floor.",
    "Breathe out on the effort.",
    "Ribs down — don't let them flare.",
    "Your core is your foundation. Make it unshakeable.",
    "Tension the whole time, even on the easy part.",
    // pitfalls
    "If your lower back is working, your core isn't. Reset and try again.",
    "Don't hold your breath — exhale on the hard part.",
    "The goal is tension, not just movement.",
    "Strong core equals a stronger everything. Don't rush through this.",
  ],
  mobility: [
    "Breathe into the stretch. Let it open.",
    "Relax further with each exhale.",
    "You can't build a great body on tight hips. Stay with it.",
    "Gravity is doing the work. Trust it.",
    // pitfalls
    "Never force a stretch — you'll just tighten up more. Ease in.",
    "Pain is not the goal. A deep, uncomfortable pull is.",
    "Consistency here will literally change your body shape over time.",
    "Tight hip flexors cut your glute activation in half. This is why we do this.",
  ],
  flexibility: [
    "Let gravity do the work. Breathe and release.",
    "Each breath takes you deeper.",
    "Relax your face, relax your hips. They're connected.",
    "Consistency here is what builds real flexibility.",
    "You're changing the length of your muscles right now.",
    // pitfalls
    "Relax your hips, relax your face, relax your breath — they're all connected.",
    "The tighter you hold, the less you gain. Surrender to it.",
    "Every session you're lengthening the fascia. It takes time but it's happening.",
    "Stretch from the hip socket, not the knee — protect your joints.",
  ],
};

export const UNIVERSAL_CUES: string[] = [
  "Stay in your body. Feel every rep.",
  "This is where the transformation actually happens.",
  "You showed up. Now make every rep count.",
  "Quality over speed. Always.",
  "Breathe. Stay controlled.",
  "This discomfort is your body getting stronger.",
  "You're building your best body, one rep at a time.",
  "Full range of motion — shortcuts steal results.",
  "Control the weight. Don't let it control you.",
  "Your future self is watching. Don't slack.",
  "Slow down the negative. That's where the muscle actually builds.",
  "Every rep counts. Don't throw any away.",
  "Chase the feeling, not the number.",
  "Focus on the squeeze, not just the movement.",
  "The women who look incredible earned it rep by rep, just like this.",
  "You're one workout closer to the body you're building.",
  "Nobody gets results half-heartedly. Go all the way.",
  "Mind over muscle — your brain gives up before your body does.",
  "If it feels easy, you're either doing it wrong or need more weight.",
  "Visualize what you're building. That glute shelf doesn't build itself.",
  "Keep your breathing rhythmic. Oxygen is your fuel.",
  "This set is an investment. You'll collect the returns in the mirror.",
];

export interface ProgramDay {
  id: string;
  weekday: number; // 0=Mon … 6=Sun
  label: string;
  shortLabel: string;
  isGluteDay: boolean;
  estimatedMinutes: number;
  mainExercises: ProgramExercise[];
}

export interface WeekPhase {
  weekNums: number[];
  label: string;
  guidance: string;
  isDeload: boolean;
}

export const WEEK_PHASES: WeekPhase[] = [
  {
    weekNums: [1, 2],
    label: "Building the Foundation",
    guidance: "Focus on form and mind-muscle connection. Moderate weight — feel every rep.",
    isDeload: false,
  },
  {
    weekNums: [3, 4],
    label: "Progressive Overload",
    guidance: "Add weight every session. You should be working hard by the last rep.",
    isDeload: false,
  },
  {
    weekNums: [4],
    label: "Deload — Let It Grow",
    guidance: "Drop all weights by 40%. Keep flexibility and core. Your body grows during recovery.",
    isDeload: true,
  },
  {
    weekNums: [5, 6],
    label: "Peak Intensity",
    guidance: "Heaviest weights yet. Deepest stretches. Push every set to near failure.",
    isDeload: false,
  },
];

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const CORE_PRIMER: ProgramExercise[] = [
  {
    id: "stomach-vacuum",
    name: "Stomach Vacuum",
    sets: 5,
    reps: "30 sec",
    restSeconds: 15,
    formCue: "Exhale everything, draw navel to spine. This is your inner corset.",
    category: "core",
    isBodyweight: true,
    videoId: "yCEBpsMOcG4",
    motivCues: ["Draw the belly button all the way to the spine.", "Hold it. This is your inner corset tightening.", "This exercise alone can transform your waistline."],
  },
  {
    id: "dead-bug",
    name: "Dead Bug",
    sets: 3,
    reps: "10 each side",
    restSeconds: 30,
    formCue: "Lower back glued to floor, breathe out as you extend.",
    category: "core",
    isBodyweight: true,
    videoId: "EiRC80FJbHU",
  },
  {
    id: "hollow-hold",
    name: "Hollow Hold",
    sets: 3,
    reps: "20 sec",
    restSeconds: 30,
    formCue: "Ribs down, lower back pressed. Breathe shallow.",
    category: "core",
    isBodyweight: true,
    videoId: "LlDNef_Ztsc",
  },
  {
    id: "heel-slides",
    name: "Heel Slides",
    sets: 3,
    reps: "15 each side",
    restSeconds: 30,
    formCue: "Pelvis stays neutral — core does all the work.",
    category: "core",
    isBodyweight: true,
    videoId: "b5GpOJMDaXo",
  },
];

export const HIP_FLEXOR_UNLOCK: ProgramExercise[] = [
  {
    id: "couch-stretch",
    name: "Couch Stretch",
    sets: 1,
    reps: "60 sec each side",
    restSeconds: 0,
    formCue: "Tight hip flexors cut your glute activation in half — release them first.",
    category: "mobility",
    isBodyweight: true,
    videoId: "UGEpQ1vGq4A",
  },
  {
    id: "90-90-hip",
    name: "90/90 Hip Stretch",
    sets: 1,
    reps: "60 sec each side",
    restSeconds: 0,
    formCue: "Let gravity do the work. Breathe into the hip.",
    category: "mobility",
    isBodyweight: true,
    videoId: "27mZKcuRNLU",
  },
  {
    id: "glute-bridge-activation",
    name: "Glute Bridge Activation",
    sets: 1,
    reps: "20 slow",
    restSeconds: 0,
    formCue: "Feel your glutes wake up before loading them heavy.",
    category: "mobility",
    isBodyweight: true,
    isGlute: true,
    videoId: "OB2JPUxbBDs",
  },
];

export const PROGRAM: ProgramDay[] = [
  // MONDAY — Heavy Glutes
  {
    id: "mon-heavy-glutes",
    weekday: 0,
    label: "Heavy Glutes",
    shortLabel: "Heavy",
    isGluteDay: true,
    estimatedMinutes: 45,
    mainExercises: [
      {
        id: "barbell-hip-thrust",
        name: "Barbell Hip Thrust",
        sets: 4,
        reps: "6–8",
        restSeconds: 90,
        formCue: "Drive through heels, full extension, squeeze hard at top.",
        category: "compound",
        isGlute: true,
        videoId: "xDmFkJxPzeM",
        motivCues: ["Chin tucked, ribs down — protect your spine.", "Squeeze HARD at the very top. Hold it.", "Drive through your heels, not your toes.", "Hinge from the hips. Low back stays neutral.", "This is your primary glute builder. Make it count."],
      },
      {
        id: "romanian-deadlift",
        name: "Romanian Deadlift",
        sets: 3,
        reps: "8–10",
        restSeconds: 90,
        formCue: "Hinge at hips, soft knee, feel the stretch.",
        category: "compound",
        isGlute: true,
        videoId: "JCXUYuzwNrM",
        motivCues: ["Hinge at the hips — send your hips BACK first.", "Feel that hamstring stretch at the bottom.", "Keep the bar close to your legs the whole way.", "Soft bend in the knees — this is not a squat.", "The stretch at the bottom is where the growth signal happens."],
      },
      {
        id: "bulgarian-split-squat",
        name: "Bulgarian Split Squat",
        sets: 3,
        reps: "10 each leg",
        restSeconds: 90,
        formCue: "Back knee drops straight down, front heel stays planted.",
        category: "compound",
        isGlute: true,
        videoId: "2C-uNgKwPLE",
        motivCues: ["Front shin stays vertical — don't let the knee cave in.", "Drive up through your front heel.", "Lean your torso slightly forward for glute emphasis.", "This is the single hardest glute exercise. Embrace it."],
      },
      {
        id: "cable-kickback-mon",
        name: "Cable Kickback",
        sets: 3,
        reps: "15 each side",
        restSeconds: 45,
        formCue: "Slow eccentric, pause at peak contraction.",
        category: "isolation",
        isGlute: true,
        videoId: "Kr5NfpBQMBE",
      },
      {
        id: "rear-delt-fly-mon",
        name: "Rear Delt Fly",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        formCue: "Shoulder blades together, keep it light and controlled.",
        category: "isolation",
        videoId: "Td1kzN5nSbM",
      },
    ],
  },

  // TUESDAY — Flexibility + Splits
  {
    id: "tue-flexibility",
    weekday: 1,
    label: "Flexibility + Splits",
    shortLabel: "Flex",
    isGluteDay: false,
    estimatedMinutes: 35,
    mainExercises: [
      { id: "pnf-hip-flexor", name: "PNF Hip Flexor Stretch", sets: 3, reps: "60 sec each side", restSeconds: 0, formCue: "Contract then relax deeper. PNF doubles your flexibility gains.", category: "flexibility", isBodyweight: true, videoId: "KZm_mFdPGMM" },
      { id: "pancake-stretch", name: "Pancake Stretch", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Hinge forward from hips, keep spine long.", category: "flexibility", isBodyweight: true, videoId: "5yWaNOCpNJQ" },
      { id: "standing-split", name: "Standing Split Progression", sets: 3, reps: "30 sec each side", restSeconds: 0, formCue: "Weight through standing foot, reach the raised leg up.", category: "flexibility", isBodyweight: true },
      { id: "pike-stretch", name: "Pike Stretch", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Working toward toe touch — flex feet, fold from hips.", category: "flexibility", isBodyweight: true, videoId: "M_4c9Y0iYno" },
      { id: "straddle-stretch", name: "Straddle Stretch", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Sit tall first, then hinge forward.", category: "flexibility", isBodyweight: true, videoId: "SJQ3hfIjr0g" },
      { id: "seated-forward-fold", name: "Seated Forward Fold", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Breathe into the back of your legs.", category: "flexibility", isBodyweight: true },
      { id: "active-leg-swings", name: "Active Leg Swings", sets: 3, reps: "20 each direction", restSeconds: 0, formCue: "Controlled range — let momentum build gradually.", category: "flexibility", isBodyweight: true, videoId: "7pLBzBnVBow" },
    ],
  },

  // WEDNESDAY — Stretch Glutes
  {
    id: "wed-stretch-glutes",
    weekday: 2,
    label: "Stretch Glutes",
    shortLabel: "Stretch",
    isGluteDay: true,
    estimatedMinutes: 40,
    mainExercises: [
      {
        id: "smith-hip-thrust",
        name: "Smith Machine Hip Thrust",
        sets: 4,
        reps: "10",
        restSeconds: 90,
        formCue: "Different angle than barbell — feel the difference.",
        category: "compound",
        isGlute: true,
        videoId: "mMQOdCcMvtI",
      },
      {
        id: "single-leg-hip-thrust",
        name: "Single Leg Hip Thrust",
        sets: 3,
        reps: "10 each side",
        restSeconds: 60,
        formCue: "Forces glute medius to fire, fixes imbalances.",
        category: "compound",
        isGlute: true,
        videoId: "ZMO9tNQVp5E",
      },
      {
        id: "sumo-deadlift",
        name: "Sumo Deadlift",
        sets: 3,
        reps: "10",
        restSeconds: 90,
        formCue: "Wide stance, toes out, drive the floor apart.",
        category: "compound",
        isGlute: true,
        videoId: "dF-hhSRrLgI",
      },
      {
        id: "back-extension",
        name: "45° Back Extension",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        formCue: "Squeeze glutes at top, don't hyperextend lower back.",
        category: "isolation",
        isGlute: true,
        videoId: "ph3pddpKzzw",
      },
      {
        id: "rear-delt-fly-wed",
        name: "Rear Delt Fly",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        formCue: "Shoulder blades together, keep it light and controlled.",
        category: "isolation",
      },
    ],
  },

  // THURSDAY — Calisthenics Skills
  {
    id: "thu-calisthenics",
    weekday: 3,
    label: "Calisthenics Skills",
    shortLabel: "Skills",
    isGluteDay: false,
    estimatedMinutes: 30,
    mainExercises: [
      { id: "handstand-hold", name: "Handstand Wall Hold", sets: 3, reps: "20–30 sec", restSeconds: 60, formCue: "Straight line from wrists to hips, squeeze glutes and core.", category: "core", isBodyweight: true, videoId: "WjkDjFdECgU" },
      { id: "bridge-hold", name: "Bridge Hold", sets: 3, reps: "20–30 sec", restSeconds: 60, formCue: "Push floor away, open chest, squeeze glutes at top.", category: "core", isBodyweight: true, isGlute: true, videoId: "OB2JPUxbBDs" },
      { id: "bridge-to-stand", name: "Bridge to Stand Progression", sets: 3, reps: "attempts", restSeconds: 60, formCue: "Rock into it, use momentum, trust your shoulders.", category: "core", isBodyweight: true, videoId: "gAK8HXlS24g" },
      { id: "pike-push-up", name: "Pike Push Up", sets: 3, reps: "8", restSeconds: 60, formCue: "This builds shoulder definition without bulk.", category: "compound", isBodyweight: true, videoId: "4_ZMoZtJsKM" },
      { id: "l-sit", name: "L-Sit Progression", sets: 3, reps: "10–15 sec", restSeconds: 60, formCue: "Compress your core. This is advanced TVA work.", category: "core", isBodyweight: true, videoId: "IUZjiO-o2ao" },
      { id: "skin-the-cat", name: "Skin the Cat Progression", sets: 3, reps: "attempts", restSeconds: 60, formCue: "Slow and controlled — this is about shoulder mobility.", category: "mobility", isBodyweight: true, videoId: "X5a3cMjl0Pw" },
    ],
  },

  // FRIDAY — Pump Glutes
  {
    id: "fri-pump-glutes",
    weekday: 4,
    label: "Pump Glutes",
    shortLabel: "Pump",
    isGluteDay: true,
    estimatedMinutes: 40,
    mainExercises: [
      {
        id: "banded-hip-thrust",
        name: "Banded Hip Thrust",
        sets: 3,
        reps: "20 slow",
        restSeconds: 45,
        formCue: "Slow and squeeze — metabolic stress builds shape.",
        category: "compound",
        isGlute: true,
        videoId: "xDmFkJxPzeM",
      },
      {
        id: "hip-abduction",
        name: "Hip Abduction Machine",
        sets: 4,
        reps: "20",
        restSeconds: 45,
        formCue: "This builds the upper glute shelf — go heavier than you think.",
        category: "isolation",
        isGlute: true,
        videoId: "tCQCgA9HmQk",
      },
      {
        id: "glute-bridge-slow",
        name: "Glute Bridge",
        sets: 3,
        reps: "20 slow, 2 sec hold",
        restSeconds: 45,
        formCue: "Two second hold at top. Squeeze everything.",
        category: "isolation",
        isGlute: true,
        isBodyweight: true,
        videoId: "OB2JPUxbBDs",
      },
      {
        id: "step-ups",
        name: "Step Ups",
        sets: 3,
        reps: "12 each leg",
        restSeconds: 60,
        formCue: "Drive through heel of working leg only.",
        category: "compound",
        isGlute: true,
        videoId: "dQqApCGd5Ss",
      },
      {
        id: "cable-pull-through",
        name: "Cable Pull Through",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        formCue: "Hinge and squeeze — lower glute focus.",
        category: "isolation",
        isGlute: true,
        videoId: "Pq89v64jSU0",
      },
    ],
  },

  // SATURDAY — Full Flexibility + Bridge Work
  {
    id: "sat-flexibility-bridge",
    weekday: 5,
    label: "Full Flexibility + Bridge",
    shortLabel: "Bridge",
    isGluteDay: false,
    estimatedMinutes: 30,
    mainExercises: [
      { id: "full-bridge-hold", name: "Full Bridge Hold", sets: 3, reps: "20 sec", restSeconds: 30, formCue: "Push through your hands and feet equally.", category: "flexibility", isBodyweight: true, videoId: "gAK8HXlS24g" },
      { id: "chest-opener", name: "Chest Opener", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Let gravity open your chest. Breathe deeply.", category: "flexibility", isBodyweight: true },
      { id: "bridge-to-stand-sat", name: "Bridge to Stand Attempts", sets: 5, reps: "attempts", restSeconds: 60, formCue: "Use a spotter or wall if needed.", category: "flexibility", isBodyweight: true, videoId: "gAK8HXlS24g" },
      { id: "front-split", name: "Front Split Progression", sets: 3, reps: "60 sec each side", restSeconds: 0, formCue: "Breathe into it, never force.", category: "flexibility", isBodyweight: true, videoId: "fLs0W6OOlKg" },
      { id: "straddle-progressive", name: "Straddle Progressive Stretch", sets: 3, reps: "90 sec", restSeconds: 0, formCue: "Walk hands forward, hold each depth.", category: "flexibility", isBodyweight: true, videoId: "SJQ3hfIjr0g" },
      { id: "thoracic-extension", name: "Thoracic Extension (foam roller)", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Each vertebra, move it slowly.", category: "flexibility", isBodyweight: true, videoId: "4_MVpjpXHbk" },
      { id: "shoulder-opener", name: "Shoulder Opener with Strap", sets: 3, reps: "60 sec", restSeconds: 0, formCue: "Arms wide, let the strap guide the stretch.", category: "flexibility", isBodyweight: true },
    ],
  },

  // SUNDAY — Recovery Mobility
  {
    id: "sun-recovery",
    weekday: 6,
    label: "Recovery Mobility",
    shortLabel: "Recovery",
    isGluteDay: false,
    estimatedMinutes: 20,
    mainExercises: [
      { id: "pigeon-pose", name: "Pigeon Pose", sets: 1, reps: "2 min each side", restSeconds: 0, formCue: "Deep hip opener. Breathe into the tightness.", category: "mobility", isBodyweight: true, videoId: "UGEpQ1vGq4A" },
      { id: "worlds-greatest", name: "World's Greatest Stretch", sets: 1, reps: "60 sec each side", restSeconds: 0, formCue: "Combine hip flexor, thoracic rotation, hamstring.", category: "mobility", isBodyweight: true, videoId: "4ZCKZQmVNz0" },
      { id: "cat-cow", name: "Cat/Cow", sets: 1, reps: "2 min", restSeconds: 0, formCue: "Sync breath to movement. Spine health is glute health.", category: "mobility", isBodyweight: true, videoId: "kqnua4rHVVA" },
      { id: "hip-circles", name: "Hip Circles", sets: 1, reps: "60 sec each direction", restSeconds: 0, formCue: "Lubricate the joint. Move slow and wide.", category: "mobility", isBodyweight: true },
      { id: "full-body-shake", name: "Full Body Shake Out", sets: 1, reps: "60 sec", restSeconds: 0, formCue: "Relax everything. You've earned this.", category: "mobility", isBodyweight: true },
    ],
  },
];

/** Returns all exercises for a day: core primer + hip flexor unlock (if glute day) + main work */
export function buildFullExerciseList(day: ProgramDay): ProgramExercise[] {
  return [
    ...CORE_PRIMER,
    ...(day.isGluteDay ? HIP_FLEXOR_UNLOCK : []),
    ...day.mainExercises,
  ];
}

/** 0=Mon … 6=Sun, adjusted from JS Date.getDay() (0=Sun) */
export function todayWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getProgramDay(weekday: number): ProgramDay | undefined {
  return PROGRAM.find((d) => d.weekday === weekday);
}

/** Returns 1–6 based on programStartDate; returns 0 if not started */
export function getCurrentWeek(programStartDate: string | undefined): number {
  if (!programStartDate) return 0;
  const diff = differenceInCalendarDays(new Date(), parseISO(programStartDate));
  if (diff < 0) return 1;
  return Math.min(Math.floor(diff / 7) + 1, 6);
}

export function getWeekPhase(weekNum: number): WeekPhase {
  // Week 4 is deload (special case — overrides "week 3-4" rule)
  if (weekNum === 4) return WEEK_PHASES[2];
  if (weekNum >= 5) return WEEK_PHASES[3];
  if (weekNum >= 3) return WEEK_PHASES[1];
  return WEEK_PHASES[0];
}

/** Suggests weight for a set given last weight and current week */
export function suggestWeight(lastWeight: number, weekNum: number): number {
  if (lastWeight === 0) return 0;
  const phase = getWeekPhase(weekNum);
  if (phase.isDeload) return Math.round((lastWeight * 0.6) / 5) * 5;
  if (weekNum >= 5) return lastWeight + 5;
  return lastWeight;
}
