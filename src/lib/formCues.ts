// Form mistake cues that people actually forget
// These will be voiced by the AI avatar during exercises

export const FORM_MISTAKE_CUES: Record<string, string[]> = {
  // Hip Thrust
  "barbell-hip-thrust": [
    "Hips sagging at the bottom — full range of motion, all the way down.",
    "Lower back arching at lockout — ribs down, tuck the pelvis slightly.",
    "Pushing through your toes instead of heels — wiggle those toes right now.",
    "Bouncing the bar off the bottom — one second up, full squeeze, two seconds down.",
    "Feet too far forward or too close — check that vertical shin at the top.",
    "Rushing the reps — this is not momentum, this is a glute builder.",
  ],

  // Romanian Deadlift
  "romanian-deadlift": [
    "Knees bending too much — this is a hinge, not a squat. Keep them soft.",
    "Rounding your back to go deeper — stop at your hamstring stretch.",
    "Hips not going back — think 'send your hips back' before lowering the weight.",
    "Bar drifting away from your legs — drag it down the entire movement.",
    "Ego lifting — the stretch at the bottom is where the growth happens.",
  ],

  // Cable Kickback
  "cable-kickback-mon": [
    "Swinging with momentum — lighter weight, slower, squeeze at the top.",
    "Arching your lower back to kick higher — core braced, leg only goes as high as the glute takes it.",
    "Quick movements — slow on the way back, that's the magic.",
    "Not pausing at the top — one full second squeeze, every rep.",
    "Moving the hip — keep it locked forward, only the leg moves.",
  ],

  // Dead Bug
  "dead-bug": [
    "Lower back lifting off the floor — shorten your range right now.",
    "Holding your breath — exhale fully as your limbs extend, that's the mechanism.",
    "Neck tension — relax your head, press your lower back down instead.",
    "Moving too fast — slow and controlled, feel your core working.",
    "Not starting from a flat back — reset before you start the rep.",
  ],

  // Pallof Press
  "pallof-press": [
    "Your torso is twisting — you're stronger than the cable, don't let it move you.",
    "Standing too close — step wider to reduce tension if you're rotating.",
    "Weight too heavy — the win is NOT moving, not looking strong.",
    "Ribs flaring — ribs down, squeeze the glutes even on a core exercise.",
  ],

  // Single-Leg Hip Thrust
  "single-leg-hip-thrust": [
    "Hips twisting — keep that belt line level, don't feed your imbalance.",
    "Free-leg hip dropping — that means the weaker side is struggling, slow down.",
    "Not going deep enough — full range, weak side first.",
    "Using the strong side to compensate — always start with the weaker leg.",
  ],

  // Sumo Deadlift
  "sumo-deadlift": [
    "Knees caving inward — spread the floor with your feet, knees over toes.",
    "Back rounding off the floor — chest up, lats tight before the bar leaves.",
    "Weight too far forward — it should stay over mid-foot, not your toes.",
    "Not sitting back enough — this is a squat pattern, hips drop first.",
    "Partial range — plates look low? Elevate the bar on blocks, form first.",
  ],

  // Side Plank
  "side-plank": [
    "Hips sagging — stack them level, obliques are cinching like a corset right now.",
    "Body leaning forward — stay in a straight line from head to heels.",
    "Lower back arching — glutes tight, pelvis tucked, core engaged.",
    "Not holding long enough — 30 seconds of perfect tension beats 90 seconds sagging.",
  ],

  // Plank
  "plank": [
    "Hips sagging — this position right here is your APT being rehearsed under tension, fix it.",
    "Ribs flaring — ribs down, pelvis tucked, glutes squeezed tight.",
    "Lower back arching — that's anterior pelvic tilt, tuck the pelvis.",
    "Holding your breath — breathe, stay engaged, this is a core hold not a breath hold.",
    "30 perfect seconds beats 90 sagging ones.",
  ],

  // Lat Pulldown
  "lat-pulldown-mon": [
    "Using momentum — swinging recruits your lower back, slow it down.",
    "Elbows not tracking back — elbows DOWN and back, not out to the sides.",
    "Not getting full range at the top — arms extended, lats stretched.",
    "Leaning back too much — slight lean is fine, but you're not jerking the weight.",
  ],

  // Abduction Machine
  "hip-abduction-machine": [
    "Fast pump reps through partial range — slow return, three seconds back.",
    "Not leaning forward — lean slightly forward to bias the upper glute shelf.",
    "Weight too light — if you're not feeling this, go heavier.",
    "Rushing the reps — the return builds the glute shelf, don't skip it.",
  ],

  // General Compound
  "compound-general": [
    "Form breaking on the last rep — the set is over, bad reps don't build muscle.",
    "Two feet not equal pressure — both sides working equally hard.",
    "Skipping the stretch — that's where the growth signal happens.",
    "Ego before form — a weight you can squeeze beats a weight you can barely move.",
  ],

  // General Isolation
  "isolation-general": [
    "Swinging the weight — slow, controlled, mind-muscle connection.",
    "Not feeling it in the right place — if it's not there, lower the weight and reset.",
    "Going too heavy — lighter weight with perfect form beats heavy and sloppy.",
    "No pause at the top — squeeze and hold, that's the contraction.",
  ],

  // General Core
  "core-general": [
    "Lower back doing the work — if your back is working, your core isn't.",
    "Flared ribs — ribs down, that's the whole cue.",
    "Not engaging fully — tension the entire time, even on the 'easy' part.",
    "Weighted core work — don't do it, a weighted waist is a wider waist.",
  ],

  // Mobility/Stretching
  "mobility-general": [
    "Forcing the stretch — ease in, never force, you'll just tighten up more.",
    "Bouncing — static hold, breathe into it, gravity does the work.",
    "Not breathing — each exhale takes you deeper, relax on the breath out.",
    "Tight hip flexors are cutting your glute activation in half, stay with this.",
  ],
};

// Get cues for an exercise based on its ID and category
export function getFormCuesForExercise(exerciseId: string, category: string): string[] {
  // First try exact exercise ID match
  if (FORM_MISTAKE_CUES[exerciseId]) {
    return FORM_MISTAKE_CUES[exerciseId];
  }

  // Fall back to category-based cues
  const categoryKey = `${category}-general`;
  if (FORM_MISTAKE_CUES[categoryKey]) {
    return FORM_MISTAKE_CUES[categoryKey];
  }

  // Last resort
  return [
    "Mind-muscle connection — feel the working muscle, not just moving weight.",
    "Full range of motion — don't cheat the range for heavier weight.",
    "Control the negative — the eccentric is where the muscle actually builds.",
    "Form over ego — perfect form at lighter weight beats sloppy form heavy.",
  ];
}
