import { NextRequest, NextResponse } from "next/server";
import { getSharedNotes } from "@/lib/lectures";

export const dynamic = "force-dynamic";

// Public, read-only. Returns notes for a single shared lecture and nothing
// else — no transcript, no quiz, no other lectures, no other dashboard data.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const notes = await getSharedNotes(params.token);
  if (!notes) return NextResponse.json({ error: "This link is not active." }, { status: 404 });

  // ?format=md returns a downloadable markdown file
  if (req.nextUrl.searchParams.get("format") === "md") {
    const date = new Date(notes.createdAt).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const md = `# ${notes.title}\n\n**${notes.course}** · ${date}\n\n${notes.summary}\n\n---\n\n${notes.outline}\n`;
    const safe = notes.title.replace(/[^a-zA-Z0-9 -]/g, "").trim().replace(/\s+/g, "-") || "lecture-notes";
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safe}.md"`,
      },
    });
  }

  return NextResponse.json({ notes });
}
