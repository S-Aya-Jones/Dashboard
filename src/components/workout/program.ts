export type ExerciseCategory = "compound" | "isolation" | "core" | "mobility";

export interface ProgramExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  formCue: string;
  videoId?: string; // YouTube video ID
  category: ExerciseCategory;
  isBodyweight?: boolean;
}

export interface ProgramDay {
  id: string;
  weekday: number; // 0=Mon … 6=Sun
  label: string;
  shortLabel: string;
  exercises: ProgramExercise[];
}

const hipFlexorCooldown: ProgramExercise = {
  id: "hip-flexor-cooldown",
  name: "Hip Flexor Stretch",
  sets: 1,
  reps: "60 sec each",
  restSeconds: 0,
  formCue: "Low lunge, tuck your pelvis under. Breathe into the front of your hip.",
  videoId: "YQmpO3HxY94",
  category: "mobility",
  isBodyweight: true,
};

export const PROGRAM: ProgramDay[] = [
  {
    id: "lower-a",
    weekday: 0, // Monday
    label: "Lower Body A",
    shortLabel: "Lower A",
    exercises: [
      {
        id: "hip-thrust",
        name: "Hip Thrusts",
        sets: 4,
        reps: "8–10",
        restSeconds: 90,
        formCue: "Drive through your heels and squeeze hard at the top. Chin tucked, ribs down.",
        videoId: "xDmFkJxPzeM",
        category: "compound",
      },
      {
        id: "rdl",
        name: "Romanian Deadlifts",
        sets: 3,
        reps: "10–12",
        restSeconds: 90,
        formCue: "Hinge at your hips, soft knee bend. Feel the stretch all the way through your hamstrings.",
        videoId: "JCXUYuzwNrM",
        category: "compound",
      },
      {
        id: "bss",
        name: "Bulgarian Split Squats",
        sets: 3,
        reps: "10 each",
        restSeconds: 90,
        formCue: "Front foot far forward. Torso slightly forward. Drive up through your front heel.",
        videoId: "2C-uNgKwPLE",
        category: "compound",
      },
      hipFlexorCooldown,
    ],
  },
  {
    id: "lower-b",
    weekday: 2, // Wednesday
    label: "Lower Body B",
    shortLabel: "Lower B",
    exercises: [
      {
        id: "hip-thrust",
        name: "Hip Thrusts",
        sets: 4,
        reps: "10–12",
        restSeconds: 90,
        formCue: "Drive through your heels and squeeze hard at the top. Chin tucked, ribs down.",
        videoId: "xDmFkJxPzeM",
        category: "compound",
      },
      {
        id: "cable-kickback",
        name: "Cable Kickbacks",
        sets: 3,
        reps: "15 each",
        restSeconds: 60,
        formCue: "Keep hips square to the cable. Full extension and hard squeeze at the top.",
        videoId: "Kr5NfpBQMBE",
        category: "isolation",
      },
      {
        id: "bss",
        name: "Bulgarian Split Squats",
        sets: 3,
        reps: "12 each",
        restSeconds: 90,
        formCue: "Front foot far forward. Torso slightly forward. Drive up through your front heel.",
        videoId: "2C-uNgKwPLE",
        category: "compound",
      },
      hipFlexorCooldown,
    ],
  },
  {
    id: "lower-c-core",
    weekday: 4, // Friday
    label: "Lower Body + Core",
    shortLabel: "Lower + Core",
    exercises: [
      {
        id: "rdl",
        name: "Romanian Deadlifts",
        sets: 4,
        reps: "8",
        restSeconds: 90,
        formCue: "Hinge at your hips, soft knee bend. Feel the stretch all the way through your hamstrings.",
        videoId: "JCXUYuzwNrM",
        category: "compound",
      },
      {
        id: "cable-kickback",
        name: "Cable Kickbacks",
        sets: 3,
        reps: "15 each",
        restSeconds: 60,
        formCue: "Keep hips square to the cable. Full extension and hard squeeze at the top.",
        videoId: "Kr5NfpBQMBE",
        category: "isolation",
      },
      {
        id: "dead-bugs",
        name: "Dead Bugs",
        sets: 3,
        reps: "10 each",
        restSeconds: 45,
        formCue: "Lower back pressed flat into the floor throughout. Move slowly with control.",
        videoId: "g_BYB0R-4Ws",
        category: "core",
        isBodyweight: true,
      },
      {
        id: "pallof-press",
        name: "Pallof Press",
        sets: 3,
        reps: "12 each",
        restSeconds: 45,
        formCue: "Resist the cable trying to rotate you. Brace your entire core before you press.",
        videoId: "AH_QZLm_0-s",
        category: "core",
      },
      {
        id: "hollow-holds",
        name: "Hollow Holds",
        sets: 3,
        reps: "20 seconds",
        restSeconds: 45,
        formCue: "Lower back pressed flat. Ribs down. Arms and legs reach long. Breathe.",
        videoId: "L8fvypPrv6g",
        category: "core",
        isBodyweight: true,
      },
      hipFlexorCooldown,
    ],
  },
];

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function getProgramDayForWeekday(weekday: number): ProgramDay | undefined {
  return PROGRAM.find((d) => d.weekday === weekday);
}

// 0 = Monday in JS Date (Sun=0 normally, so we shift)
export function todayWeekday(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
}
