#!/usr/bin/env node

/**
 * Import Completed HeyGen Videos
 * Takes completed videos from .heygen-results.json and creates the app data structure
 *
 * Usage: node scripts/import-videos.js
 */

const fs = require("fs");
const path = require("path");

function main() {
  const resultsFile = path.join(__dirname, "../.heygen-results.json");

  if (!fs.existsSync(resultsFile)) {
    console.error("❌ No results file found. Run check-videos.js first.");
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));

  const completed = results.filter((r) => r.status === "completed" && r.videoUrl);

  if (completed.length === 0) {
    console.error("❌ No completed videos found. Check status with: node scripts/check-videos.js");
    process.exit(1);
  }

  console.log(`📦 Importing ${completed.length} video(s)...\n`);

  // Format for app data (AvatarVideoUrl[])
  const videoUrls = completed.map((video) => ({
    exerciseId: video.exerciseId,
    exerciseName: video.exerciseName,
    videoUrl: video.videoUrl,
    generatedAt: new Date().toISOString(),
    avatarPrompt: "Female Black fitness coach with curly hair, glute-focused, honest feedback.",
  }));

  // Create sample data structure
  const appData = {
    workout: {
      avatarVideoUrls: videoUrls,
    },
  };

  console.log("Sample app data structure:");
  console.log(JSON.stringify(appData, null, 2));

  console.log("\n✓ To add these to your app:");
  console.log("1. In WorkoutView or BodyScanView, store these URLs in your state");
  console.log("2. When displaying an exercise, check if avatarVideoUrl exists");
  console.log("3. Pass to AvatarCoach component with videoUrl prop");
  console.log("\nExample:");
  console.log("  const videoUrl = videoUrls.find(v => v.exerciseId === exercise.id)?.videoUrl;");
  console.log("  <AvatarCoach exercise={exercise} videoUrl={videoUrl} />");
}

main();
