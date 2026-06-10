import { NextRequest, NextResponse } from "next/server";

// List and manage stored avatar video URLs
export async function GET() {
  // This would retrieve from the user's workout data
  // For now, return an example structure showing what should be stored
  return NextResponse.json({
    message: "Avatar videos are stored in workout.avatarVideoUrls",
    example: {
      exerciseId: "hip-thrust-compound",
      exerciseName: "Hip Thrust",
      videoUrl: "https://example.com/video/hip-thrust.mp4",
      generatedAt: new Date().toISOString(),
      avatarPrompt: "Demonstrate proper hip thrust form with emphasis on glute contraction",
    },
  });
}

// Add a manual video URL (for testing or manual uploads)
export async function POST(req: NextRequest) {
  const { exerciseId, exerciseName, videoUrl } = await req.json();

  if (!exerciseId || !exerciseName || !videoUrl) {
    return NextResponse.json(
      { error: "exerciseId, exerciseName, and videoUrl required" },
      { status: 400 }
    );
  }

  // Return the avatar video entry that should be stored
  return NextResponse.json({
    success: true,
    avatarVideo: {
      exerciseId,
      exerciseName,
      videoUrl,
      generatedAt: new Date().toISOString(),
    },
    message: "Save this to your workout.avatarVideoUrls array",
  });
}
