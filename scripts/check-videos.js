#!/usr/bin/env node

/**
 * Check HeyGen Video Generation Status
 * Polls the status of submitted videos
 *
 * Usage: node scripts/check-videos.js
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.HEYGEN_API_KEY;

if (!API_KEY) {
  console.error("❌ HEYGEN_API_KEY not set in .env.local");
  process.exit(1);
}

async function checkVideoStatus(videoId) {
  try {
    const response = await fetch(`https://api.heygen.com/v1/video_clips/${videoId}`, {
      method: "GET",
      headers: {
        "X-HEYGEN-API-KEY": API_KEY,
      },
    });

    if (!response.ok) {
      return { status: "unknown", error: response.statusText };
    }

    const data = await response.json();
    return {
      status: data.data.status,
      videoUrl: data.data.download_url || data.data.video_url,
      thumbnail: data.data.thumbnail_url,
    };
  } catch (error) {
    return { status: "error", error: error.message };
  }
}

async function main() {
  const resultsFile = path.join(__dirname, "../.heygen-results.json");

  if (!fs.existsSync(resultsFile)) {
    console.error("❌ No results file found. Run generate-videos.js first.");
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));

  console.log(`🎬 Checking ${results.length} video(s)...\n`);

  const statuses = [];
  for (const result of results) {
    process.stdout.write(`${result.exerciseName}... `);

    const status = await checkVideoStatus(result.videoId);
    statuses.push({
      ...result,
      ...status,
    });

    console.log(status.status.toUpperCase());

    if (status.status === "completed" && status.videoUrl) {
      console.log(`   🎥 ${status.videoUrl}`);
    }
  }

  // Save updated results
  fs.writeFileSync(resultsFile, JSON.stringify(statuses, null, 2));

  console.log("\n📊 Summary:");
  const byStatus = {};
  statuses.forEach((s) => {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  });

  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  const completed = statuses.filter((s) => s.status === "completed");
  if (completed.length > 0) {
    console.log(`\n✓ ${completed.length} video(s) ready!`);
    console.log(`   Run: node scripts/import-videos.js`);
  }
}

main().catch(console.error);
