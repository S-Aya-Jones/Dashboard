import { NextRequest, NextResponse } from "next/server";
import { getSharedNotes } from "@/lib/lectures";
import { notesToDocx } from "@/lib/notesDocx";

export const dynamic = "force-dynamic";

// Public, read-only. Returns notes for a single shared lecture and nothing
// else — no transcript, no quiz, no other lectures, no other dashboard data.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const notes = await getSharedNotes(params.token);
  if (!notes) return NextResponse.json({ error: "This link is not active." }, { status: 404 });

  const safeName = (notes.title.replace(/[^a-zA-Z0-9 -]/g, "").trim().replace(/\s+/g, "-") || "lecture-notes");

  // ?format=docx returns a real Word document
  if (req.nextUrl.searchParams.get("format") === "docx") {
    const buf = await notesToDocx(notes);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      },
    });
  }

  // ?format=md returns a downloadable markdown file
  if (req.nextUrl.searchParams.get("format") === "md") {
    const date = new Date(notes.createdAt).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const md = `# ${notes.title}\n\n**${notes.course}** · ${date}\n\n${notes.summary}\n\n---\n\n${notes.outline}\n`;
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.md"`,
      },
    });
  }

  return NextResponse.json({ notes });
}
