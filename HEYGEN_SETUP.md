# HeyGen AI Avatar Setup Guide

## Overview

Your fitness app now supports AI avatar videos for exercise demonstrations. Each exercise can have a personalized video featuring a female Black avatar with curly hair, glute-focused coaching, and proper form demonstration.

## Setup Instructions

### 1. Get HeyGen API Credentials

1. Create a HeyGen account at https://www.heygen.com
2. Navigate to API Settings and create an API key
3. Choose or customize an avatar:
   - **Recommended Avatar**: Select a female avatar with curly black hair
   - **Customization**: Configure avatar appearance, voice, and background
4. Get the Avatar ID from your avatar settings

### 2. Set Environment Variables

Add these to your `.env.local` file:

```env
HEYGEN_API_KEY=your_api_key_here
HEYGEN_AVATAR_ID=avatar_id_here  # e.g., Wayne_20240711 (change to your chosen avatar)
HEYGEN_VOICE_ID=voice_id_here    # e.g., 21m00Tcm4TlvDq8ikWAM (your chosen voice)
```

### 3. Generate Videos for Exercises

#### Option A: Manual Generation (One at a time)

```bash
curl -X POST http://localhost:3000/api/workout/avatar/generate \
  -H "Content-Type: application/json" \
  -d '{
    "exerciseId": "hip-thrust-compound",
    "exerciseName": "Hip Thrust",
    "formCue": "Ribs down, 1-second squeeze, vertical shins at top",
    "category": "compound"
  }'
```

Response will include a `videoId` to check status:

```bash
curl "http://localhost:3000/api/workout/avatar/generate?videoId=VIDEO_ID_HERE"
```

#### Option B: Batch Generation (All exercises)

Create a script at `scripts/generate-avatar-videos.ts`:

```typescript
import { PROGRAM } from "@/components/workout/program";

const API_BASE = "http://localhost:3000";

async function generateAllVideos() {
  const exercises = PROGRAM.flatMap((day) => [
    ...day.warmupExercises,
    ...day.mainExercises,
    ...day.cooldownExercises,
  ]);

  // Remove duplicates by exercise ID
  const uniqueExercises = Array.from(
    new Map(exercises.map((ex) => [ex.id, ex])).values()
  );

  console.log(`Generating videos for ${uniqueExercises.length} exercises...`);

  const videoIds: Record<string, string> = {};

  for (const exercise of uniqueExercises) {
    try {
      console.log(`Generating: ${exercise.name}...`);

      const res = await fetch(`${API_BASE}/api/workout/avatar/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          formCue: exercise.formCue,
          category: exercise.category,
        }),
      });

      const data = await res.json();
      videoIds[exercise.id] = data.videoId;
      console.log(`✓ ${exercise.name}: ${data.videoId}`);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      console.error(`✗ ${exercise.name}:`, e);
    }
  }

  // Save video IDs for status checking later
  console.log("\nVideo IDs for status checking:");
  console.log(JSON.stringify(videoIds, null, 2));

  return videoIds;
}

generateAllVideos();
```

Run with:
```bash
npx ts-node scripts/generate-avatar-videos.ts
```

### 4. Check Video Status and Get URLs

After generation starts, videos typically process in 2-10 minutes. Check status:

```bash
curl "http://localhost:3000/api/workout/avatar/generate?videoId=YOUR_VIDEO_ID"
```

Response includes `videoUrl` when ready:

```json
{
  "videoId": "...",
  "status": "completed",
  "videoUrl": "https://...",
  "thumbnail": "https://..."
}
```

### 5. Store Video URLs in Workout Data

Once you have video URLs, store them in your workout data:

```typescript
// In your app's data update function:
update((d) => {
  const wd = d.workout ?? { ... };
  return {
    ...d,
    workout: {
      ...wd,
      avatarVideoUrls: [
        {
          exerciseId: "hip-thrust-compound",
          exerciseName: "Hip Thrust",
          videoUrl: "https://example.com/video.mp4",
          generatedAt: new Date().toISOString(),
          avatarPrompt: "Hip Thrust form demonstration with glute focus",
        },
        // ... add more exercises
      ],
    },
  };
});
```

## Features

### For You (as a user)

- **Visual Learning**: See proper form demonstrated by your AI coach
- **Personalized Avatar**: Your avatar with consistent appearance across all videos
- **Coaching Script**: Each video includes:
  - Exercise name and category
  - Form cues and what to avoid
  - Common mistakes
  - Motivation and encouragement
- **Flexible Access**: Play video or use form cues if video is unavailable

### For Developers

- **Easy Generation**: Simple API endpoints for creating videos
- **Status Tracking**: Monitor video generation progress
- **Flexible Storage**: Videos stored in your app's data blob
- **Fallback Support**: Form cues always available if video generation fails

## Customizing Avatar Scripts

Edit `buildCoachingScript()` in `/api/workout/avatar/generate/route.ts`:

```typescript
function buildCoachingScript(
  exerciseName: string,
  formCue: string,
  category: string
): string {
  return `
Hello! I'm your AI coach, and today we're breaking down the ${exerciseName}.

[Your custom script here - keep it under 4500 characters for TTS]
  `;
}
```

## Troubleshooting

### Videos not generating
- Check HEYGEN_API_KEY is set correctly
- Verify avatar and voice IDs are valid
- Check HeyGen account has sufficient credits

### Video URLs not displaying
- Ensure videoUrl is stored in `workout.avatarVideoUrls`
- Check browser console for fetch errors
- Verify video URLs are publicly accessible

### API rate limiting
- Add delays between requests (2+ seconds)
- Check HeyGen API rate limits
- Contact HeyGen support if experiencing issues

## Pricing

HeyGen pricing depends on your plan:
- **Free tier**: Limited video generation
- **Paid tiers**: More videos, higher resolution, custom avatars
- Visit https://www.heygen.com/pricing for current rates

## Next Steps

1. ✅ Set up HeyGen account and API credentials
2. ✅ Generate videos for all exercises
3. ✅ Store video URLs in your workout data
4. ✅ Test video playback during workouts
5. ✅ Customize avatar appearance and scripts as needed

---

**Note**: Video generation is asynchronous. After initiating generation, check status periodically until videos complete processing.
