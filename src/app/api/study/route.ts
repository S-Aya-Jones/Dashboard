import { NextResponse } from "next/server";
import { progress } from "@/lib/studyTopics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await progress());
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
