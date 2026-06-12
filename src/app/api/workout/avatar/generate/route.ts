import { NextRequest, NextResponse } from "next/server";

// HeyGen API integration for generating exercise demonstration videos
// Requires HEYGEN_API_KEY environment variable

export async function POST(req: NextRequest) {
  const { exerciseId, exerciseName, formCue, category } = await req.json();

  if (!exerciseId || !exerciseName) {
    return NextResponse.json(
      { error: "exerciseId and exerciseName required" },
      { status: 400 }
    );
  }

  const heygenApiKey = process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    return NextResponse.json(
      { error: "HeyGen API not configured" },
      { status: 500 }
    );
  }

  // Build the coaching script for the avatar
  const coachingScript = buildCoachingScript(exerciseName, formCue, category);

  try {
    // Create video using HeyGen API
    const createResponse = await fetch("https://api.heygen.com/v1/video_requests.create", {
      method: "POST",
      headers: {
        "X-HEYGEN-API-KEY": heygenApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        avatar_id: process.env.HEYGEN_AVATAR_ID || "Wayne_20240711",
        voice: {
          voice_id: process.env.HEYGEN_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
        },
        title: `${exerciseName} - Form Demonstration`,
        script: coachingScript,
        version: "latest",
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return NextResponse.json(
        { error: `HeyGen API error: ${error.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    const videoData = await createResponse.json();

    return NextResponse.json({
      videoId: videoData.data.video_id,
      exerciseId,
      exerciseName,
      status: "generating",
      message: "Video generation started. Check status with video ID.",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// Get video status and download URL
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  const heygenApiKey = process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    return NextResponse.json(
      { error: "HeyGen API not configured" },
      { status: 500 }
    );
  }

  try {
    const statusResponse = await fetch(
      `https://api.heygen.com/v1/video_requests.get?video_id=${videoId}`,
      {
        method: "GET",
        headers: {
          "X-HEYGEN-API-KEY": heygenApiKey,
        },
      }
    );

    if (!statusResponse.ok) {
      const error = await statusResponse.json();
      return NextResponse.json(
        { error: `HeyGen API error: ${error.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    const data = await statusResponse.json();

    return NextResponse.json({
      videoId,
      status: data.data.status,
      videoUrl: data.data.video_url,
      thumbnail: data.data.thumbnail_url,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// Build coaching script with form cues and motivation
function buildCoachingScript(
  exerciseName: string,
  formCue: string,
  category: string
): string {
  return `Hello! I'm your AI coach, and today we're breaking down the ${exerciseName}.

This exercise is ${category === "compound" ? "a compound movement that requires full-body coordination" : category === "isolation" ? "an isolation movement for targeted development" : "a core stability exercise"}.

Here's what you need to remember: ${formCue}

Let me show you the proper form and common mistakes to avoid.

Key points:
1. Control every rep — no bouncing or momentum
2. Feel the muscle working, not just moving weight
3. If your form breaks down, stop the set
4. Progress comes from consistency and perfect reps, not ego lifting

You've got this. Let's build better form, one rep at a time.`;
}
