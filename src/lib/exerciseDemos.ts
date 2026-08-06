// Exercise demonstrations, generated from free-exercise-db (CC0 public
// domain, github.com/yuhonas/free-exercise-db). Each entry carries a start
// and end frame plus the written cues, so a session never has to leave the
// app for a YouTube search.
//
// Foam rolling and rest days have no entry on purpose — they don't need one.

export interface ExerciseDemo {
  name: string;
  images: string[];
  cues: string[];
  primary: string[];
  equipment: string | null;
  level: string | null;
}

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
  "Arm Circles": {
    "name": "Arm Circles",
    "images": [
      "Arm_Circles/0.jpg",
      "Arm_Circles/1.jpg"
    ],
    "cues": [
      "Stand up and extend your arms straight out by the sides. The arms should be parallel to the floor and perpendicular (90-degree angle) to your torso. This will be your starting position.",
      "Slowly start to make circles of about 1 foot in diameter with each outstretched arm. Breathe normally as you perform the movement.",
      "Continue the circular motion of the outstretched arms for about ten seconds. Then reverse the movement, going the opposite direction."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": null,
    "level": "beginner"
  },
  "Banded Clamshell": {
    "name": "Thigh Abductor",
    "images": [
      "Thigh_Abductor/0.jpg",
      "Thigh_Abductor/1.jpg"
    ],
    "cues": [
      "To begin, sit down on the abductor machine and select a weight you are comfortable with. When your legs are positioned properly, grip the handles on each side. Your entire upper body (from the waist up) should be stationary. This is the starting position.",
      "Slowly press against the machine with your legs to move them away from each other while exhaling.",
      "Feel the contraction for a second and begin to move your legs back to the starting position while breathing in. Note: Remember to keep your upper body stationary to prevent any injuries from occurring.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "machine",
    "level": "beginner"
  },
  "Banded Donkey Kick": {
    "name": "Glute Kickback",
    "images": [
      "Glute_Kickback/0.jpg",
      "Glute_Kickback/1.jpg"
    ],
    "cues": [
      "Kneel on the floor or an exercise mat and bend at the waist with your arms extended in front of you (perpendicular to the torso) in order to get into a kneeling push-up position but with the arms spaced at shoulder width. Your head should be looking forward and the bend of the knees should create a 90-degree angle between the hamstrings and the calves. This will be your starting position.",
      "As you exhale, lift up your right leg until the hamstrings are in line with the back while maintaining the 90-degree angle bend. Contract the glutes throughout this movement and hold the contraction at the top for a second. Tip: At the end of the movement the upper leg should be parallel to the floor while the calf should be perpendicular to it.",
      "Go back to the initial position as you inhale and now repeat with the left leg.",
      "Continue to alternate legs until all of the recommended repetitions have been performed."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Banded Hip Abduction Walk": {
    "name": "Cable Hip Adduction",
    "images": [
      "Cable_Hip_Adduction/0.jpg",
      "Cable_Hip_Adduction/1.jpg"
    ],
    "cues": [
      "Stand in front of a low pulley facing forward with one leg next to the pulley and the other one away.",
      "Attach the ankle cuff to the cable and also to the ankle of the leg that is next to the pulley.",
      "Now step out and away from the stack with a wide stance and grasp the bar of the pulley system.",
      "Stand on the foot that does not have the ankle cuff (the far foot) and allow the leg with the cuff to be pulled towards the low pulley. This will be your starting position.",
      "Now perform the movement by moving the leg with the ankle cuff in front of the far leg by using the inner thighs to abduct the hip. Breathe out during this portion of the movement.",
      "Slowly return to the starting position as you breathe in."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Banded Tricep Pushdown": {
    "name": "Triceps Pushdown",
    "images": [
      "Triceps_Pushdown/0.jpg",
      "Triceps_Pushdown/1.jpg"
    ],
    "cues": [
      "Attach a straight or angled bar to a high pulley and grab with an overhand grip (palms facing down) at shoulder width.",
      "Standing upright with the torso straight and a very small inclination forward, bring the upper arms close to your body and perpendicular to the floor. The forearms should be pointing up towards the pulley as they hold the bar. This is your starting position.",
      "Using the triceps, bring the bar down until it touches the front of your thighs and the arms are fully extended perpendicular to the floor. The upper arms should always remain stationary next to your torso and only the forearms should move. Exhale as you perform this movement.",
      "After a second hold at the contracted position, bring the bar slowly up to the starting point. Breathe in as you perform this step.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "triceps"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Barbell Hip Thrust": {
    "name": "Barbell Hip Thrust",
    "images": [
      "Barbell_Hip_Thrust/0.jpg",
      "Barbell_Hip_Thrust/1.jpg"
    ],
    "cues": [
      "Begin seated on the ground with a bench directly behind you. Have a loaded barbell over your legs. Using a fat bar or having a pad on the bar can greatly reduce the discomfort caused by this exercise.",
      "Roll the bar so that it is directly above your hips, and lean back against the bench so that your shoulder blades are near the top of it.",
      "Begin the movement by driving through your feet, extending your hips vertically through the bar. Your weight should be supported by your shoulder blades and your feet. Extend as far as possible, then reverse the motion to return to the starting position."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Bodyweight Good Morning": {
    "name": "Good Morning",
    "images": [
      "Good_Morning/0.jpg",
      "Good_Morning/1.jpg"
    ],
    "cues": [
      "Begin with a bar on a rack at shoulder height. Rack the bar across the rear of your shoulders as you would a power squat, not on top of your shoulders. Keep your back tight, shoulder blades pinched together, and your knees slightly bent. Step back from the rack.",
      "Begin by bending at the hips, moving them back as you bend over to near parallel. Keep your back arched and your cervical spine in proper alignment.",
      "Reverse the motion by extending through the hips with your glutes and hamstrings. Continue until you have returned to the starting position."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Cable Kickback": {
    "name": "Glute Kickback",
    "images": [
      "Glute_Kickback/0.jpg",
      "Glute_Kickback/1.jpg"
    ],
    "cues": [
      "Kneel on the floor or an exercise mat and bend at the waist with your arms extended in front of you (perpendicular to the torso) in order to get into a kneeling push-up position but with the arms spaced at shoulder width. Your head should be looking forward and the bend of the knees should create a 90-degree angle between the hamstrings and the calves. This will be your starting position.",
      "As you exhale, lift up your right leg until the hamstrings are in line with the back while maintaining the 90-degree angle bend. Contract the glutes throughout this movement and hold the contraction at the top for a second. Tip: At the end of the movement the upper leg should be parallel to the floor while the calf should be perpendicular to it.",
      "Go back to the initial position as you inhale and now repeat with the left leg.",
      "Continue to alternate legs until all of the recommended repetitions have been performed."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Cable Pull-Through": {
    "name": "Pull Through",
    "images": [
      "Pull_Through/0.jpg",
      "Pull_Through/1.jpg"
    ],
    "cues": [
      "Begin standing a few feet in front of a low pulley with a rope or handle attached. Face away from the machine, straddling the cable, with your feet set wide apart.",
      "Begin the movement by reaching through your legs as far as possible, bending at the hips. Keep your knees slightly bent. Keeping your arms straight, extend through the hip to stand straight up. Avoid pulling upward through the shoulders; all of the motion should originate through the hips."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Cat-Cow": {
    "name": "Cat Stretch",
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
    "equipment": null,
    "level": "beginner"
  },
  "Child's Pose": {
    "name": "Child's Pose",
    "images": [
      "Childs_Pose/0.jpg",
      "Childs_Pose/1.jpg"
    ],
    "cues": [
      "Get on your hands and knees, walk your hands in front of you.",
      "Lower your buttocks down to sit on your heels. Let your arms drag along the floor as you sit back to stretch your entire spine.",
      "Once you settle onto your heels, bring your hands next to your feet and relax. \"breathe\" into your back. Rest your forehead on the floor. Avoid this position if you have knee problems."
    ],
    "primary": [
      "lower back"
    ],
    "equipment": null,
    "level": "beginner"
  },
  "Dead Bug": {
    "name": "Dead Bug",
    "images": [
      "Dead_Bug/0.jpg",
      "Dead_Bug/1.jpg"
    ],
    "cues": [
      "Begin lying on your back with your hands extended above you toward the ceiling.",
      "Bring your feet, knees, and hips up to 90 degrees.",
      "Exhale hard to bring your ribcage down and flatten your back onto the floor, rotating your pelvis up and squeezing your glutes. Hold this position throughout the movement. This will be your starting position.",
      "Initiate the exercise by extending one leg, straightening the knee and hip to bring the leg just above the ground.",
      "Maintain the position of your lumbar and pelvis as you perform the movement, as your back is going to want to arch.",
      "Stay tight and return the working leg to the starting position."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Doorway Chest Stretch": {
    "name": "Dynamic Chest Stretch",
    "images": [
      "Dynamic_Chest_Stretch/0.jpg",
      "Dynamic_Chest_Stretch/1.jpg"
    ],
    "cues": [
      "Stand with your hands together, arms extended directly in front of you. This will be your starting position.",
      "Keeping your arms straight, quickly move your arms back as far as possible and back in again, similar to an exaggerated clapping motion. Repeat 5-10 times, increasing speed as you do so."
    ],
    "primary": [
      "chest"
    ],
    "equipment": null,
    "level": "beginner"
  },
  "Dumbbell Lateral Raise": {
    "name": "Cable Seated Lateral Raise",
    "images": [
      "Cable_Seated_Lateral_Raise/0.jpg",
      "Cable_Seated_Lateral_Raise/1.jpg"
    ],
    "cues": [
      "Stand in the middle of two low pulleys that are opposite to each other and place a flat bench right behind you (in perpendicular fashion to you; the narrow edge of the bench should be the one behind you). Select the weight to be used on each pulley.",
      "Now sit at the edge of the flat bench behind you with your feet placed in front of your knees.",
      "Bend forward while keeping your back flat and rest your torso on the thighs.",
      "Have someone give you the single handles attached to the pulleys. Grasp the left pulley with the right hand and the right pulley with the left after you select your weight. The pulleys should run under your knees and your arms will be extended with palms facing each other and a slight bend at the elbows. This will be the starting position.",
      "While keeping the arms stationary, raise the upper arms to the sides until they are parallel to the floor and at shoulder height. Exhale during the execution of this movement and hold the contraction for a second.",
      "Slowly lower your arms to the starting position as you inhale."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Dumbbell Shoulder Press": {
    "name": "Alternating Cable Shoulder Press",
    "images": [
      "Alternating_Cable_Shoulder_Press/0.jpg",
      "Alternating_Cable_Shoulder_Press/1.jpg"
    ],
    "cues": [
      "Move the cables to the bottom of the tower and select an appropriate weight.",
      "Grasp the cables and hold them at shoulder height, palms facing forward. This will be your starting position.",
      "Keeping your head and chest up, extend through the elbow to press one side directly over head.",
      "After pausing at the top, return to the starting position and repeat on the opposite side."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Face Pull": {
    "name": "Face Pull",
    "images": [
      "Face_Pull/0.jpg",
      "Face_Pull/1.jpg"
    ],
    "cues": [
      "Facing a high pulley with a rope or dual handles attached, pull the weight directly towards your face, separating your hands as you do so. Keep your upper arms parallel to the ground."
    ],
    "primary": [
      "shoulders"
    ],
    "equipment": "cable",
    "level": "intermediate"
  },
  "Glute Bridge Hold": {
    "name": "Barbell Glute Bridge",
    "images": [
      "Barbell_Glute_Bridge/0.jpg",
      "Barbell_Glute_Bridge/1.jpg"
    ],
    "cues": [
      "Begin seated on the ground with a loaded barbell over your legs. Using a fat bar or having a pad on the bar can greatly reduce the discomfort caused by this exercise. Roll the bar so that it is directly above your hips, and lay down flat on the floor.",
      "Begin the movement by driving through with your heels, extending your hips vertically through the bar. Your weight should be supported by your upper back and the heels of your feet.",
      "Extend as far as possible, then reverse the motion to return to the starting position."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Glute Squeeze Hold": {
    "name": "Butt Lift (Bridge)",
    "images": [
      "Butt_Lift_Bridge/0.jpg",
      "Butt_Lift_Bridge/1.jpg"
    ],
    "cues": [
      "Lie flat on the floor on your back with the hands by your side and your knees bent. Your feet should be placed around shoulder width. This will be your starting position.",
      "Pushing mainly with your heels, lift your hips off the floor while keeping your back straight. Breathe out as you perform this part of the motion and hold at the top for a second.",
      "Slowly go back to the starting position as you breathe in."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Hip Circles": {
    "name": "Hip Circles (prone)",
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
    "equipment": "body only",
    "level": "beginner"
  },
  "Incline Treadmill Walk": {
    "name": "Walking, Treadmill",
    "images": [
      "Walking_Treadmill/0.jpg",
      "Walking_Treadmill/1.jpg"
    ],
    "cues": [
      "To begin, step onto the treadmill and select the desired option from the menu. Most treadmills have a manual setting, or you can select a program to run. Typically, you can enter your age and weight to estimate the amount of calories burned during exercise. Elevation can be adjusted to change the intensity of the workout.",
      "Treadmills offer convenience, cardiovascular benefits, and usually have less impact than walking outside. When walking, you should move at a moderate to fast pace, not a leisurely one. Being an activity of lower intensity, walking doesn't burn as many calories as some other activities, but still provides great benefit. A 150 lb person will burn about 175 calories walking 4 miles per hour for 30 minutes, compared to 450 calories running twice as fast. Maintain proper posture as you walk, and only hold onto the handles when necessary, such as when dismounting or checking your heart rate."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "machine",
    "level": "beginner"
  },
  "Kneeling Hip Flexor Stretch": {
    "name": "Kneeling Hip Flexor",
    "images": [
      "Kneeling_Hip_Flexor/0.jpg",
      "Kneeling_Hip_Flexor/1.jpg"
    ],
    "cues": [
      "Kneel on a mat and bring your right knee up so the bottom of your foot is on the floor and extend your left leg out behind you so the top of your foot is on the floor.",
      "Shift your weight forward until you feel a stretch in your hip. Hold for 15 seconds, then repeat for your other side."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": null,
    "level": "beginner"
  },
  "Lat Pulldown": {
    "name": "One Arm Lat Pulldown",
    "images": [
      "One_Arm_Lat_Pulldown/0.jpg",
      "One_Arm_Lat_Pulldown/1.jpg"
    ],
    "cues": [
      "Select an appropriate weight and adjust the knee pad to help keep you down. Grasp the handle with a pronated grip. This will be your starting position.",
      "Pull the handle down, squeezing your elbow to your side as you flex the elbow.",
      "Pause at the bottom of the motion, and then slowly return the handle to the starting position.",
      "For multiple repetitions, avoid completely returning the weight to keep tension on the muscles being worked."
    ],
    "primary": [
      "lats"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "McGill Curl-Up": {
    "name": "Crunch - Hands Overhead",
    "images": [
      "Crunch_-_Hands_Overhead/0.jpg",
      "Crunch_-_Hands_Overhead/1.jpg"
    ],
    "cues": [
      "Lie on the floor with your back flat and knees bent with around a 60-degree angle between the hamstrings and the calves.",
      "Keep your feet flat on the floor and stretch your arms overhead with your palms crossed. This will be your starting position.",
      "Curl your upper body forward and bring your shoulder blades just off the floor. At all times, keep your arms aligned with your head, neck and shoulder. Don't move them forward from that position. Exhale as you perform this portion of the movement and hold the contraction for a second.",
      "Slowly lower down to the starting position as you inhale.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Pallof Press": {
    "name": "Pallof Press",
    "images": [
      "Pallof_Press/0.jpg",
      "Pallof_Press/1.jpg"
    ],
    "cues": [
      "Connect a standard handle to a tower, and—if possible—position the cable to shoulder height. If not, a low pulley will suffice.",
      "With your side to the cable, grab the handle with both hands and step away from the tower. You should be approximately arm's length away from the pulley, with the tension of the weight on the cable.",
      "With your feet positioned hip-width apart and knees slightly bent, hold the cable to the middle of your chest. This will be your starting position.",
      "Press the cable away from your chest, fully extending both arms. You core should be tight and engaged.",
      "Hold the repetition for several seconds before returning to the starting position.",
      "At the conclusion of the set, repeat facing the other direction."
    ],
    "primary": [
      "abdominals"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Pigeon Pose": {
    "name": "IT Band and Glute Stretch",
    "images": [
      "IT_Band_and_Glute_Stretch/0.jpg",
      "IT_Band_and_Glute_Stretch/1.jpg"
    ],
    "cues": [
      "Loop a belt, rope, or band around one of your feet, and swing that leg across your body to the opposite side, keeping the leg extended as you lay on the ground. This will be your starting position.",
      "Keeping your foot off of the floor, pull on the belt, using the tension to pull the toes up. Hold for 10-20 seconds, and repeat on the other side."
    ],
    "primary": [
      "abductors"
    ],
    "equipment": "other",
    "level": "intermediate"
  },
  "Plank": {
    "name": "Plank",
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
    "equipment": "body only",
    "level": "beginner"
  },
  "Romanian Deadlift": {
    "name": "Romanian Deadlift",
    "images": [
      "Romanian_Deadlift/0.jpg",
      "Romanian_Deadlift/1.jpg"
    ],
    "cues": [
      "Put a barbell in front of you on the ground and grab it using a pronated (palms facing down) grip that a little wider than shoulder width. Tip: Depending on the weight used, you may need wrist wraps to perform the exercise and also a raised platform in order to allow for better range of motion.",
      "Bend the knees slightly and keep the shins vertical, hips back and back straight. This will be your starting position.",
      "Keeping your back and arms completely straight at all times, use your hips to lift the bar as you exhale. Tip: The movement should not be fast but steady and under control.",
      "Once you are standing completely straight up, lower the bar by pushing the hips back, only slightly bending the knees, unlike when squatting. Tip: Take a deep breath at the start of the movement and keep your chest up. Hold your breath as you lower and exhale as you complete the movement.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Seated Cable Row": {
    "name": "Dumbbell Incline Row",
    "images": [
      "Dumbbell_Incline_Row/0.jpg",
      "Dumbbell_Incline_Row/1.jpg"
    ],
    "cues": [
      "Using a neutral grip, lean into an incline bench.",
      "Take a dumbbell in each hand with a neutral grip, beginning with the arms straight. This will be your starting position.",
      "Retract the shoulder blades and flex the elbows to row the dumbbells to your side.",
      "Pause at the top of the motion, and then return to the starting position."
    ],
    "primary": [
      "middle back"
    ],
    "equipment": "dumbbell",
    "level": "beginner"
  },
  "Seated Forward Fold": {
    "name": "Seated Floor Hamstring Stretch",
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
    "equipment": null,
    "level": "beginner"
  },
  "Seated Hip Abduction Machine": {
    "name": "Cable Hip Adduction",
    "images": [
      "Cable_Hip_Adduction/0.jpg",
      "Cable_Hip_Adduction/1.jpg"
    ],
    "cues": [
      "Stand in front of a low pulley facing forward with one leg next to the pulley and the other one away.",
      "Attach the ankle cuff to the cable and also to the ankle of the leg that is next to the pulley.",
      "Now step out and away from the stack with a wide stance and grasp the bar of the pulley system.",
      "Stand on the foot that does not have the ankle cuff (the far foot) and allow the leg with the cuff to be pulled towards the low pulley. This will be your starting position.",
      "Now perform the movement by moving the leg with the ankle cuff in front of the far leg by using the inner thighs to abduct the hip. Breathe out during this portion of the movement.",
      "Slowly return to the starting position as you breathe in."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "cable",
    "level": "beginner"
  },
  "Side Plank": {
    "name": "Side Bridge",
    "images": [
      "Side_Bridge/0.jpg",
      "Side_Bridge/1.jpg"
    ],
    "cues": [],
    "primary": [
      "abdominals"
    ],
    "equipment": "body only",
    "level": "beginner"
  },
  "Single-Leg Hip Thrust": {
    "name": "Barbell Hip Thrust",
    "images": [
      "Barbell_Hip_Thrust/0.jpg",
      "Barbell_Hip_Thrust/1.jpg"
    ],
    "cues": [
      "Begin seated on the ground with a bench directly behind you. Have a loaded barbell over your legs. Using a fat bar or having a pad on the bar can greatly reduce the discomfort caused by this exercise.",
      "Roll the bar so that it is directly above your hips, and lean back against the bench so that your shoulder blades are near the top of it.",
      "Begin the movement by driving through your feet, extending your hips vertically through the bar. Your weight should be supported by your shoulder blades and your feet. Extend as far as possible, then reverse the motion to return to the starting position."
    ],
    "primary": [
      "glutes"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Single-Leg Romanian Deadlift": {
    "name": "Romanian Deadlift",
    "images": [
      "Romanian_Deadlift/0.jpg",
      "Romanian_Deadlift/1.jpg"
    ],
    "cues": [
      "Put a barbell in front of you on the ground and grab it using a pronated (palms facing down) grip that a little wider than shoulder width. Tip: Depending on the weight used, you may need wrist wraps to perform the exercise and also a raised platform in order to allow for better range of motion.",
      "Bend the knees slightly and keep the shins vertical, hips back and back straight. This will be your starting position.",
      "Keeping your back and arms completely straight at all times, use your hips to lift the bar as you exhale. Tip: The movement should not be fast but steady and under control.",
      "Once you are standing completely straight up, lower the bar by pushing the hips back, only slightly bending the knees, unlike when squatting. Tip: Take a deep breath at the start of the movement and keep your chest up. Hold your breath as you lower and exhale as you complete the movement.",
      "Repeat for the recommended amount of repetitions."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Standing Pelvic Tuck": {
    "name": "Standing Pelvic Tilt",
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
    "equipment": null,
    "level": "beginner"
  },
  "Standing Quad Stretch": {
    "name": "Quad Stretch",
    "images": [
      "Quad_Stretch/0.jpg",
      "Quad_Stretch/1.jpg"
    ],
    "cues": [
      "Lay on your side. Loop a belt, rope, or band around your top foot. Flex the knee and extend your hip, attempting to touch your glutes with your foot, and holding the belt with your hands. This will be your starting position.",
      "With the belt being held over the shoulder or overhead, gently pull to increase the stretch in the quadriceps. Hold for 10-20 seconds, and then switch sides."
    ],
    "primary": [
      "quadriceps"
    ],
    "equipment": "other",
    "level": "intermediate"
  },
  "Sumo Deadlift": {
    "name": "Sumo Deadlift",
    "images": [
      "Sumo_Deadlift/0.jpg",
      "Sumo_Deadlift/1.jpg"
    ],
    "cues": [
      "Begin with a bar loaded on the ground. Approach the bar so that the bar intersects the middle of the feet. The feet should be set very wide, near the collars. Bend at the hips to grip the bar. The arms should be directly below the shoulders, inside the legs, and you can use a pronated grip, a mixed grip, or hook grip. Relax the shoulders, which in effect lengthens your arms.",
      "Take a breath, and then lower your hips, looking forward with your head with your chest up. Drive through the floor, spreading your feet apart, with your weight on the back half of your feet. Extend through the hips and knees.",
      "As the bar passes through the knees, lean back and drive the hips into the bar, pulling your shoulder blades together.",
      "Return the weight to the ground by bending at the hips and controlling the weight on the way down."
    ],
    "primary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "level": "intermediate"
  },
  "Supine Figure-4": {
    "name": "Lying Supine Dumbbell Curl",
    "images": [
      "Lying_Supine_Dumbbell_Curl/0.jpg",
      "Lying_Supine_Dumbbell_Curl/1.jpg"
    ],
    "cues": [
      "Lie down on a flat bench face up while holding a dumbbell in each arm on top of your thighs.",
      "Bring the dumbbells to the sides with the arms extended and the palms of the hands facing your thighs (neutral grip).",
      "While keeping the arms close to your torso and elbows in, slowly lower your arms (as you keep them extended with a slight bend at the elbows) as far down towards the floor as you can go. Once you cannot go down any further, lock your upper arms in that position and that will be your starting position.",
      "As you breathe out, slowly begin to curl the weights up as you simultaneously rotate your wrists so that the palms of the hands face up. Continue curling the weight until your biceps are fully contracted and squeeze hard at the top position for a second. Tip: Only the forearms should move. Upper arms should remain stationary and elbows should stay in throughout the movement.",
      "Return back to the starting position very slowly."
    ],
    "primary": [
      "biceps"
    ],
    "equipment": "dumbbell",
    "level": "beginner"
  },
  "Supine Hip Flexor Stretch": {
    "name": "Side-Lying Floor Stretch",
    "images": [
      "Side-Lying_Floor_Stretch/0.jpg",
      "Side-Lying_Floor_Stretch/1.jpg"
    ],
    "cues": [
      "First lie on your left side, bending your left knee in front of you to stabilize your torso (use your abdominal muscles as well to hold you upright).",
      "Straighten your right leg and rest the right foot on the floor behind your left. Straighten your right arm over your head and gently pull on your right wrist to stretch the entire right side of the body. Switch sides."
    ],
    "primary": [
      "lats"
    ],
    "equipment": null,
    "level": "beginner"
  },
  "Thoracic Rotation": {
    "name": "Torso Rotation",
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
    "equipment": "exercise ball",
    "level": "beginner"
  }
};

/** The demo for a program exercise, if one exists. */
export function demoFor(exerciseName: string): ExerciseDemo | null {
  return EXERCISE_DEMOS[exerciseName] ?? null;
}
