import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { loadData, saveData } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const type = (formData.get("type") as string) ?? "progress"; // "progress" | "weight"

  if (!file) return NextResponse.json({ error: "No photo" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  // Upload to Vercel Blob
  const filename = `${type}/${today}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
  const blob = await put(filename, file, { access: "public" });

  let extractedWeight: number | null = null;

  // If it's a weight photo, use Claude Vision to read the scale
  if (type === "weight") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mediaType = (file.type as "image/jpeg" | "image/png" | "image/webp") ?? "image/jpeg";

      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "This is a photo of a digital scale. Read the number displayed on the screen and return ONLY the numeric weight value in lbs as a plain number (e.g. 143.2). If you cannot read the number clearly, return null.",
            },
          ],
        }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      const num = parseFloat(text);
      if (!isNaN(num) && num > 50 && num < 500) extractedWeight = num;
    } catch { /* non-fatal */ }
  }

  // Save to dashboard data
  const data = await loadData();

  // Store photo URL in 75 Hard log
  const h75 = data.seventyFiveHard ?? { startDate: "2026-06-14", currentDay: 1, active: true, logs: [] };
  const existingLog = h75.logs.find(l => l.date === today) ?? {
    date: today, workout: false, steps: false, water: false,
    mcat: false, progressPhoto: false, exposureTherapy: false, diet: false,
  };

  const updatedLog = {
    ...existingLog,
    ...(type === "progress" ? { progressPhoto: true, progressPhotoUrl: blob.url } : {}),
    ...(type === "weight" && extractedWeight ? { weightPhotoUrl: blob.url } : {}),
  };

  h75.logs = [...h75.logs.filter(l => l.date !== today), updatedLog];
  data.seventyFiveHard = h75;

  // Save weight to body weight log
  if (extractedWeight) {
    const wd = data.workout ?? { sessionLogs: [], walkingLogs: [], measurements: [], bodyWeight: [] };
    wd.bodyWeight = [...(wd.bodyWeight ?? []).filter(b => b.date !== today), { date: today, weight: extractedWeight }];
    data.workout = wd;
  }

  await saveData(data);

  return NextResponse.json({
    success: true,
    url: blob.url,
    type,
    extractedWeight,
    message: type === "weight"
      ? extractedWeight ? `Weight logged: ${extractedWeight} lbs` : "Photo saved — couldn't read the number, enter manually"
      : "Progress photo saved for today ✓",
  });
}
