import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildTutorContext, buildSystemPrompt, type TutorMode } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

interface Turn { role: "user" | "assistant"; content: string }

// What material the tutor has for a course, so the UI can say so before she
// starts typing into something that knows nothing.
export async function GET(req: NextRequest) {
  const course = req.nextUrl.searchParams.get("course");
  if (!course) return NextResponse.json({ error: "course is required" }, { status: 400 });
  try {
    const ctx = await buildTutorContext(course);
    return NextResponse.json({
      course,
      hasMaterial: ctx.hasMaterial,
      lectures: ctx.lectures.map((l) => ({ id: l.id, title: l.title })),
      missCount: ctx.misses.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't load your material" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { course, lectureId, mode, messages } = await req.json();

    if (typeof course !== "string" || !course) {
      return NextResponse.json({ error: "course is required" }, { status: 400 });
    }
    const turns: Turn[] = Array.isArray(messages) ? messages.slice(-16) : [];
    if (!turns.length) {
      return NextResponse.json({ error: "Nothing to answer" }, { status: 400 });
    }

    const ctx = await buildTutorContext(course, typeof lectureId === "string" ? lectureId : undefined);
    const system = buildSystemPrompt(ctx, (mode as TutorMode) ?? "explain");

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1600,
      system,
      messages: turns.map((t) => ({
        role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(t.content ?? "").slice(0, 8000),
      })),
    });

    const reply = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    return NextResponse.json({
      reply,
      grounded: ctx.hasMaterial,
      lectureCount: ctx.lectures.length,
      missCount: ctx.misses.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The tutor couldn't answer" },
      { status: 502 }
    );
  }
}
