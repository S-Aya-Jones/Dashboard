import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { describeAiError, firstText } from "@/lib/aiError";
import {
  addMaterial, listMaterial, deleteMaterial,
  assembleParts, clearParts,
} from "@/lib/courseMaterial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// Material shared by her class: a summary, a study guide, someone's question
// set. Text and HTML arrive already parsed by the browser; a PDF arrives in
// staged pieces and is read here, the same way a lecture deck is.

const READ_SYSTEM = `You are reading study material shared between students on a graduate medical-science course (Biochemistry, Physiology, Microbiology, Cell & Molecular Biology).

Return the material as clean, complete text. Keep every definition, value, unit, mechanism and question exactly as written — this is someone's study guide and its details are the point. Describe any figure, diagram, pathway or table in place, beginning that line with FIGURE: or TABLE:.

Do not summarise, shorten, or improve it. Plain text only, no preamble, no LaTeX — use ^ for exponents and charges.`;

export async function GET(req: NextRequest) {
  try {
    const course = req.nextUrl.searchParams.get("course") ?? undefined;
    return NextResponse.json({ material: await listMaterial(course) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { course, title, source, kind } = body;
    if (typeof course !== "string" || !course.trim()) {
      return NextResponse.json({ error: "Which course is this for?" }, { status: 400 });
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Give it a name." }, { status: 400 });
    }

    let text: string = typeof body.text === "string" ? body.text : "";
    const images: string[] = Array.isArray(body.images) ? body.images.slice(0, 12) : [];
    const partKey: string | undefined = typeof body.partKey === "string" ? body.partKey : undefined;

    // A PDF that was uploaded in pieces.
    if (partKey) {
      const base64 = await assembleParts(partKey);
      if (!base64) return NextResponse.json({ error: "Nothing was uploaded." }, { status: 400 });
      try {
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8000,
          system: READ_SYSTEM,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: `Course: ${course}\nShared as: ${title}\n\nRead this out in full.` },
            ],
          }],
        });
        text = firstText(msg).trim();
        await clearParts(partKey);
      } catch (e) {
        // Pieces stay put so a retry costs nothing extra.
        const f = describeAiError(e);
        return NextResponse.json({ error: f.message, blocking: f.blocking }, { status: f.blocking ? 402 : 502 });
      }
    } else if (images.length) {
      // HTML with figures — read them alongside the text it already has.
      try {
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          system: READ_SYSTEM,
          messages: [{
            role: "user",
            content: [
              ...images.map(data => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
              })),
              {
                type: "text" as const,
                text: `Course: ${course}\nShared as: ${title}\n\nAbove are this handout's ${images.length} figures, in order. Return the text below with each figure described in place.\n\n${text.slice(0, 20000)}`,
              },
            ],
          }],
        });
        const described = firstText(msg).trim();
        // Never let a thin read replace what she already had.
        if (described.length > text.length / 2) text = described;
      } catch (e) {
        const f = describeAiError(e);
        if (f.blocking) return NextResponse.json({ error: f.message, blocking: true }, { status: 402 });
        // Otherwise keep the plain text: the figures are a bonus, not the file.
      }
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "Nothing readable in that file." }, { status: 400 });
    }

    const saved = await addMaterial({ course, title, source, kind, text });
    return NextResponse.json({ ok: true, material: { ...saved, text: undefined }, chars: text.length });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteMaterial(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
