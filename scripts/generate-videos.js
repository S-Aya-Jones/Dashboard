#!/usr/bin/env node

/**
 * HeyGen Video Generation Script
 * Generates AI avatar videos for all exercises in The Complete Hourglass Program
 *
 * Usage: node scripts/generate-videos.js [exerciseId]
 * Examples:
 *   node scripts/generate-videos.js                    # Generate for all exercises
 *   node scripts/generate-videos.js barbell-hip-thrust # Generate only this exercise
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.HEYGEN_API_KEY;
const AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const VOICE_ID = process.env.HEYGEN_VOICE_ID;

if (!API_KEY || !AVATAR_ID || !VOICE_ID) {
  console.error("❌ Missing environment variables:");
  console.error("   HEYGEN_API_KEY:", API_KEY ? "✓" : "✗");
  console.error("   HEYGEN_AVATAR_ID:", AVATAR_ID ? "✓" : "✗");
  console.error("   HEYGEN_VOICE_ID:", VOICE_ID ? "✓" : "✗");
  process.exit(1);
}

// Key exercises to generate videos for (glute-focused + form-critical)
const EXERCISES_TO_GENERATE = [
  {
    id: "barbell-hip-thrust",
    name: "Barbell Hip Thrust",
    formCue: "Pad the bar. Bench edge at mid-scapula, feet so shins are vertical at top. Drive up explosively, ribs down, full 1-second squeeze at lockout, lower under control.",
    category: "compound",
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    formCue: "Hinge at the hips, soft knees, bar drags along the legs. Push hips BACK, not down. Stop at the hamstring stretch — that stretch is the glutes loading.",
    category: "compound",
  },
  {
    id: "glute-bridge-hold",
    name: "Glute Bridge Hold",
    formCue: "Drive through heels, squeeze maximally at the top. Feet hip-width apart, drive hips to ceiling, hard 1-second squeeze at lockout.",
    category: "core",
  },
  {
    id: "dead-bug-main",
    name: "Dead Bug",
    formCue: "Lower back pressed flat the entire rep. Exhale fully as the limbs extend — the exhale is what engages the deep core.",
    category: "core",
  },
  {
    id: "pallof-press",
    name: "Pallof Press",
    formCue: "Cable or band at chest height, press straight out, resist the rotation. The win is NOT moving.",
    category: "core",
  },
  {
    id: "db-shoulder-press",
    name: "Dumbbell Shoulder Press",
    formCue: "Ribs down — do not arch the lower back to press. Squeeze glutes, tuck ribs, press straight overhead.",
    category: "isolation",
  },
  {
    id: "db-lateral-raise",
    name: "Dumbbell Lateral Raise",
    formCue: "Slight elbow bend, raise to shoulder height only, lead with the elbows. Strict form beats heavy weight.",
    category: "isolation",
  },
  {
    id: "face-pull",
    name: "Face Pull",
    formCue: "Rope at face height, pull toward the forehead, elbows high, end with a 1-sec squeeze. Fixes rounded shoulders.",
    category: "isolation",
  },
  {
    id: "lat-pulldown-mon",
    name: "Lat Pulldown",
    formCue: "Wide grip. Pull to upper chest, elbows down and back, slight chest-up lean. Builds the lat taper.",
    category: "compound",
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    formCue: "Neutral grip. Squeeze shoulder blades at the end. No swinging, no leaning back for momentum.",
    category: "compound",
  },
];

function buildCoachingScript(exercise) {
  return `Hello, I'm Aya, your personal form coach. Today we're breaking down the ${exercise.name}.

Here's the form cue: ${exercise.formCue}

Common mistakes I see:
- Rushing through the movement without control
- Not using a full range of motion
- Letting form break down when fatigued
- Not breathing properly

Here's what you need to focus on:

${exercise.formCue}

Remember: Quality over speed. Every rep counts. Let's make it perfect.`;
}

async function generateVideo(exercise, index, total) {
  console.log(`\n[${index}/${total}] Generating video for: ${exercise.name}`);

  const script = buildCoachingScript(exercise);

  try {
    const response = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "avatar",
        avatar_id: AVATAR_ID,
        voice_id: VOICE_ID,
        title: `${exercise.name} - Form Coaching`,
        script: script,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMsg = response.statusText;

      try {
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          errorMsg = error.error?.message || error.message || response.statusText;
        } else {
          const text = await response.text();
          errorMsg = `${response.status} - ${text.substring(0, 200)}`;
        }
      } catch (e) {
        // If parsing fails, just use status text
      }

      console.error(`   ❌ Failed: ${errorMsg}`);
      return null;
    }

    const data = await response.json();
    console.log(`   ✓ Submitted. Video ID: ${data.data.video_id}`);

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      videoId: data.data.video_id,
      submittedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function checkVideoStatus(videoId) {
  try {
    const response = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      status: data.data.status,
      videoUrl: data.data.video_url,
    };
  } catch (error) {
    console.error(`Error checking status: ${error.message}`);
    return null;
  }
}

async function main() {
  const specificId = process.argv[2];

  let exercises = EXERCISES_TO_GENERATE;
  if (specificId) {
    exercises = exercises.filter((e) => e.id === specificId);
    if (exercises.length === 0) {
      console.error(`❌ Exercise not found: ${specificId}`);
      console.log("\nAvailable exercises:");
      EXERCISES_TO_GENERATE.forEach((e) => console.log(`  - ${e.id}`));
      process.exit(1);
    }
  }

  console.log(`🎬 HeyGen Video Generation`);
  console.log(`Avatar: ${AVATAR_ID}`);
  console.log(`Voice: ${VOICE_ID}`);
  console.log(`\nGenerating ${exercises.length} video(s)...\n`);

  const results = [];
  for (let i = 0; i < exercises.length; i++) {
    const result = await generateVideo(exercises[i], i + 1, exercises.length);
    if (result) results.push(result);

    // Stagger requests to avoid rate limiting
    if (i < exercises.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Save results
  const outputFile = path.join(__dirname, "../.heygen-results.json");
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log(`\n✓ Submitted ${results.length} videos.`);
  console.log(`\n📝 Results saved to: ${outputFile}`);
  console.log(`\nNext steps:`);
  console.log(`1. Check video status: node scripts/check-videos.js`);
  console.log(`2. Once ready, copy video URLs to your app`);
}

main().catch(console.error);
