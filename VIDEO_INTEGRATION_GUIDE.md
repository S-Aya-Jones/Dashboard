# Video Integration Guide

## Structure

Videos go in: `/public/videos/`

Each exercise can have a `videoUrl` property pointing to: `/videos/filename.mp4`

## How to Add Videos to Exercises

In `src/components/workout/program.ts`, update an exercise like this:

### Before:
```typescript
{
  id: "cat-cow",
  name: "Cat-Cow",
  sets: 1,
  reps: "10",
  restSeconds: 30,
  formCue: "Slow, controlled movement...",
  category: "mobility",
}
```

### After:
```typescript
{
  id: "cat-cow",
  name: "Cat-Cow",
  sets: 1,
  reps: "10",
  restSeconds: 30,
  formCue: "Slow, controlled movement...",
  category: "mobility",
  videoUrl: "/videos/cat-cow.mp4",  // ← Add this line
}
```

## Completed Videos Ready to Add

When you download and place your videos in `/public/videos/`, use these IDs with these paths:

1. `cat-cow` → `/videos/cat-cow.mp4`
2. `banded-clamshell` → `/videos/banded-clamshell.mp4`
3. `hip-circles` → `/videos/hip-circles.mp4`
4. `glute-bridge-hold` → `/videos/glute-bridge-hold.mp4`
5. `glute-squeeze-hold` → `/videos/glute-squeeze-hold.mp4`
6. `standing-pelvic-tuck` → `/videos/standing-pelvic-tuck.mp4`
7. `dead-bug` → `/videos/dead-bug.mp4`
8. `doorway-chest-stretch` → `/videos/doorway-chest-stretch.mp4`
9. `kneeling-hip-flexor-stretch` → `/videos/kneeling-hip-flexor-stretch.mp4`
10. `pallof-press` → `/videos/pallof-press.mp4`

Plus any other videos you have downloaded.

## How Videos Display

The `ExerciseVideoPlayer` component (`src/components/ExerciseVideoPlayer.tsx`) handles:
- Full-screen video playback
- Play/pause controls
- Mute button
- Close button
- Auto-play on open

## Integration Points

Videos will be played:
1. Before starting a set of an exercise
2. On demand during the workout
3. Any other place you decide to add the player

Use the component like this:
```tsx
<ExerciseVideoPlayer
  videoUrl={exercise.videoUrl}
  exerciseName={exercise.name}
  onClose={() => setShowVideo(false)}
  autoPlay={true}
/>
```

## Naming Convention

Keep video filenames:
- Lowercase
- Hyphenated (e.g., `cat-cow.mp4`, not `Cat-Cow.mp4`)
- Matching the exercise `id` from the program
