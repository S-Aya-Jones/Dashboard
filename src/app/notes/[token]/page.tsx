import { getSharedNotes } from "@/lib/lectures";
import { Download } from "lucide-react";
import { renderMath, MATH_CSS } from "@/lib/mathText";

export const dynamic = "force-dynamic";

// Standalone public page — no sidebar, no navigation into the dashboard.
// A classmate with this link sees these notes and can reach nothing else.

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return renderMath(esc(s))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[EMPHASIZED\]/g, '<span class="flag">emphasized in lecture</span>');
}

function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0, inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      closeList();
      const header = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim())); i++;
      }
      out.push("<div class='tw'><table>" +
        "<thead><tr>" + header.map(h => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h3) { closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); }
    else if (h2 || h1) { closeList(); out.push(`<h2>${inline((h2 ?? h1)![1])}</h2>`); }
    else if (quote) { closeList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); }
    else if (bullet) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li${bullet[1].length >= 2 ? " class='sub'" : ""}>${inline(bullet[2])}</li>`);
    }
    else if (numbered) {
      if (!inList) { out.push("<ul class='ol'>"); inList = true; }
      out.push(`<li>${inline(numbered[1])}</li>`);
    }
    else if (line.trim() === "") closeList();
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
    i++;
  }
  closeList();
  return out.join("");
}

export default async function SharedNotesPage({ params }: { params: { token: string } }) {
  const notes = await getSharedNotes(params.token);

  if (!notes) {
    return (
      <main style={{ maxWidth: 640, margin: "18vh auto", padding: "0 1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "1.4rem", color: "#1a1a2e" }}>This link isn&apos;t active</h1>
        <p style={{ color: "#6b7280", marginTop: ".5rem" }}>
          It may have been turned off, or the address may be mistyped.
        </p>
      </main>
    );
  }

  const date = new Date(notes.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <style>{`
        .wrap { max-width: 780px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem;
                font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; }
        .hdr { border-bottom: 3px solid #7C5CFC; padding-bottom: 1.25rem; margin-bottom: 2rem; }
        .course { font-size: .72rem; font-weight: 800; letter-spacing: .08em;
                  text-transform: uppercase; color: #7C5CFC; }
        .ttl { font-size: 1.85rem; line-height: 1.25; margin: .35rem 0 .6rem; font-weight: 700; }
        .meta { font-size: .82rem; color: #6b7280; }
        .sum { margin-top: .9rem; font-size: .95rem; line-height: 1.7; color: #374151; }
        h2 { font-size: 1.28rem; font-weight: 700; margin: 2rem 0 .6rem;
             padding-bottom: .35rem; border-bottom: 1px solid #e5e7eb; }
        h3 { font-size: 1.05rem; font-weight: 650; margin: 1.25rem 0 .4rem; color: #5b3fd4; }
        p  { line-height: 1.78; margin: .55rem 0; }
        ul { margin: .45rem 0 .9rem 1.3rem; }
        li { line-height: 1.78; margin: .3rem 0; list-style: disc; }
        li.sub { margin-left: 1.25rem; }
        ul.ol li { list-style: decimal; }
        blockquote { border-left: 3px solid #7C5CFC; background: #f6f4ff; padding: .7rem .95rem;
                     margin: .9rem 0; border-radius: 0 8px 8px 0; line-height: 1.7; }
        code { background: #f3f4f6; padding: .1rem .35rem; border-radius: 4px; font-size: .9em; }
        .flag { display: inline-block; margin-left: .4rem; padding: .08rem .45rem; border-radius: 999px;
                background: #ffe3d0; color: #9a4a05; font-size: .66rem; font-weight: 700;
                text-transform: uppercase; }
        .tw { overflow-x: auto; margin: .9rem 0; }
        table { border-collapse: collapse; width: 100%; font-size: .9rem; }
        th { background: #f3f0ff; text-align: left; padding: .55rem .7rem; border: 1px solid #e5e7eb; font-weight: 700; }
        td { padding: .5rem .7rem; border: 1px solid #e5e7eb; line-height: 1.6; }
        .bar { display: flex; gap: .6rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .btn { display: inline-flex; align-items: center; gap: .4rem; font-size: .84rem; font-weight: 600;
               padding: .55rem 1rem; border-radius: 9px; text-decoration: none;
               background: #7C5CFC; color: #fff; border: none; }
        .btn.alt { background: #fff; color: #4b4b63; border: 1.5px solid #e5e7eb; }
        .foot { margin-top: 3.5rem; padding-top: 1.25rem; border-top: 1px solid #e5e7eb;
                font-size: .76rem; color: #9ca3af; }
        ${MATH_CSS}
        .eq-block { background: #f6f4ff; border-left-color: #7C5CFC; }
        @media print {
          .bar, .foot { display: none; }
          .wrap { max-width: none; padding: 0; }
          h2, h3 { page-break-after: avoid; }
          blockquote, table { page-break-inside: avoid; }
        }
      `}</style>

      <main className="wrap">
        <div className="bar">
          <a className="btn" href={`/api/notes/${params.token}?format=docx`}>
            <Download size={14} /> Download for Word
          </a>
          <a className="btn alt" href={`/notes/${params.token}?print=1`}>Print / Save as PDF</a>
          <a className="btn alt" href={`/api/notes/${params.token}?format=md`}>Markdown</a>
        </div>

        <header className="hdr">
          <div className="course">{notes.course}</div>
          <h1 className="ttl">{notes.title}</h1>
          <div className="meta">Lecture notes · {date}</div>
          {notes.summary && <p className="sum">{notes.summary}</p>}
        </header>

        <article dangerouslySetInnerHTML={{ __html: renderMarkdown(notes.outline) }} />

        <footer className="foot">
          Shared lecture notes. This page contains only these notes — nothing else is accessible from this link.
        </footer>
      </main>
    </>
  );
}
