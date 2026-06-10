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
  motivCues?: string[];
}

export const CATEGORY_CUES: Record<ExerciseCategory, string[]> = {
  compound: [
    "Drive through your heels.",
    "Full range of motion — all the way up, all the way down.",
    "Brace your core before every rep.",
    "Last rep, same quality as the first.",
    "Control the weight on the way down.",
    "Chest tall. Own the movement.",
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
  warmupExercises: ProgramExercise[];
  mainExercises: ProgramExercise[];
  cooldownExercises: ProgramExercise[];
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
    label: "Foundation",
    guidance: "Learn every movement. Build mind-muscle connection. Zero ego on weight. Use dumbbell or bodyweight hip thrusts until barbell setup feels natural.",
    isDeload: false,
  },
  {
    weekNums: [3, 4],
    label: "Build",
    guidance: "Add load progressively. Volume rises. Visible shape change typically starts here. Add 5–10 lbs every session or two once all reps are clean.",
    isDeload: false,
  },
  {
    weekNums: [5, 6],
    label: "Peak Intensity",
    guidance: "Maximum stimulus. Heavier and more controlled. Every working set should be a genuine challenge. Push to near-maximum effort with perfect form.",
    isDeload: false,
  },
  {
    weekNums: [7],
    label: "Deload — Let It Grow",
    guidance: "Same movements, 50% of your week 6 weight, same reps. Recovery week — growth consolidates here. Do not skip the deload.",
    isDeload: true,
  },
];

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Daily APT Reset — do every day including rest days (Table 3)
export const APT_RESET: ProgramExercise[] = [
  {
    id: "apt-hip-flexor-stretch",
    name: "Kneeling Hip Flexor Stretch",
    sets: 1,
    reps: "60 sec each side",
    restSeconds: 0,
    formCue: "Back knee down, squeeze that glute hard, tuck the pelvis under, then shift forward. The glute squeeze is what makes this work.",
    category: "mobility",
    isBodyweight: true,
    videoId: "UGEpQ1vGq4A",
  },
  {
    id: "apt-dead-bug",
    name: "Dead Bug",
    sets: 1,
    reps: "8 each side",
    restSeconds: 0,
    formCue: "Lower back glued to the floor the entire time. If it lifts, shorten the range.",
    category: "core",
    isBodyweight: true,
    videoId: "EiRC80FJbHU",
  },
  {
    id: "apt-pelvic-tuck",
    name: "Standing Pelvic Tuck",
    sets: 1,
    reps: "10 reps",
    restSeconds: 0,
    formCue: "Hands on hips. Tilt the pelvis backward — tuck tailbone under — hold 3 seconds, release. Teaching your body where neutral is.",
    category: "core",
    isBodyweight: true,
  },
  {
    id: "apt-glute-squeeze",
    name: "Glute Squeeze Hold",
    sets: 3,
    reps: "10 sec",
    restSeconds: 0,
    formCue: "Standing, squeeze glutes as hard as possible. Wakes up the muscle that holds the pelvis level.",
    category: "core",
    isBodyweight: true,
    isGlute: true,
  },
];

// Keep for backward compatibility — maps to APT Reset essentials
export const CORE_PRIMER = APT_RESET;
export const HIP_FLEXOR_UNLOCK: ProgramExercise[] = [
  {
    id: "kneeling-hip-flexor",
    name: "Kneeling Hip Flexor Stretch",
    sets: 1,
    reps: "60 sec each side",
    restSeconds: 0,
    formCue: "Back knee down, glute squeezed, pelvis tucked. Tight hip flexors cut glute activation in half.",
    category: "mobility",
    isBodyweight: true,
    videoId: "UGEpQ1vGq4A",
  },
];

export const PROGRAM: ProgramDay[] = [
  // ── MONDAY — Glutes Heavy + Back Taper ──────────────────────────────────────
  {
    id: "mon-heavy-glutes",
    weekday: 0,
    label: "Glutes Heavy + Back Taper",
    shortLabel: "Heavy",
    isGluteDay: true,
    estimatedMinutes: 60,
    warmupExercises: [
      {
        id: "mon-hip-circles",
        name: "Hip Circles",
        sets: 2,
        reps: "10 each dir",
        restSeconds: 0,
        formCue: "Standing, hands on hips. Opens the hip joint before loading.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "mon-glute-bridge-hold",
        name: "Glute Bridge Hold",
        sets: 2,
        reps: "30 sec",
        restSeconds: 0,
        formCue: "Bodyweight. Drive through heels, squeeze maximally at the top. This is the wake-up call.",
        category: "core",
        isBodyweight: true,
        isGlute: true,
        videoId: "OB2JPUxbBDs",
      },
      {
        id: "mon-banded-clamshell",
        name: "Banded Clamshell",
        sets: 2,
        reps: "15 each side",
        restSeconds: 0,
        formCue: "Light band above knees. Keep feet together, hips stacked. Targets glute medius.",
        category: "isolation",
        isBodyweight: true,
        isGlute: true,
      },
      {
        id: "mon-cat-cow",
        name: "Cat-Cow",
        sets: 1,
        reps: "10 slow",
        restSeconds: 0,
        formCue: "Warms the spine and deep core before loading.",
        category: "mobility",
        isBodyweight: true,
        videoId: "kqnua4rHVVA",
      },
      {
        id: "mon-dead-bug-warmup",
        name: "Dead Bug",
        sets: 1,
        reps: "6 each side",
        restSeconds: 0,
        formCue: "Back flat. Sets the pelvis to neutral before you thrust.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
      },
    ],
    mainExercises: [
      {
        id: "barbell-hip-thrust",
        name: "Barbell Hip Thrust",
        sets: 4,
        reps: "8–10",
        restSeconds: 180,
        formCue: "Pad the bar. Bench edge at mid-scapula, feet so shins are vertical at top. Drive up explosively, ribs down, full 1-second squeeze at lockout, lower under control. Weeks 1–2: use dumbbell until setup feels automatic.",
        category: "compound",
        isGlute: true,
        videoId: "xDmFkJxPzeM",
        motivCues: [
          "Chin tucked, ribs down — protect your spine.",
          "Squeeze HARD at the very top. Hold it for one full second.",
          "Drive through your heels, not your toes. Wiggle those toes.",
          "Hinge from the hips. Low back stays neutral — you are NOT hyperextending.",
          "This is the most important exercise of your week. Make every rep count.",
          "Vertical shins at the top — check that cue right now.",
        ],
      },
      {
        id: "romanian-deadlift",
        name: "Romanian Deadlift",
        sets: 3,
        reps: "10–12",
        restSeconds: 90,
        formCue: "Hinge at the hips, soft knees, bar drags along the legs. Push hips BACK, not down. Stop at the hamstring stretch — that stretch is the glutes loading. Flat back always. Range ends where flat back ends.",
        category: "compound",
        isGlute: true,
        videoId: "JCXUYuzwNrM",
        motivCues: [
          "Hinge at the hips — send your hips BACK first.",
          "Feel that hamstring stretch at the bottom. That's the glute loading.",
          "Keep the bar close to your legs the whole way.",
          "Soft bend in the knees — this is not a squat.",
          "The stretch at the bottom is where the growth signal happens.",
        ],
      },
      {
        id: "lat-pulldown-mon",
        name: "Lat Pulldown",
        sets: 3,
        reps: "12",
        restSeconds: 60,
        formCue: "Wide grip. Pull to upper chest, elbows down and back, slight chest-up lean. Builds the lat taper that visually shrinks the waist.",
        category: "compound",
        videoId: "CAwf7n6Luuc",
      },
      {
        id: "seated-cable-row",
        name: "Seated Cable Row",
        sets: 3,
        reps: "12",
        restSeconds: 60,
        formCue: "Neutral grip. Squeeze shoulder blades at the end. No swinging, no leaning back for momentum.",
        category: "compound",
        videoId: "GZbfZ033f74",
      },
    ],
    cooldownExercises: [
      {
        id: "mon-pigeon-pose",
        name: "Pigeon Pose",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Deep glute and hip release after heavy loading.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "mon-quad-stretch",
        name: "Standing Quad Stretch",
        sets: 1,
        reps: "30 sec each side",
        restSeconds: 0,
        formCue: "Heel to glute, knees together, pelvis tucked.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "mon-hip-flexor-cooldown",
        name: "Kneeling Hip Flexor Stretch",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "CRITICAL for your APT. Squeeze the back-leg glute, tuck the pelvis, then lean. Every glute day, no exceptions.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "mon-childs-pose",
        name: "Child's Pose",
        sets: 1,
        reps: "60 sec",
        restSeconds: 0,
        formCue: "Decompresses the spine after loading.",
        category: "flexibility",
        isBodyweight: true,
      },
    ],
  },

  // ── TUESDAY — Deep Core + Upper Body Light ───────────────────────────────────
  {
    id: "tue-core-upper",
    weekday: 1,
    label: "Deep Core + Upper Body Light",
    shortLabel: "Core",
    isGluteDay: false,
    estimatedMinutes: 50,
    warmupExercises: [
      {
        id: "tue-arm-circles",
        name: "Arm Circles",
        sets: 2,
        reps: "10 each dir",
        restSeconds: 0,
        formCue: "Forward and backward. Shoulder prep.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "tue-dead-bug-warmup",
        name: "Dead Bug",
        sets: 2,
        reps: "6 each side",
        restSeconds: 0,
        formCue: "Back stays glued to the floor. Your pelvic reset, every session.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
      },
      {
        id: "tue-cat-cow",
        name: "Cat-Cow",
        sets: 1,
        reps: "10",
        restSeconds: 0,
        formCue: "Spinal warm-up.",
        category: "mobility",
        isBodyweight: true,
        videoId: "kqnua4rHVVA",
      },
      {
        id: "tue-thoracic-rotation",
        name: "Thoracic Rotation",
        sets: 1,
        reps: "8 each side",
        restSeconds: 0,
        formCue: "All fours, hand behind head, rotate elbow to ceiling. Opens the upper back.",
        category: "mobility",
        isBodyweight: true,
      },
    ],
    mainExercises: [
      {
        id: "dead-bug-main",
        name: "Dead Bug",
        sets: 3,
        reps: "8 each side",
        restSeconds: 45,
        formCue: "The most important APT exercise you own. Lower back pressed flat the entire rep. Exhale fully as the limbs extend — the exhale is what engages the deep core.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
        motivCues: [
          "Lower back GLUED to the floor. That's non-negotiable.",
          "Exhale fully as the limbs extend. The breath is the mechanism.",
          "Shorten your range before you lose the flat back. Quality first.",
          "This is fixing your posture one rep at a time.",
        ],
      },
      {
        id: "pallof-press",
        name: "Pallof Press",
        sets: 3,
        reps: "12 each side",
        restSeconds: 45,
        formCue: "Cable or band at chest height, press straight out, resist the rotation. The win is NOT moving. Builds the corset that holds your pelvis and waist.",
        category: "core",
        isBodyweight: false,
        videoId: "AH_QZLm_0-s",
        motivCues: [
          "Don't let it rotate you. You are stronger than the cable.",
          "This is building your anti-rotation corset. It flattens your waist.",
          "Stand tall. Ribs down. Press and resist.",
        ],
      },
      {
        id: "mcgill-curl-up",
        name: "McGill Curl-Up",
        sets: 3,
        reps: "8 each side",
        restSeconds: 30,
        formCue: "Not a crunch. One knee bent, hands under the lower-back arch, lift only head and shoulders an inch. Anterior core without spinal compression.",
        category: "core",
        isBodyweight: true,
        motivCues: [
          "This is not a crunch. One inch up, that's all.",
          "Hands under your lower back — protect that arch.",
          "Anterior core strength without spinal compression. Smart training.",
        ],
      },
      {
        id: "side-plank",
        name: "Side Plank",
        sets: 3,
        reps: "20–30 sec each side",
        restSeconds: 30,
        formCue: "Obliques cinch the waist like a corset when trained with holds, not weighted bends. Start from knees; progress to feet when 30 sec is easy.",
        category: "core",
        isBodyweight: true,
        motivCues: [
          "Obliques like a corset. These are your waist muscles.",
          "Hips forward, not sagging. Stack them.",
          "30 seconds of tension is building visible oblique definition.",
        ],
      },
      {
        id: "db-shoulder-press",
        name: "Dumbbell Shoulder Press",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        formCue: "8–10 lbs max. High rep, light load = definition without size. Ribs down — do not arch the lower back to press. Squeeze glutes, tuck ribs, press.",
        category: "isolation",
        videoId: "qEwKCR5JCog",
        motivCues: [
          "Light weight, high rep — tone not bulk.",
          "Ribs DOWN. Don't let APT sneak in under load.",
          "The shoulder cap you're building frames the entire hourglass.",
        ],
      },
      {
        id: "db-lateral-raise",
        name: "Dumbbell Lateral Raise",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        formCue: "Slight elbow bend, raise to shoulder height only, lead with the elbows. 8 lbs strict beats 15 lbs swung. Builds the shoulder cap that frames the hourglass.",
        category: "isolation",
        videoId: "3VcKaXpzqRo",
        motivCues: [
          "Shoulder height only. No higher.",
          "Lead with your elbows, not your wrists.",
          "Strict form here builds visible shoulder definition without any bulk.",
        ],
      },
      {
        id: "banded-tricep-pushdown",
        name: "Banded Tricep Pushdown",
        sets: 3,
        reps: "15–20",
        restSeconds: 45,
        formCue: "Elbows pinned to your sides. Tone, not mass.",
        category: "isolation",
      },
      {
        id: "face-pull",
        name: "Face Pull",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        formCue: "Rope at face height, pull toward the forehead, elbows high, end with a 1-sec squeeze. Fixes the rounded shoulders that ride along with APT.",
        category: "isolation",
        videoId: "rep-qVOkqgk",
        motivCues: [
          "Elbows high and wide. Squeeze at the end.",
          "This is correcting your posture one rep at a time.",
          "Rounded shoulders make your waist look wider. This fixes that.",
        ],
      },
    ],
    cooldownExercises: [
      {
        id: "tue-doorway-stretch",
        name: "Doorway Chest Stretch",
        sets: 2,
        reps: "30 sec",
        restSeconds: 0,
        formCue: "Opens the chest after pressing. Corrects forward shoulders.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "tue-hip-flexor-cooldown",
        name: "Kneeling Hip Flexor Stretch",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Non-negotiable. Every session, including upper days.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "tue-figure-4",
        name: "Supine Figure-4",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Ankle over opposite knee, pull toward chest. Deep glute medius release.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "tue-childs-pose",
        name: "Child's Pose",
        sets: 1,
        reps: "60 sec",
        restSeconds: 0,
        formCue: "Finish.",
        category: "flexibility",
        isBodyweight: true,
      },
    ],
  },

  // ── WEDNESDAY — Glutes Volume + Abduction ───────────────────────────────────
  {
    id: "wed-volume-glutes",
    weekday: 2,
    label: "Glutes Volume + Abduction",
    shortLabel: "Volume",
    isGluteDay: true,
    estimatedMinutes: 55,
    warmupExercises: [
      {
        id: "wed-abduction-walk",
        name: "Banded Hip Abduction Walk",
        sets: 2,
        reps: "15 steps each dir",
        restSeconds: 0,
        formCue: "Band above knees, quarter squat, side-step both directions. Lights up the glute medius.",
        category: "isolation",
        isBodyweight: true,
        isGlute: true,
      },
      {
        id: "wed-donkey-kick",
        name: "Banded Donkey Kick",
        sets: 2,
        reps: "15 each side",
        restSeconds: 0,
        formCue: "All fours, drive the heel to the ceiling, hard squeeze at the top, no lower-back arch.",
        category: "isolation",
        isBodyweight: true,
        isGlute: true,
      },
      {
        id: "wed-hip-circles",
        name: "Hip Circles",
        sets: 1,
        reps: "10 each dir",
        restSeconds: 0,
        formCue: "Opens the hip joint.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "wed-dead-bug-warmup",
        name: "Dead Bug",
        sets: 1,
        reps: "6 each side",
        restSeconds: 0,
        formCue: "Every session. Pelvis to neutral first.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
      },
    ],
    mainExercises: [
      {
        id: "barbell-hip-thrust-vol",
        name: "Barbell Hip Thrust",
        sets: 4,
        reps: "12–15",
        restSeconds: 90,
        formCue: "Lighter than Monday on purpose — this is volume, not max effort. Every rep gets the full top squeeze. Accumulate stimulus. Leave 2 reps in the tank.",
        category: "compound",
        isGlute: true,
        videoId: "xDmFkJxPzeM",
        motivCues: [
          "Every rep gets the squeeze. Volume day is about accumulating stimulus.",
          "Leave 2 reps in the tank — save the effort for Friday.",
          "Full squeeze at the top on every single rep. That's non-negotiable.",
          "This is your shape day. Every rep is sculpting the glute shelf.",
        ],
      },
      {
        id: "cable-kickback-wed",
        name: "Cable Kickback",
        sets: 4,
        reps: "15 each side",
        restSeconds: 45,
        formCue: "Ankle strap, slight forward lean, drive the leg back and slightly up, 1-sec squeeze. Feel it, do not just move it. No swinging — lighter and slower.",
        category: "isolation",
        isGlute: true,
        videoId: "Kr5NfpBQMBE",
        motivCues: [
          "Feel it or it doesn't count. If you're not feeling it, go lighter.",
          "One second squeeze at the top. Every single rep.",
          "Don't swing — the rep is wasted if you swing it.",
        ],
      },
      {
        id: "hip-abduction-machine",
        name: "Seated Hip Abduction Machine",
        sets: 4,
        reps: "20–25",
        restSeconds: 45,
        formCue: "Lean slightly forward to bias the upper glute. Push out hard, resist slowly on the way in. This builds the hip shelf. Control the return — 3 seconds in.",
        category: "isolation",
        isGlute: true,
        videoId: "tCQCgA9HmQk",
        motivCues: [
          "Lean slightly forward. Upper glute fires more in that position.",
          "Resist on the way in — 3 seconds back. The return builds the shelf.",
          "This exercise alone builds the hip flare. Don't rush it.",
        ],
      },
      {
        id: "single-leg-rdl-wed",
        name: "Single-Leg Romanian Deadlift",
        sets: 3,
        reps: "10 each side",
        restSeconds: 60,
        formCue: "Hinge with the back leg extending behind. Hips square to the floor. Hold a wall or rack for balance at first — balance is not the goal, loading the glute is.",
        category: "compound",
        isGlute: true,
        motivCues: [
          "Hips square to the floor. That's the whole cue.",
          "Hold support if you need it — balance is not the point today.",
          "Feel the working-side glute stretch as you hinge. That's it.",
          "Always start your weaker side first. Match the strong side to it.",
        ],
      },
      {
        id: "lat-pulldown-wed",
        name: "Lat Pulldown",
        sets: 2,
        reps: "12",
        restSeconds: 60,
        formCue: "Maintenance volume for the back taper. Elbows down and back, pull to upper chest.",
        category: "compound",
        videoId: "CAwf7n6Luuc",
      },
    ],
    cooldownExercises: [
      {
        id: "wed-pigeon-pose",
        name: "Pigeon Pose",
        sets: 1,
        reps: "90 sec each side",
        restSeconds: 0,
        formCue: "Longer hold today — more volume means more release needed.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "wed-figure-4",
        name: "Supine Figure-4",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "After all that abduction, the glute medius needs this.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "wed-hip-flexor-cooldown",
        name: "Kneeling Hip Flexor Stretch",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Every glute day. Non-negotiable for APT.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "wed-forward-fold",
        name: "Seated Forward Fold",
        sets: 1,
        reps: "60 sec",
        restSeconds: 0,
        formCue: "Hamstring and lower-back release.",
        category: "flexibility",
        isBodyweight: true,
      },
    ],
  },

  // ── THURSDAY — Active Recovery + Full Mobility ───────────────────────────────
  {
    id: "thu-active-recovery",
    weekday: 3,
    label: "Active Recovery + Full Mobility",
    shortLabel: "Recovery",
    isGluteDay: false,
    estimatedMinutes: 40,
    warmupExercises: [],
    mainExercises: [
      {
        id: "thu-incline-walk",
        name: "Incline Treadmill Walk",
        sets: 1,
        reps: "25–30 min",
        restSeconds: 0,
        formCue: "8–12% incline, 3.0–3.5 mph. Passive glute loading and fat metabolism with zero muscle breakdown.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "thu-foam-roll",
        name: "Full-Body Foam Roll",
        sets: 1,
        reps: "10 min",
        restSeconds: 0,
        formCue: "Glutes, hamstrings, hip flexors, IT band, upper back. 30–60 slow seconds per area.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "thu-pigeon-pose",
        name: "Pigeon Pose",
        sets: 1,
        reps: "90 sec each side",
        restSeconds: 0,
        formCue: "Longest pigeon hold of the week. Breathe into it.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "thu-hip-flexor",
        name: "Kneeling Hip Flexor Stretch",
        sets: 1,
        reps: "90 sec each side",
        restSeconds: 0,
        formCue: "Longest hip flexor work of the week. Direct APT treatment. Glute squeezed, pelvis tucked.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "thu-figure-4",
        name: "Supine Figure-4",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Deep glute medius release.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "thu-cat-cow",
        name: "Cat-Cow",
        sets: 1,
        reps: "20 slow",
        restSeconds: 0,
        formCue: "Spinal decompression after three loading days.",
        category: "mobility",
        isBodyweight: true,
        videoId: "kqnua4rHVVA",
      },
      {
        id: "thu-childs-pose",
        name: "Child's Pose",
        sets: 1,
        reps: "2 min",
        restSeconds: 0,
        formCue: "Complete spinal decompression.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "thu-thoracic-rotation",
        name: "Thoracic Rotation",
        sets: 1,
        reps: "10 each side",
        restSeconds: 0,
        formCue: "Posture reset for the rounded-shoulder pattern.",
        category: "mobility",
        isBodyweight: true,
      },
    ],
    cooldownExercises: [],
  },

  // ── FRIDAY — Glutes Unilateral + Hinge + Core ───────────────────────────────
  {
    id: "fri-unilateral-glutes",
    weekday: 4,
    label: "Glutes Unilateral + Hinge + Core",
    shortLabel: "Unilateral",
    isGluteDay: true,
    estimatedMinutes: 55,
    warmupExercises: [
      {
        id: "fri-glute-bridge-hold",
        name: "Glute Bridge Hold",
        sets: 2,
        reps: "30 sec",
        restSeconds: 0,
        formCue: "Bodyweight activation, same as Monday.",
        category: "core",
        isBodyweight: true,
        isGlute: true,
        videoId: "OB2JPUxbBDs",
      },
      {
        id: "fri-good-morning",
        name: "Bodyweight Good Morning",
        sets: 2,
        reps: "10",
        restSeconds: 0,
        formCue: "Hands behind head, hinge at the hips, soft knees. Grooves the hinge before loading it.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "fri-clamshell",
        name: "Banded Clamshell",
        sets: 2,
        reps: "12 each side",
        restSeconds: 0,
        formCue: "Glute medius activation.",
        category: "isolation",
        isBodyweight: true,
        isGlute: true,
      },
      {
        id: "fri-dead-bug-warmup",
        name: "Dead Bug",
        sets: 1,
        reps: "6 each side",
        restSeconds: 0,
        formCue: "Every session.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
      },
    ],
    mainExercises: [
      {
        id: "single-leg-hip-thrust",
        name: "Single-Leg Hip Thrust",
        sets: 4,
        reps: "10–12 each side",
        restSeconds: 90,
        formCue: "One leg extended, drive through the planted heel, hips stay level — do not let the free-leg side sag. Start bodyweight; add a dumbbell on the hips when 12 clean reps are easy. Weaker side first.",
        category: "compound",
        isGlute: true,
        videoId: "ZMO9tNQVp5E",
        motivCues: [
          "Belt line LEVEL. Don't let the free-leg side drop.",
          "Drive through the planted heel only.",
          "Weaker side first — strong side matches. Build the balance.",
          "Hips level means both glutes are firing equally.",
          "This is fixing imbalances and building glutes at the same time.",
        ],
      },
      {
        id: "sumo-deadlift",
        name: "Sumo Deadlift",
        sets: 3,
        reps: "8",
        restSeconds: 120,
        formCue: "Wide stance, toes out 45°. Drive the floor apart with your feet. The sumo stance shifts load off the quads into glutes and inner thighs — this is your squat replacement. Chest up, lats tight.",
        category: "compound",
        isGlute: true,
        videoId: "dF-hhSRrLgI",
        motivCues: [
          "Spread the floor with your feet. That cue activates the glutes.",
          "Knees track over toes the whole lift. No caving.",
          "This is your squat replacement. All glutes, no quad bulk.",
          "Chest up, lats tight before the bar leaves the floor.",
        ],
      },
      {
        id: "cable-pull-through",
        name: "Cable Pull-Through",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        formCue: "Face away from a low cable, rope between the legs, hinge, then snap the hips forward and squeeze. Pure glute, zero spinal load. The best hinge-pattern finisher.",
        category: "isolation",
        isGlute: true,
        videoId: "Pq89v64jSU0",
        motivCues: [
          "Snap the hips forward. The power comes from the glutes.",
          "This is pure glute loading with no spinal compression.",
          "Squeeze hard at the top — this is a finisher, leave nothing.",
        ],
      },
      {
        id: "dead-bug-fri",
        name: "Dead Bug",
        sets: 3,
        reps: "10 each side",
        restSeconds: 30,
        formCue: "Closing the week the way it opened. Back flat, slow, full exhale.",
        category: "core",
        isBodyweight: true,
        videoId: "EiRC80FJbHU",
      },
      {
        id: "plank",
        name: "Plank",
        sets: 3,
        reps: "30–45 sec",
        restSeconds: 30,
        formCue: "Squeeze the glutes and tuck the pelvis while you hold — a plank with tucked pelvis is an APT corrector. Sagging hips and flared ribs make APT worse. 30 perfect seconds beats 90 sagging ones.",
        category: "core",
        isBodyweight: true,
        motivCues: [
          "Glutes tight, pelvis tucked. You're correcting APT right now.",
          "Ribs down. Don't let them flare.",
          "Every second of this plank is a flat-stomach investment.",
        ],
      },
    ],
    cooldownExercises: [
      {
        id: "fri-pigeon-pose",
        name: "Pigeon Pose",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Deep hip release after unilateral loading.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
      {
        id: "fri-forward-fold",
        name: "Seated Forward Fold",
        sets: 1,
        reps: "60 sec",
        restSeconds: 0,
        formCue: "Hamstrings and lower back after a hinge-heavy day.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "fri-supine-hip-flexor",
        name: "Supine Hip Flexor Stretch",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "On a bench edge, pull one knee to the chest, let the other leg hang. Deep release.",
        category: "flexibility",
        isBodyweight: true,
      },
      {
        id: "fri-hip-flexor-cooldown",
        name: "Kneeling Hip Flexor Stretch",
        sets: 1,
        reps: "60 sec each side",
        restSeconds: 0,
        formCue: "Every glute day.",
        category: "mobility",
        isBodyweight: true,
        videoId: "UGEpQ1vGq4A",
      },
    ],
  },

  // ── SATURDAY — Incline Walk or Full Rest ─────────────────────────────────────
  {
    id: "sat-walk-rest",
    weekday: 5,
    label: "Incline Walk or Full Rest",
    shortLabel: "Walk",
    isGluteDay: false,
    estimatedMinutes: 35,
    warmupExercises: [],
    mainExercises: [
      {
        id: "sat-incline-walk",
        name: "Incline Treadmill Walk",
        sets: 1,
        reps: "25–30 min",
        restSeconds: 0,
        formCue: "8–12% incline, 3.0–3.5 mph. Your fat-loss engine. Passively loads the glutes without recovery cost.",
        category: "mobility",
        isBodyweight: true,
      },
      {
        id: "sat-foam-roll",
        name: "Light Foam Roll",
        sets: 1,
        reps: "10 min",
        restSeconds: 0,
        formCue: "Glutes, IT band, calves. If you feel genuinely fatigued today, skip this entirely and rest.",
        category: "mobility",
        isBodyweight: true,
      },
    ],
    cooldownExercises: [],
  },

  // ── SUNDAY — Full Rest ───────────────────────────────────────────────────────
  {
    id: "sun-full-rest",
    weekday: 6,
    label: "Full Rest",
    shortLabel: "Rest",
    isGluteDay: false,
    estimatedMinutes: 0,
    warmupExercises: [],
    mainExercises: [
      {
        id: "sun-rest-note",
        name: "Rest & Recover",
        sets: 1,
        reps: "Full day",
        restSeconds: 0,
        formCue: "Do nothing. Sleep. Hit your protein. Your glutes grow on rest days — training is the signal, rest is the construction. Non-negotiable.",
        category: "mobility",
        isBodyweight: true,
      },
    ],
    cooldownExercises: [],
  },
];

/** Returns all exercises for a day: warmup + main + cooldown */
export function buildFullExerciseList(day: ProgramDay): ProgramExercise[] {
  return [
    ...day.warmupExercises,
    ...day.mainExercises,
    ...day.cooldownExercises,
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

/** Returns 1–7 based on programStartDate; returns 0 if not started */
export function getCurrentWeek(programStartDate: string | undefined): number {
  if (!programStartDate) return 0;
  const diff = differenceInCalendarDays(new Date(), parseISO(programStartDate));
  if (diff < 0) return 1;
  return Math.min(Math.floor(diff / 7) + 1, 7);
}

export function getWeekPhase(weekNum: number): WeekPhase {
  if (weekNum === 7) return WEEK_PHASES[3]; // Deload
  if (weekNum >= 5) return WEEK_PHASES[2]; // Peak
  if (weekNum >= 3) return WEEK_PHASES[1]; // Build
  return WEEK_PHASES[0];                   // Foundation
}

/** Suggests weight for a set given last weight and current week */
export function suggestWeight(lastWeight: number, weekNum: number): number {
  if (lastWeight === 0) return 0;
  const phase = getWeekPhase(weekNum);
  if (phase.isDeload) return Math.round((lastWeight * 0.5) / 5) * 5;
  if (weekNum >= 5) return lastWeight + 5;
  if (weekNum >= 3) return lastWeight + 5;
  return lastWeight;
}

// ── Helper functions for UX enhancements ──────────────────────────────────

export function getPhaseCoachingMessage(weekNum: number): string {
  const phase = getWeekPhase(weekNum);
  if (weekNum === 7) {
    return "Deload week: 50% weight, same reps. Your glutes grow during recovery — this is when consolidation happens. Trust the process.";
  }
  if (weekNum >= 5) {
    return "Peak intensity week: Heaviest loads yet. Every set should be a genuine challenge. Push hard, but protect your form.";
  }
  if (weekNum >= 3) {
    return "Build week: Add 5 lbs every session or two when form holds perfectly. Volume is rising — visible change starts now.";
  }
  return "Foundation week: Learn the movement. Build mind-muscle connection. Weight is irrelevant — feel matters most.";
}

export function getPhaseEmojiAndColor(weekNum: number): { emoji: string; color: string } {
  const phase = getWeekPhase(weekNum);
  if (weekNum === 7) return { emoji: "🌱", color: "#C99A5C" };  // Deload = rest/growth
  if (weekNum >= 5) return { emoji: "⚡", color: "#DA667B" };    // Peak = fire
  if (weekNum >= 3) return { emoji: "📈", color: "#7C5CFC" };    // Build = growth
  return { emoji: "🏗️", color: "#9B7FFF" };                      // Foundation = building
}

export function calculateWeeklyVolume(
  sessionLogs: { date: string; exercises: Array<{ sets: Array<{ weight: number; reps: number }> }> }[],
  startOfWeekDate: string
): number {
  const weekStart = parseISO(startOfWeekDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return sessionLogs
    .filter((log) => {
      const logDate = parseISO(log.date);
      return logDate >= weekStart && logDate <= weekEnd;
    })
    .reduce((total, log) => {
      return (
        total +
        log.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets.reduce((setTotal, set) => setTotal + set.weight * set.reps, 0)
          );
        }, 0)
      );
    }, 0);
}

export function getMeasurementTrend(
  measurements: Array<{ date: string; waist: number; hips: number }>,
  days: number = 14
): { waistTrend: string; hipsTrend: string } {
  if (measurements.length < 2) return { waistTrend: "→", hipsTrend: "→" };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recent = measurements.filter((m) => parseISO(m.date) >= cutoff);
  if (recent.length < 2) return { waistTrend: "→", hipsTrend: "→" };

  const oldest = recent[0];
  const newest = recent[recent.length - 1];

  const waistDiff = oldest.waist - newest.waist;
  const hipsDiff = newest.hips - oldest.hips;

  return {
    waistTrend: waistDiff > 0.25 ? "↓" : waistDiff < -0.25 ? "↑" : "→",
    hipsTrend: hipsDiff > 0.25 ? "↑" : hipsDiff < -0.25 ? "↓" : "→",
  };
}

export function getProteinTarget(bodyWeightLbs?: number): string {
  if (!bodyWeightLbs || bodyWeightLbs <= 0) return "0.7-1g per lb bodyweight";
  const low = Math.round(bodyWeightLbs * 0.7);
  const high = Math.round(bodyWeightLbs * 1);
  return `${low}–${high}g daily`;
}
