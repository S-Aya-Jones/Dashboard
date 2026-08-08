# HeyGen Video Generation Workflow

This folder contains scripts to generate, check, and import Aya avatar coaching videos.

## Prerequisites

- ✓ HEYGEN_API_KEY in `.env.local`
- ✓ HEYGEN_AVATAR_ID in `.env.local`
- ✓ HEYGEN_VOICE_ID in `.env.local`

## Step 1: Generate Videos

Generate videos for all key exercises (or just one):

```bash
# Generate all exercises
node scripts/generate-videos.js

# Generate only one exercise
node scripts/generate-videos.js barbell-hip-thrust
```

**What happens:**
- Submits each exercise to HeyGen API
- Creates a coaching script with the form cue
- Saves video IDs to `.heygen-results.json`
- Each video takes ~2–5 minutes to render

**Output:** `.heygen-results.json`
```json
[
  {
    "exerciseId": "barbell-hip-thrust",
    "exerciseName": "Barbell Hip Thrust",
    "videoId": "xxx-xxx-xxx",
    "submittedAt": "2026-06-10T12:00:00Z"
  }
]
```

## Step 2: Monitor Progress

Check video generation status:

```bash
node scripts/check-videos.js
```

**Status values:**
- `processing` — Video is being generated
- `completed` — Ready to use
- `error` — Generation failed

Once videos show `completed`, they have a `videoUrl`.

## Step 3: Import to App

After videos are ready:

```bash
node scripts/import-videos.js
```

This shows you the data structure. Manually add videos to your app like this:

```typescript
// In your WorkoutView or SessionView
const avatarVideoUrls = [
  {
    exerciseId: "barbell-hip-thrust",
    exerciseName: "Barbell Hip Thrust",
    videoUrl: "https://...",
    generatedAt: "2026-06-10T...",
  },
  // ...
];

// When rendering an exercise:
const videoUrl = avatarVideoUrls.find(v => v.exerciseId === exercise.id)?.videoUrl;
if (videoUrl) {
  return <AvatarCoach exercise={exercise} videoUrl={videoUrl} />;
}
```

## Available Exercises

Videos are generated for these key exercises:

- `barbell-hip-thrust` — Barbell Hip Thrust
- `romanian-deadlift` — Romanian Deadlift
- `glute-bridge-hold` — Glute Bridge Hold
- `dead-bug-main` — Dead Bug
- `pallof-press` — Pallof Press
- `db-shoulder-press` — Dumbbell Shoulder Press
- `db-lateral-raise` — Dumbbell Lateral Raise
- `face-pull` — Face Pull
- `lat-pulldown-mon` — Lat Pulldown
- `seated-cable-row` — Seated Cable Row

To generate just one:
```bash
node scripts/generate-videos.js barbell-hip-thrust
```

## Troubleshooting

**"Missing environment variables"**
- Add HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID to `.env.local`
- Restart the app: `npm run dev`

**"API returned error"**
- Check your HeyGen account has remaining credits
- Verify API key is correct
- Check avatar ID and voice ID exist

**Video stuck in "processing"**
- HeyGen videos take 2–10 minutes depending on script length
- Wait 5 minutes and run `check-videos.js` again
- If still stuck after 30 min, the submission may have failed

**Regenerate a single video**
- Delete its entry from `.heygen-results.json`
- Run: `node scripts/generate-videos.js <exerciseId>`

## Integration with App

Once videos are imported, integrate into `AvatarCoach.tsx`:

```typescript
// In SessionView or WorkoutView
import { useState } from "react";

export function SessionView({ ... }) {
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({
    // Load from workout data or state
  });

  return (
    <AvatarCoach
      exercise={currentExercise}
      videoUrl={videoUrls[currentExercise.id]}
      onClose={handleClose}
    />
  );
}
```

The `AvatarCoach` component already supports the `videoUrl` prop and will display videos if available.

## Cost

HeyGen charges per video generated:
- ~$0.10–0.20 per video depending on script length
- First 10 videos may be free (check your account)
- Regenerating the same video uses credits again

If you want to add more exercises later, just extend `EXERCISES_TO_GENERATE` in `generate-videos.js`.
