// Exercise demonstrations, from free-exercise-db (CC0 public domain,
// github.com/yuhonas/free-exercise-db).
//
// This map is hand-verified, not fuzzy-matched. The previous version matched
// on string similarity and produced demos that showed the wrong movement:
// hip abduction pointed at an ADduction machine, a single-leg hip thrust
// showed a loaded barbell thrust, and Supine Figure-4 — a glute stretch —
// showed a dumbbell curl.
//
//   match: "exact"  the demo depicts this movement
//   match: "close"  the nearest honest thing in the database, labelled as
//                   such on screen so it never silently claims to be the
//                   movement she was told to do
//
// Movements with no truthful match are deliberately absent. Written cues
// alone beat a photo of a different exercise.

export interface ExerciseDemo {
  name: string;
  match: "exact" | "close";
  images: string[];
  cues: string[];
  primary: string[];
  equipment: string | null;
}

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
  "Arm Circles": {
    "name": "Arm Circles",
    "match": "exact",
    "images": [
      "Arm_Circles/0.jpg",
      "Arm_Circles/1.jpg"
    ],
    "cues": [
      "Stand up and extend your arms straight out by the sides.",
      "Slowly start to make circles of about 1 foot in diameter with each outstretched arm. Breathe normally as you perform the movement.",
      "Continue the circular motion of the outstretched arms for about ten seconds. Then reverse the movement, going the opposite direction."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": null
  },
  "Barbell Hip Thrust": {
    "name": "Barbell Hip Thrust",
    "match": "exact",
    "images": [
      "Barbell_Hip_Thrust/0.jpg",
      "Barbell_Hip_Thrust/1.jpg"
    ],
    "cues": [
      "Begin seated on the ground with a bench directly behind you.",
      "Roll the bar so that it is directly above your hips, and lean back against the bench so that your shoulder blades are near the top of it.",
      "Begin the movement by driving through your feet, extending your hips vertically through the bar."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "barbell"
  },
  "Child's Pose": {
    "name": "Child's Pose",
    "match": "exact",
    "images": [
      "Childs_Pose/0.jpg",
      "Childs_Pose/1.jpg"
    ],
    "cues": [
      "Get on your hands and knees, walk your hands in front of you.",
      "Lower your buttocks down to sit on your heels. Let your arms drag along the floor as you sit back to stretch your entire spine.",
      "Once you settle onto your heels, bring your hands next to your feet and relax."
    ],
    "primary": [
      "lower back"
    ],
    "equipment": null
  },
  "Dead Bug": {
    "name": "Dead Bug",
    "match": "exact",
    "images": [
      "Dead_Bug/0.jpg",
      "Dead_Bug/1.jpg"
    ],
    "cues": [
      "Begin lying on your back with your hands extended above you toward the ceiling.",
      "Bring your feet, knees, and hips up to 90 degrees.",
      "Exhale hard to bring your ribcage down and flatten your back onto the floor, rotating your pelvis up and squeezing your glutes."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only"
  },
  "Face Pull": {
    "name": "Face Pull",
    "match": "exact",
    "images": [
      "Face_Pull/0.jpg",
      "Face_Pull/1.jpg"
    ],
    "cues": [
      "Facing a high pulley with a rope or dual handles attached, pull the weight directly towards your face, separating your hands as you do so."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "cable"
  },
  "Pallof Press": {
    "name": "Pallof Press",
    "match": "exact",
    "images": [
      "Pallof_Press/0.jpg",
      "Pallof_Press/1.jpg"
    ],
    "cues": [
      "Connect a standard handle to a tower, and—if possible—position the cable to shoulder height. If not, a low pulley will suffice.",
      "With your side to the cable, grab the handle with both hands and step away from the tower.",
      "With your feet positioned hip-width apart and knees slightly bent, hold the cable to the middle of your chest. This will be your starting position."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "cable"
  },
  "Plank": {
    "name": "Plank",
    "match": "exact",
    "images": [
      "Plank/0.jpg",
      "Plank/1.jpg"
    ],
    "cues": [
      "Get into a prone position on the floor, supporting your weight on your toes and your forearms. Your arms are bent and directly below the shoulder.",
      "Keep your body straight at all times, and hold this position as long as possible. To increase difficulty, an arm or leg can be raised."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only"
  },
  "Romanian Deadlift": {
    "name": "Romanian Deadlift",
    "match": "exact",
    "images": [
      "Romanian_Deadlift/0.jpg",
      "Romanian_Deadlift/1.jpg"
    ],
    "cues": [
      "Put a barbell in front of you on the ground and grab it using a pronated (palms facing down) grip that a little wider than shoulder width.",
      "Bend the knees slightly and keep the shins vertical, hips back and back straight. This will be your starting position.",
      "Keeping your back and arms completely straight at all times, use your hips to lift the bar as you exhale."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell"
  },
  "Sumo Deadlift": {
    "name": "Sumo Deadlift",
    "match": "exact",
    "images": [
      "Sumo_Deadlift/0.jpg",
      "Sumo_Deadlift/1.jpg"
    ],
    "cues": [
      "Begin with a bar loaded on the ground.",
      "Take a breath, and then lower your hips, looking forward with your head with your chest up.",
      "As the bar passes through the knees, lean back and drive the hips into the bar, pulling your shoulder blades together."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell"
  },
  "Dumbbell Shoulder Press": {
    "name": "Dumbbell Shoulder Press",
    "match": "exact",
    "images": [
      "Dumbbell_Shoulder_Press/0.jpg",
      "Dumbbell_Shoulder_Press/1.jpg"
    ],
    "cues": [
      "While holding a dumbbell in each hand, sit on a military press bench or utility bench that has back support. Place the dumbbells upright on top of your thighs.",
      "Now raise the dumbbells to shoulder height one at a time using your thighs to help propel them up into position.",
      "Make sure to rotate your wrists so that the palms of your hands are facing forward. This is your starting position."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "dumbbell"
  },
  "Seated Cable Row": {
    "name": "Seated Cable Rows",
    "match": "exact",
    "images": [
      "Seated_Cable_Rows/0.jpg",
      "Seated_Cable_Rows/1.jpg"
    ],
    "cues": [
      "For this exercise you will need access to a low pulley row machine with a V-bar.",
      "Lean over as you keep the natural alignment of your back and grab the V-bar handles.",
      "With your arms extended pull back until your torso is at a 90-degree angle from your legs."
    ],
    "primary": [
      "middle back"
    ],
    "equipment": "cable"
  },
  "Dumbbell Lateral Raise": {
    "name": "Side Lateral Raise",
    "match": "exact",
    "images": [
      "Side_Lateral_Raise/0.jpg",
      "Side_Lateral_Raise/1.jpg"
    ],
    "cues": [
      "Pick a couple of dumbbells and stand with a straight torso and the dumbbells by your side at arms length with the palms of the hand facing you.",
      "Lower the dumbbells back down slowly to the starting position as you inhale.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "dumbbell"
  },
  "Lat Pulldown": {
    "name": "Full Range-Of-Motion Lat Pulldown",
    "match": "exact",
    "images": [
      "Full_Range-Of-Motion_Lat_Pulldown/0.jpg",
      "Full_Range-Of-Motion_Lat_Pulldown/1.jpg"
    ],
    "cues": [
      "Either standing or seated on a high bench, grasp two stirrup cables that are attached to the high pulleys.",
      "Keeping your chest up and maintaining a slight arch in your lower back, pull the handles down as if you were doing a regular pulldown."
    ],
    "primary": [
      "lats"
    ],
    "equipment": "cable"
  },
  "Cable Pull-Through": {
    "name": "Pull Through",
    "match": "exact",
    "images": [
      "Pull_Through/0.jpg",
      "Pull_Through/1.jpg"
    ],
    "cues": [
      "Begin standing a few feet in front of a low pulley with a rope or handle attached. Face away from the machine, straddling the cable, with your feet set wide apart.",
      "Begin the movement by reaching through your legs as far as possible, bending at the hips."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "cable"
  },
  "Bodyweight Good Morning": {
    "name": "Good Morning",
    "match": "exact",
    "images": [
      "Good_Morning/0.jpg",
      "Good_Morning/1.jpg"
    ],
    "cues": [
      "Begin with a bar on a rack at shoulder height.",
      "Begin by bending at the hips, moving them back as you bend over to near parallel. Keep your back arched and your cervical spine in proper alignment.",
      "Reverse the motion by extending through the hips with your glutes and hamstrings. Continue until you have returned to the starting position."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell"
  },
  "Kneeling Hip Flexor Stretch": {
    "name": "Kneeling Hip Flexor",
    "match": "exact",
    "images": [
      "Kneeling_Hip_Flexor/0.jpg",
      "Kneeling_Hip_Flexor/1.jpg"
    ],
    "cues": [
      "Shift your weight forward until you feel a stretch in your hip. Hold for 15 seconds, then repeat for your other side."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": null
  },
  "Standing Quad Stretch": {
    "name": "Quad Stretch",
    "match": "exact",
    "images": [
      "Quad_Stretch/0.jpg",
      "Quad_Stretch/1.jpg"
    ],
    "cues": [
      "Lay on your side.",
      "With the belt being held over the shoulder or overhead, gently pull to increase the stretch in the quadriceps. Hold for 10-20 seconds, and then switch sides."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "other"
  },
  "Standing Pelvic Tuck": {
    "name": "Standing Pelvic Tilt",
    "match": "exact",
    "images": [
      "Standing_Pelvic_Tilt/0.jpg",
      "Standing_Pelvic_Tilt/1.jpg"
    ],
    "cues": [
      "Start off with your feet hip-distance apart.",
      "Bend your knees slightly to keep them soft and springy.",
      "You may want to move your pelvis forward and backward and back few times before holding the tailbone forward in this stretch."
    ],
    "primary": [
      "lower back"
    ],
    "equipment": null
  },
  "Cat-Cow": {
    "name": "Cat Stretch",
    "match": "exact",
    "images": [
      "Cat_Stretch/0.jpg",
      "Cat_Stretch/1.jpg"
    ],
    "cues": [
      "Position yourself on the floor on your hands and knees.",
      "Pull your belly in and round your spine, lower back, shoulders, and neck, letting your head drop.",
      "Hold for 15 seconds."
    ],
    "primary": [
      "lower back"
    ],
    "equipment": null
  },
  "Side Plank": {
    "name": "Side Bridge",
    "match": "exact",
    "images": [
      "Side_Bridge/0.jpg",
      "Side_Bridge/1.jpg"
    ],
    "cues": [],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only"
  },
  "Seated Forward Fold": {
    "name": "Seated Floor Hamstring Stretch",
    "match": "exact",
    "images": [
      "Seated_Floor_Hamstring_Stretch/0.jpg",
      "Seated_Floor_Hamstring_Stretch/1.jpg"
    ],
    "cues": [
      "Sit on a mat with your right leg extended in front of you and your left leg bent with your foot against your right inner thigh.",
      "Lean forward from your hips and reach for your ankle until you feel a stretch in your hamstring. Hold for 15 seconds, then repeat for your other side."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": null
  },
  "Incline Treadmill Walk": {
    "name": "Walking, Treadmill",
    "match": "exact",
    "images": [
      "Walking_Treadmill/0.jpg",
      "Walking_Treadmill/1.jpg"
    ],
    "cues": [
      "To begin, step onto the treadmill and select the desired option from the menu.",
      "Treadmills offer convenience, cardiovascular benefits, and usually have less impact than walking outside."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "machine"
  },
  "Thoracic Rotation": {
    "name": "Torso Rotation",
    "match": "exact",
    "images": [
      "Torso_Rotation/0.jpg",
      "Torso_Rotation/1.jpg"
    ],
    "cues": [
      "Stand upright holding an exercise ball with both hands. Extend your arms so the ball is straight out in front of you. This will be your starting position.",
      "Rotate your torso to one side, keeping your eyes on the ball as you move. Now, rotate back to the opposite direction. Repeat for 10-20 repetitions."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "exercise ball"
  },
  "Seated Hip Abduction Machine": {
    "name": "Thigh Abductor",
    "match": "exact",
    "images": [
      "Thigh_Abductor/0.jpg",
      "Thigh_Abductor/1.jpg"
    ],
    "cues": [
      "To begin, sit down on the abductor machine and select a weight you are comfortable with.",
      "Slowly press against the machine with your legs to move them away from each other while exhaling.",
      "Feel the contraction for a second and begin to move your legs back to the starting position while breathing in."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "machine"
  },
  "Cable Kickback": {
    "name": "One-Legged Cable Kickback",
    "match": "exact",
    "images": [
      "One-Legged_Cable_Kickback/0.jpg",
      "One-Legged_Cable_Kickback/1.jpg"
    ],
    "cues": [
      "Hook a leather ankle cuff to a low cable pulley and then attach the cuff to your ankle.",
      "Face the weight stack from a distance of about two feet, grasping the steel frame for support.",
      "Now slowly bring your working leg forward, resisting the pull of the cable until you reach the starting position."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "cable"
  },
  "Banded Donkey Kick": {
    "name": "Glute Kickback",
    "match": "exact",
    "images": [
      "Glute_Kickback/0.jpg",
      "Glute_Kickback/1.jpg"
    ],
    "cues": [
      "As you exhale, lift up your right leg until the hamstrings are in line with the back while maintaining the 90-degree angle bend.",
      "Go back to the initial position as you inhale and now repeat with the left leg.",
      "Continue to alternate legs until all of the recommended repetitions have been performed."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only"
  },
  "Glute Bridge Hold": {
    "name": "Butt Lift (Bridge)",
    "match": "exact",
    "images": [
      "Butt_Lift_Bridge/0.jpg",
      "Butt_Lift_Bridge/1.jpg"
    ],
    "cues": [
      "Lie flat on the floor on your back with the hands by your side and your knees bent.",
      "Pushing mainly with your heels, lift your hips off the floor while keeping your back straight.",
      "Slowly go back to the starting position as you breathe in."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only"
  },
  "Doorway Chest Stretch": {
    "name": "Chest And Front Of Shoulder Stretch",
    "match": "exact",
    "images": [
      "Chest_And_Front_Of_Shoulder_Stretch/0.jpg",
      "Chest_And_Front_Of_Shoulder_Stretch/1.jpg"
    ],
    "cues": [
      "Start off by standing with your legs together, holding a bodybar or a broomstick.",
      "Take a slightly wider than shoulder width grip on the pole and hold it in front of you with your palms facing down.",
      "Carefully lift the pole up and behind your head."
    ],
    "primary": [
      "chest"
    ],
    "equipment": "other"
  },
  "Banded Tricep Pushdown": {
    "name": "Triceps Pushdown",
    "match": "close",
    "images": [
      "Triceps_Pushdown/0.jpg",
      "Triceps_Pushdown/1.jpg"
    ],
    "cues": [
      "Attach a straight or angled bar to a high pulley and grab with an overhand grip (palms facing down) at shoulder width.",
      "Standing upright with the torso straight and a very small inclination forward, bring the upper arms close to your body and perpendicular to the floor.",
      "Using the triceps, bring the bar down until it touches the front of your thighs and the arms are fully extended perpendicular to the floor."
    ],
    "primary": [
      "triceps"
    ],
    "equipment": "cable"
  },
  "Single-Leg Hip Thrust": {
    "name": "Single Leg Glute Bridge",
    "match": "close",
    "images": [
      "Single_Leg_Glute_Bridge/0.jpg",
      "Single_Leg_Glute_Bridge/1.jpg"
    ],
    "cues": [
      "Lay on the floor with your feet flat and knees bent.",
      "Raise one leg off of the ground, pulling the knee to your chest. This will be your starting position.",
      "Execute the movement by driving through the heel, extending your hip upward and raising your glutes off of the ground."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only"
  },
  "Single-Leg Romanian Deadlift": {
    "name": "Kettlebell One-Legged Deadlift",
    "match": "close",
    "images": [
      "Kettlebell_One-Legged_Deadlift/0.jpg",
      "Kettlebell_One-Legged_Deadlift/1.jpg"
    ],
    "cues": [
      "Hold a kettlebell by the handle in one hand. Stand on one leg, on the same side that you hold the kettlebell.",
      "Keeping that knee slightly bent, perform a stiff legged deadlift by bending at the hip, extending your free leg behind you for balance.",
      "Continue lowering the kettlebell until you are parallel to the ground, and then return to the upright position."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "kettlebells"
  },
  "Pigeon Pose": {
    "name": "IT Band and Glute Stretch",
    "match": "close",
    "images": [
      "IT_Band_and_Glute_Stretch/0.jpg",
      "IT_Band_and_Glute_Stretch/1.jpg"
    ],
    "cues": [
      "Loop a belt, rope, or band around one of your feet, and swing that leg across your body to the opposite side, keeping the leg extended as you lay on the ground.",
      "Keeping your foot off of the floor, pull on the belt, using the tension to pull the toes up. Hold for 10-20 seconds, and repeat on the other side."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "other"
  },
  "Banded Hip Abduction Walk": {
    "name": "Thigh Abductor",
    "match": "close",
    "images": [
      "Thigh_Abductor/0.jpg",
      "Thigh_Abductor/1.jpg"
    ],
    "cues": [
      "To begin, sit down on the abductor machine and select a weight you are comfortable with.",
      "Slowly press against the machine with your legs to move them away from each other while exhaling.",
      "Feel the contraction for a second and begin to move your legs back to the starting position while breathing in."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "machine"
  },
  "Hip Circles": {
    "name": "Hip Circles (prone)",
    "match": "close",
    "images": [
      "Hip_Circles_prone/0.jpg",
      "Hip_Circles_prone/1.jpg"
    ],
    "cues": [
      "Position yourself on your hands and knees on the ground. Maintaining good posture, raise one bent knee off of the ground. This will be your starting position.",
      "Keeping the knee in a bent position, rotate the femur in an arc, attempting to make a big circle with your knee.",
      "Perform this slowly for a number of repetitions, and repeat on the other side."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "body only"
  }
};

/** The demo for a program exercise, if an honest one exists. */
export function demoFor(exerciseName: string): ExerciseDemo | null {
  return EXERCISE_DEMOS[exerciseName] ?? null;
}
